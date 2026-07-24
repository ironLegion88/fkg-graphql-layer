"""Semantic profile tests for deterministic Wine ontology materialization."""

from __future__ import annotations

import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from ingestion.reasoning import (
    DEFAULT_INFERRED_GRAPH,
    RDF_TYPE,
    RDFS_SUBCLASS_OF,
    materialize_semantics,
)


EX = "https://example.org/"


def _semantic_store() -> Store:
    store = Store()
    store.load(
        input=f"""
            @prefix ex: <{EX}> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

            ex:Wine a owl:Class .
            ex:WhiteWine a owl:Class ; owl:intersectionOf (ex:Wine) .
            ex:Chardonnay a owl:Class ; rdfs:subClassOf ex:WhiteWine .
            ex:bottle a ex:Chardonnay ; ex:madeFrom ex:grape .

            ex:madeInto owl:inverseOf ex:madeFrom .
            ex:adjacent a owl:SymmetricProperty .
            ex:regionA ex:adjacent ex:regionB .
        """,
        format=RdfFormat.TURTLE,
        to_graph=NamedNode("urn:test:asserted"),
    )
    return store


def _has_inferred(store: Store, subject: str, predicate: NamedNode, object_iri: str) -> bool:
    return bool(
        list(
            store.quads_for_pattern(
                NamedNode(subject),
                predicate,
                NamedNode(object_iri),
                DEFAULT_INFERRED_GRAPH,
            )
        )
    )


def test_wine_profile_materializes_hierarchy_inverse_and_symmetry() -> None:
    store = _semantic_store()

    inferred_count = materialize_semantics(store, "rdfs-wine-parity")

    assert inferred_count > 0
    assert _has_inferred(store, f"{EX}WhiteWine", RDFS_SUBCLASS_OF, f"{EX}Wine")
    assert _has_inferred(store, f"{EX}Chardonnay", RDFS_SUBCLASS_OF, f"{EX}Wine")
    assert _has_inferred(store, f"{EX}bottle", RDF_TYPE, f"{EX}Wine")
    assert _has_inferred(
        store,
        f"{EX}grape",
        NamedNode(f"{EX}madeInto"),
        f"{EX}bottle",
    )
    assert _has_inferred(
        store,
        f"{EX}regionB",
        NamedNode(f"{EX}adjacent"),
        f"{EX}regionA",
    )


def test_none_profile_does_not_add_triples() -> None:
    store = _semantic_store()
    before = len(store)

    assert materialize_semantics(store, "none") == 0
    assert len(store) == before


def test_unknown_profile_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported reasoning profile"):
        materialize_semantics(_semantic_store(), "unknown")