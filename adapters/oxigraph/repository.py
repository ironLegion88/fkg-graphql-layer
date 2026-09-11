"""Database-neutral graph retrieval backed by an embedded PyOxigraph store."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path

from pyoxigraph import Literal, NamedNode, Store, Variable

from domain.models import (
    GraphEntity,
    GraphExpansion,
    GraphRelationship,
    SemanticResourceKind,
    UNKNOWN_KIND,
    TraversalDirection,
    TraversalOptions,
)
from domain.ontology_profile import OntologyPackage
from domain.traversal import paginate_relationships
from services.exceptions import GraphBackendError


RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
RDFS_LABEL = NamedNode("http://www.w3.org/2000/01/rdf-schema#label")
RDFS_COMMENT = NamedNode("http://www.w3.org/2000/01/rdf-schema#comment")
INFERRED_GRAPH = NamedNode("urn:fkg:graph:inferred")


@dataclass(frozen=True, slots=True)
class OxigraphSettings:
    """Location and language preferences for a promoted embedded store."""

    store_root: Path
    label_languages: tuple[str, ...] = ("en", "ANY")

    @classmethod
    def from_environment(cls) -> "OxigraphSettings":
        root = Path(os.getenv("RDF_STORE_PATH", ".data/oxigraph"))
        languages = tuple(
            language.strip()
            for language in os.getenv("RDF_LABEL_LANGUAGES", "en,ANY").split(",")
            if language.strip()
        )
        return cls(root, languages or ("ANY",))

    def active_store_path(self) -> Path:
        pointer_path = self.store_root / "current.json"
        if not pointer_path.is_file():
            raise GraphBackendError(f"Embedded graph store is not ready: {pointer_path}")
        pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
        relative_build_path = pointer.get("path")
        if not isinstance(relative_build_path, str):
            raise GraphBackendError("Embedded graph store pointer is invalid")
        store_path = self.store_root / relative_build_path / "store"
        if not store_path.is_dir():
            raise GraphBackendError(f"Embedded graph store does not exist: {store_path}")
        return store_path


class OxigraphGraphRepository:
    """Execute bounded graph operations against a persistent RDF store."""

    def __init__(
        self,
        profile: OntologyPackage,
        settings: OxigraphSettings | None = None,
        store: Store | None = None,
    ) -> None:
        self._profile = profile
        self._settings = settings or OxigraphSettings.from_environment()
        self._store = (
            store
            if store is not None
            else Store.read_only(str(self._settings.active_store_path()))
        )

    def _resolve_iri(self, term: str) -> str:
        """Resolve a compact IRI or local name to a full IRI."""
        if ":" in term and not term.startswith("http"):
            prefix, local = term.split(":", 1)
            if prefix in self._profile.prefixes.prefixes:
                return self._profile.prefixes.prefixes[prefix] + local
        # If no prefix and not http, assume base_iri
        if not term.startswith("http"):
            return self._profile.prefixes.base_iri + term
        return term

    async def get_entity(self, entity_id: str) -> GraphEntity | None:
        return await asyncio.to_thread(self._get_entity, entity_id)

    async def search_entities(self, query: str, limit: int = 250) -> list[GraphEntity]:
        if limit <= 0:
            return []
        return await asyncio.to_thread(self._search_entities, query, limit)

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]:
        relationships = await self.get_relationships(entity_id)
        unique: dict[str, GraphEntity] = {}
        for relationship in relationships:
            neighbor = (
                relationship.target
                if relationship.source.id == entity_id
                else relationship.source
            )
            unique.setdefault(neighbor.id, neighbor)
        return list(unique.values())

    async def get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions | None = None,
    ) -> list[GraphRelationship]:
        return await asyncio.to_thread(
            self._get_relationships,
            entity_id,
            options or TraversalOptions(),
        )

    async def expand_graph(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> GraphExpansion:
        return await asyncio.to_thread(self._expand_graph, entity_id, options)

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
        traversable = self._profile.predicates.traversable_predicates
        if relation not in traversable:
            allowed = ", ".join(sorted(traversable))
            raise GraphBackendError(
                f"Unsupported graph relation '{relation}'. Allowed: {allowed}"
            )
        relationships = await self.get_relationships(
            entity_id,
            TraversalOptions(relations=(relation,)),
        )
        return [
            relationship.target
            if relationship.source.id == entity_id
            else relationship.source
            for relationship in relationships
        ]

    def _get_entity(self, entity_id: str) -> GraphEntity | None:
        entity_node = NamedNode(entity_id)
        if not any(self._store.quads_for_pattern(entity_node, None, None, None)):
            return None
        return GraphEntity(
            id=entity_id,
            label=self._label_for(entity_node),
            kind=self._kind_for(entity_node),
            description=self._literal_value(entity_node, RDFS_COMMENT),
        )

    def _search_entities(self, query: str, limit: int) -> list[GraphEntity]:
        searchable_types = []
        for term in self._profile.search.searchable_classes:
            iri = self._resolve_iri(term)
            searchable_types.append(f"<{iri}>")

        if not searchable_types:
            return []

        type_values = " ".join(searchable_types)
        sparql = f"""
            SELECT DISTINCT ?entity ?needle
            WHERE {{
              VALUES ?entityType {{ {type_values} }}
              ?entity a ?entityType .
              OPTIONAL {{ ?entity <{RDFS_LABEL.value}> ?label . }}
              FILTER(
                CONTAINS(LCASE(STR(?entity)), LCASE(STR(?needle))) ||
                (BOUND(?label) && CONTAINS(LCASE(STR(?label)), LCASE(STR(?needle))))
              )
            }}
            ORDER BY LCASE(STR(?entity))
            LIMIT {int(limit)}
        """
        results: list[GraphEntity] = []
        for solution in self._store.query(
            sparql,
            use_default_graph_as_union=True,
            substitutions={Variable("needle"): Literal(query)},
        ):
            entity_node = solution["entity"]
            if isinstance(entity_node, NamedNode):
                entity = self._get_entity(entity_node.value)
                if entity is not None and entity.kind != UNKNOWN_KIND:
                    results.append(entity)
        return results

    def _get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions,
        *,
        apply_limit: bool = True,
    ) -> list[GraphRelationship]:
        entity_node = NamedNode(entity_id)
        relation_names = options.relations or self._profile.predicates.traversable_predicates
        entity_cache: dict[str, GraphEntity | None] = {}
        relationships: dict[tuple[str, str, str], GraphRelationship] = {}

        def entity(iri: str) -> GraphEntity | None:
            if iri not in entity_cache:
                entity_cache[iri] = self._get_entity(iri)
            return entity_cache[iri]

        for relation_name in relation_names:
            predicate_iri = self._resolve_iri(relation_name)
            predicate = NamedNode(predicate_iri)
            if options.direction in (TraversalDirection.OUTGOING, TraversalDirection.BOTH):
                for quad in self._store.quads_for_pattern(entity_node, predicate, None, None):
                    if not options.include_inferred and quad.graph_name == INFERRED_GRAPH:
                        continue
                    if not isinstance(quad.object, NamedNode):
                        continue
                    source = entity(entity_id)
                    target = entity(quad.object.value)
                    if source is not None and target is not None:
                        relationship = GraphRelationship(source, target, relation_name)
                        relationships.setdefault(
                            (source.id, target.id, relation_name), relationship
                        )
            if options.direction in (TraversalDirection.INCOMING, TraversalDirection.BOTH):
                for quad in self._store.quads_for_pattern(None, predicate, entity_node, None):
                    if not options.include_inferred and quad.graph_name == INFERRED_GRAPH:
                        continue
                    if not isinstance(quad.subject, NamedNode):
                        continue
                    source = entity(quad.subject.value)
                    target = entity(entity_id)
                    if source is not None and target is not None:
                        relationship = GraphRelationship(source, target, relation_name)
                        relationships.setdefault(
                            (source.id, target.id, relation_name), relationship
                        )
            if apply_limit and len(relationships) >= options.edge_limit:
                break
        values = list(relationships.values())
        return values[: options.edge_limit] if apply_limit else values

    def _expand_graph(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> GraphExpansion:
        center = self._get_entity(entity_id)
        if center is None:
            raise ValueError(f"No graph entity exists with id '{entity_id}'")
        relationships = self._get_relationships(
            entity_id,
            options,
            apply_limit=False,
        )
        return paginate_relationships(center, relationships, options)

    def _kind_for(self, entity: NamedNode) -> SemanticResourceKind:
        for cat_name, cat_config in self._profile.categories.items():
            for class_term in cat_config.class_iris:
                class_iri = self._resolve_iri(class_term)
                type_node = NamedNode(class_iri)
                if any(self._store.quads_for_pattern(entity, RDF_TYPE, type_node, None)):
                    return cat_name
        return UNKNOWN_KIND

    def _label_for(self, entity: NamedNode) -> str:
        labels = [
            quad.object
            for quad in self._store.quads_for_pattern(entity, RDFS_LABEL, None, None)
            if isinstance(quad.object, Literal)
        ]
        for preferred_language in self._settings.label_languages:
            for label in labels:
                if preferred_language == "ANY" or label.language == preferred_language:
                    return label.value
        if labels:
            return labels[0].value
        return _iri_local_name(entity.value)

    def _literal_value(self, entity: NamedNode, predicate: NamedNode) -> str | None:
        for quad in self._store.quads_for_pattern(entity, predicate, None, None):
            if isinstance(quad.object, Literal):
                return quad.object.value
        return None


def _iri_local_name(iri: str) -> str:
    local_name = iri.rsplit("#", maxsplit=1)[-1]
    return local_name if local_name != iri else iri.rstrip("/").rsplit("/", maxsplit=1)[-1]
