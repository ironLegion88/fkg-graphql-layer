"""Deterministic ingestion-time semantic profiles for embedded RDF stores."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from pyoxigraph import BlankNode, NamedNode, Quad, Store


RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
RDF_FIRST = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#first")
RDF_REST = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#rest")
RDF_NIL = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#nil")
RDFS_SUBCLASS_OF = NamedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf")
OWL_INTERSECTION_OF = NamedNode("http://www.w3.org/2002/07/owl#intersectionOf")
OWL_INVERSE_OF = NamedNode("http://www.w3.org/2002/07/owl#inverseOf")
OWL_SYMMETRIC_PROPERTY = NamedNode(
    "http://www.w3.org/2002/07/owl#SymmetricProperty"
)
DEFAULT_INFERRED_GRAPH = NamedNode("urn:fkg:graph:inferred")


def materialize_semantics(
    store: Store,
    profile: str,
    *,
    inferred_graph: NamedNode = DEFAULT_INFERRED_GRAPH,
) -> int:
    """Materialize a supported semantic profile into a provenance graph."""
    if profile == "none":
        return 0
    
    if profile == "hermit":
        return _run_hermit_provider(store, inferred_graph)
        
    if profile != "rdfs-wine-parity":
        raise ValueError(f"Unsupported reasoning profile '{profile}'")

    asserted_triples = {
        (quad.subject, quad.predicate, quad.object)
        for quad in store
        if quad.graph_name != inferred_graph
    }
    inferred_triples = _wine_parity_closure(asserted_triples)
    new_triples = inferred_triples - asserted_triples
    if new_triples:
        store.extend(
            Quad(subject, predicate, object_value, inferred_graph)
            for subject, predicate, object_value in sorted(
                new_triples,
                key=lambda triple: tuple(str(term) for term in triple),
            )
        )
    return len(new_triples)


def _wine_parity_closure(
    asserted_triples: set[tuple[Any, Any, Any]],
) -> set[tuple[Any, Any, Any]]:
    parents: dict[NamedNode, set[NamedNode]] = defaultdict(set)
    list_first: dict[Any, Any] = {}
    list_rest: dict[Any, Any] = {}
    intersections: list[tuple[NamedNode, Any]] = []
    inverse_properties: set[tuple[NamedNode, NamedNode]] = set()
    symmetric_properties: set[NamedNode] = set()

    for subject, predicate, object_value in asserted_triples:
        if (
            predicate == RDFS_SUBCLASS_OF
            and isinstance(subject, NamedNode)
            and isinstance(object_value, NamedNode)
        ):
            parents[subject].add(object_value)
        elif predicate == RDF_FIRST:
            list_first[subject] = object_value
        elif predicate == RDF_REST:
            list_rest[subject] = object_value
        elif (
            predicate == OWL_INTERSECTION_OF
            and isinstance(subject, NamedNode)
            and isinstance(object_value, (NamedNode, BlankNode))
        ):
            intersections.append((subject, object_value))
        elif (
            predicate == OWL_INVERSE_OF
            and isinstance(subject, NamedNode)
            and isinstance(object_value, NamedNode)
        ):
            inverse_properties.add((subject, object_value))
        elif (
            predicate == RDF_TYPE
            and object_value == OWL_SYMMETRIC_PROPERTY
            and isinstance(subject, NamedNode)
        ):
            symmetric_properties.add(subject)

    for class_node, list_head in intersections:
        for member in _rdf_list_members(list_head, list_first, list_rest):
            if isinstance(member, NamedNode):
                parents[class_node].add(member)

    ancestors = {
        class_node: _all_ancestors(class_node, parents)
        for class_node in set(parents).union(
            parent for direct_parents in parents.values() for parent in direct_parents
        )
    }

    inferred: set[tuple[Any, Any, Any]] = set()
    for class_node, class_ancestors in ancestors.items():
        inferred.update(
            (class_node, RDFS_SUBCLASS_OF, ancestor) for ancestor in class_ancestors
        )

    for subject, predicate, object_value in asserted_triples:
        if predicate == RDF_TYPE and isinstance(object_value, NamedNode):
            inferred.update(
                (subject, RDF_TYPE, ancestor)
                for ancestor in ancestors.get(object_value, set())
            )

    for inverse_property, direct_property in inverse_properties:
        for subject, predicate, object_value in asserted_triples:
            if predicate == direct_property and isinstance(
                object_value, (NamedNode, BlankNode)
            ):
                inferred.add((object_value, inverse_property, subject))
            elif predicate == inverse_property and isinstance(
                object_value, (NamedNode, BlankNode)
            ):
                inferred.add((object_value, direct_property, subject))

    for symmetric_property in symmetric_properties:
        for subject, predicate, object_value in asserted_triples:
            if predicate == symmetric_property and isinstance(
                object_value, (NamedNode, BlankNode)
            ):
                inferred.add((object_value, symmetric_property, subject))

    return inferred


def _rdf_list_members(
    head: Any,
    first_by_node: dict[Any, Any],
    rest_by_node: dict[Any, Any],
) -> list[Any]:
    members: list[Any] = []
    visited: set[Any] = set()
    current = head
    while current != RDF_NIL and current not in visited:
        visited.add(current)
        if current not in first_by_node:
            break
        members.append(first_by_node[current])
        current = rest_by_node.get(current, RDF_NIL)
    return members


def _all_ancestors(
    class_node: NamedNode,
    parents: dict[NamedNode, set[NamedNode]],
) -> set[NamedNode]:
    ancestors: set[NamedNode] = set()
    pending = list(parents.get(class_node, set()))
    while pending:
        parent = pending.pop()
        if parent == class_node or parent in ancestors:
            continue
        ancestors.add(parent)
        pending.extend(parents.get(parent, set()))
    return ancestors

def _run_hermit_provider(store: Store, inferred_graph: NamedNode) -> int:
    import tempfile
    import os
    from pathlib import Path
    from pyoxigraph import RdfFormat
    from ingestion.reasoners.hermit_provider import HermitProvider
    
    provider = HermitProvider()
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        ontology_path = temp_dir_path / "ontology.nt"
        output_path = temp_dir_path / "inferred.nt"
        
        # store.dump will write all quads. We only want asserted ones, but currently 
        # the store only has asserted ones. owlready2 might expect N-Triples or RDF/XML. 
        # Manually write N-Triples since PyOxigraph store.dump requires N-Quads for datasets.
        with open(ontology_path, "wb") as f:
            for quad in store:
                if quad.graph_name != inferred_graph:
                    # Write as N-Triples format: <s><p><o>.
                    s = quad.subject
                    p = quad.predicate
                    o = quad.object
                    line = f"{s} {p} {o} .\n".encode("utf-8")
                    f.write(line)
            
        # Run HermiT provider
        result = provider.classify_and_materialize(ontology_path, output_path)
        
        if not result.is_consistent:
            msg = "Ontology is inconsistent."
            if result.unsatisfiable_classes:
                msg += f" Unsatisfiable classes: {', '.join(result.unsatisfiable_classes)}"
            if result.diagnostics:
                msg += f" Diagnostics: {result.diagnostics}"
            raise ValueError(msg)
            
        if not output_path.exists():
            return 0
            
        # Load inferred triples into the store under inferred_graph
        # Store.load expects bytes, we can use safe_parse_rdf or directly load
        # Since this is internally generated, we can directly use store.load
        initial_count = len(store)
        store.load(
            str(output_path),
            mime_type="application/n-triples",
            base_iri=None,
            to_graph=inferred_graph
        )
        return len(store) - initial_count