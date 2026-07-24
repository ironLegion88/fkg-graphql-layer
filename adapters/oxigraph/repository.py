"""Database-neutral graph retrieval backed by an embedded PyOxigraph store."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path

from pyoxigraph import Literal, NamedNode, Store, Variable

from domain.models import (
    EntityKind,
    GraphEntity,
    GraphRelationship,
    TraversalDirection,
    TraversalOptions,
)
from services.exceptions import GraphBackendError


WINE_NAMESPACE = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"
RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
RDFS_LABEL = NamedNode("http://www.w3.org/2000/01/rdf-schema#label")
RDFS_COMMENT = NamedNode("http://www.w3.org/2000/01/rdf-schema#comment")
INFERRED_GRAPH = NamedNode("urn:fkg:graph:inferred")

TYPE_BY_KIND = {
    EntityKind.WINE: NamedNode(f"{WINE_NAMESPACE}Wine"),
    EntityKind.WINERY: NamedNode(f"{WINE_NAMESPACE}Winery"),
    EntityKind.REGION: NamedNode(f"{WINE_NAMESPACE}Region"),
    EntityKind.GRAPE: NamedNode(f"{WINE_NAMESPACE}WineGrape"),
}
RELATION_BY_NAME = {
    "hasMaker": NamedNode(f"{WINE_NAMESPACE}hasMaker"),
    "locatedIn": NamedNode(f"{WINE_NAMESPACE}locatedIn"),
    "madeFromGrape": NamedNode(f"{WINE_NAMESPACE}madeFromGrape"),
    "adjacentRegion": NamedNode(f"{WINE_NAMESPACE}adjacentRegion"),
}


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
        settings: OxigraphSettings | None = None,
        store: Store | None = None,
    ) -> None:
        self._settings = settings or OxigraphSettings.from_environment()
        self._store = (
            store
            if store is not None
            else Store.read_only(str(self._settings.active_store_path()))
        )

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

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
        if relation not in RELATION_BY_NAME:
            allowed = ", ".join(sorted(RELATION_BY_NAME))
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

    async def get_wines_by_region(self, region_id: str) -> list[GraphEntity]:
        return await self._related_wines("locatedIn", region_id)

    async def get_wines_by_grape(self, grape_id: str) -> list[GraphEntity]:
        return await self._related_wines("madeFromGrape", grape_id)

    async def _related_wines(
        self,
        relation: str,
        target_id: str,
    ) -> list[GraphEntity]:
        relationships = await self.get_relationships(
            target_id,
            TraversalOptions(
                direction=TraversalDirection.INCOMING,
                relations=(relation,),
            ),
        )
        return [
            relationship.source
            for relationship in relationships
            if relationship.source.kind is EntityKind.WINE
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
        type_values = " ".join(f"<{type_node.value}>" for type_node in TYPE_BY_KIND.values())
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
                if entity is not None and entity.kind is not EntityKind.UNKNOWN:
                    results.append(entity)
        return results

    def _get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> list[GraphRelationship]:
        entity_node = NamedNode(entity_id)
        relation_names = options.relations or tuple(RELATION_BY_NAME)
        entity_cache: dict[str, GraphEntity | None] = {}
        relationships: dict[tuple[str, str, str], GraphRelationship] = {}

        def entity(iri: str) -> GraphEntity | None:
            if iri not in entity_cache:
                entity_cache[iri] = self._get_entity(iri)
            return entity_cache[iri]

        for relation_name in relation_names:
            predicate = RELATION_BY_NAME.get(relation_name)
            if predicate is None:
                continue
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
            if len(relationships) >= options.edge_limit:
                break
        return list(relationships.values())[: options.edge_limit]

    def _kind_for(self, entity: NamedNode) -> EntityKind:
        for kind, type_node in TYPE_BY_KIND.items():
            if any(self._store.quads_for_pattern(entity, RDF_TYPE, type_node, None)):
                return kind
        return EntityKind.UNKNOWN

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