"""GraphDB-specific GraphQL adapter for the W3C Sample Wines ontology.

This is the only module that knows the GraphDB endpoint and its generated GraphQL
shape. If GraphDB is replaced, implement this boundary for the new backend while
preserving the ``GraphEntity`` return values.
"""

from __future__ import annotations

import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

import httpx

from domain.models import (
    EntityKind,
    GraphEntity,
    GraphRelationship,
    TraversalDirection,
    TraversalOptions,
)
from services.exceptions import GraphBackendError


@dataclass(frozen=True, slots=True)
class GraphDBSettings:
    """Connection settings for GraphDB's native GraphQL endpoint."""

    base_url: str
    repository: str
    endpoint_id: str
    timeout_seconds: float = 15.0

    @classmethod
    def from_environment(cls) -> "GraphDBSettings":
        """Build settings from environment variables without leaking them upward."""
        base_url = os.getenv("GRAPHDB_BASE_URL", "http://localhost:7200").rstrip("/")
        repository = os.getenv("GRAPHDB_REPOSITORY", "wine")
        endpoint_id = os.getenv("GRAPHDB_ENDPOINT_ID", repository)
        timeout_seconds = float(os.getenv("GRAPHDB_TIMEOUT_SECONDS", "15"))
        return cls(
            base_url=base_url,
            repository=repository,
            endpoint_id=endpoint_id,
            timeout_seconds=timeout_seconds,
        )

    @property
    def graphql_url(self) -> str:
        return (
            f"{self.base_url}/rest/repositories/{self.repository}"
            f"/graphql/{self.endpoint_id}"
        )


class GraphRetrievalService:
    """Execute GraphDB GraphQL documents and return database-neutral entities.

    The documents below match the labeled Sample Wines endpoint: lower-case
    root fields, the generated ``WineGrape`` type, and ``displayName`` mapped
    from RDF ``rdfs:label`` by the endpoint schema.
    """

    _ENTITY_BY_ID_QUERY = """
                query EntityCollections {
                    wines: wine(limit: 250) {
                        id
                        displayName { value }
                        hasMaker { id displayName { value } }
                        locatedIn { id displayName { value } }
                        madeFromGrape { id displayName { value } }
                    }
                    wineries: winery(limit: 250) { id displayName { value } }
                    regions: region(limit: 250) {
                        id
                        displayName { value }
                        adjacentRegion { id displayName { value } }
                    }
                    grapes: wineGrape(limit: 250) { id displayName { value } }
        }
    """

    _SEARCH_QUERY = """
                query SearchEntities {
                      wines: wine(limit: 250) { id displayName { value } }
                      wineries: winery(limit: 250) { id displayName { value } }
                      regions: region(limit: 250) { id displayName { value } }
                      grapes: wineGrape(limit: 250) { id displayName { value } }
        }
    """

    _NEIGHBORS_QUERY = """
                query Neighbors {
                    wines: wine(limit: 250) {
                        id
                        hasMaker { id displayName { value } }
                        locatedIn { id displayName { value } }
                        madeFromGrape { id displayName { value } }
                    }
                    regions: region(limit: 250) {
                        id
                        adjacentRegion { id displayName { value } }
                    }
        }
    """

    _EXPANDABLE_RELATIONS = {
        "hasMaker",
        "locatedIn",
        "madeFromGrape",
        "adjacentRegion",
    }

    _WINES_BY_REGION_QUERY = """
                query WinesByRegion {
                    wines: wine(limit: 250) {
                        id
                        displayName { value }
                        locatedIn { id displayName { value } }
                    }
        }
    """

    _WINES_BY_GRAPE_QUERY = """
                query WinesByGrape {
                    wines: wine(limit: 250) {
                        id
                        displayName { value }
                        madeFromGrape { id displayName { value } }
                    }
        }
    """

    def __init__(
        self,
        settings: GraphDBSettings | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings or GraphDBSettings.from_environment()
        self._client = client

    async def get_entity(self, entity_id: str) -> GraphEntity | None:
        data = await self._execute_query(self._ENTITY_BY_ID_QUERY, {})
        for field_name, kind in self._kind_by_collection().items():
            entities = self._entities_from_value(data.get(field_name), kind)
            entity = next((item for item in entities if item.id == entity_id), None)
            if entity is not None:
                return entity
        return None

    async def search_entities(self, query: str, limit: int = 250) -> list[GraphEntity]:
        if limit <= 0:
            return []
        data = await self._execute_query(self._SEARCH_QUERY, {})
        normalized_query = query.casefold()
        return [
            entity
            for entity in self._collect_typed_entities(data)
            if normalized_query in entity.label.casefold() or normalized_query in entity.id.casefold()
        ][:limit]

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]:
        relationships = await self.get_relationships(entity_id)
        neighbors = [
            relationship.target
            if relationship.source.id == entity_id
            else relationship.source
            for relationship in relationships
        ]
        return self._deduplicate(neighbors)

    async def get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions | None = None,
    ) -> list[GraphRelationship]:
        """Return labelled edges touching an entity, including inferred inverse edges."""
        traversal = options or TraversalOptions()
        data = await self._execute_query(self._ENTITY_BY_ID_QUERY, {})
        relationships = [
            relationship
            for relationship in self._relationships_from_data(data)
            if self._relationship_matches(relationship, entity_id, traversal)
        ]
        return relationships[: traversal.edge_limit]

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
        """Expand one supported W3C Wine ontology relation from any core node type."""
        if relation not in self._EXPANDABLE_RELATIONS:
            allowed = ", ".join(sorted(self._EXPANDABLE_RELATIONS))
            raise GraphBackendError(f"Unsupported graph relation '{relation}'. Allowed: {allowed}")
        relationships = await self.get_relationships(entity_id)
        neighbors = [
            relationship.target
            if relationship.source.id == entity_id
            else relationship.source
            for relationship in relationships
            if relationship.relation == relation
        ]
        return self._deduplicate(neighbors)

    async def get_wines_by_region(self, region_id: str) -> list[GraphEntity]:
        data = await self._execute_query(
            self._WINES_BY_REGION_QUERY,
            {},
        )
        return self._wines_with_relation(data, "locatedIn", region_id)

    async def get_wines_by_grape(self, grape_id: str) -> list[GraphEntity]:
        data = await self._execute_query(
            self._WINES_BY_GRAPE_QUERY,
            {},
        )
        return self._wines_with_relation(data, "madeFromGrape", grape_id)

    async def _execute_query(
        self,
        query: str,
        variables: Mapping[str, Any],
    ) -> dict[str, Any]:
        """POST a native GraphDB GraphQL request and return its ``data`` object."""
        payload = {"query": query, "variables": dict(variables)}
        try:
            if self._client is not None:
                response = await self._client.post(self._settings.graphql_url, json=payload)
            else:
                async with httpx.AsyncClient(timeout=self._settings.timeout_seconds) as client:
                    response = await client.post(self._settings.graphql_url, json=payload)
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise GraphBackendError("GraphDB request failed") from error

        errors = body.get("errors")
        if errors:
            messages = "; ".join(error.get("message", "Unknown GraphQL error") for error in errors)
            raise GraphBackendError(f"GraphDB GraphQL error: {messages}")

        data = body.get("data")
        if not isinstance(data, dict):
            raise GraphBackendError("GraphDB response did not contain a GraphQL data object")
        return data

    @staticmethod
    def _kind_by_collection() -> dict[str, EntityKind]:
        return {
            "wines": EntityKind.WINE,
            "wineries": EntityKind.WINERY,
            "regions": EntityKind.REGION,
            "grapes": EntityKind.GRAPE,
        }

    def _collect_typed_entities(self, data: Mapping[str, Any]) -> list[GraphEntity]:
        entities: list[GraphEntity] = []
        for field_name, kind in self._kind_by_collection().items():
            entities.extend(self._entities_from_value(data.get(field_name), kind))
        return self._deduplicate(entities)

    def _collect_untyped_entities(self, value: Any) -> list[GraphEntity]:
        entities: list[GraphEntity] = []
        if isinstance(value, Mapping):
            if "id" in value:
                entities.append(self._to_entity(value))
            for nested_value in value.values():
                entities.extend(self._collect_untyped_entities(nested_value))
        elif isinstance(value, Sequence) and not isinstance(value, str):
            for item in value:
                entities.extend(self._collect_untyped_entities(item))
        return entities

    def _relationships_from_data(self, data: Mapping[str, Any]) -> list[GraphRelationship]:
        """Map GraphDB relations to canonical directed edges for the public graph."""
        relation_kinds = {
            "hasMaker": EntityKind.WINERY,
            "locatedIn": EntityKind.REGION,
            "madeFromGrape": EntityKind.GRAPE,
            "adjacentRegion": EntityKind.REGION,
        }
        collection_kinds = {
            "wines": EntityKind.WINE,
            "regions": EntityKind.REGION,
        }
        relationships: list[GraphRelationship] = []
        for collection, source_kind in collection_kinds.items():
            sources = data.get(collection)
            if not isinstance(sources, Sequence) or isinstance(sources, str):
                continue
            for source in sources:
                if not isinstance(source, Mapping):
                    continue
                source_entity = self._to_entity(source, source_kind)
                for relation_name, target_kind in relation_kinds.items():
                    related_value = source.get(relation_name)
                    if isinstance(related_value, Mapping):
                        relationships.append(
                            GraphRelationship(
                                source=source_entity,
                                target=self._to_entity(related_value, target_kind),
                                relation=relation_name,
                            )
                        )
                    else:
                        relationships.extend(
                            GraphRelationship(
                                source=source_entity,
                                target=target,
                                relation=relation_name,
                            )
                            for target in self._entities_from_value(related_value, target_kind)
                        )
        return self._deduplicate_relationships(relationships)

    def _wines_with_relation(
        self,
        data: Mapping[str, Any],
        relation: str,
        related_entity_id: str,
    ) -> list[GraphEntity]:
        wines = self._entities_from_value(data.get("wines"), EntityKind.WINE)
        matching_wine_ids = {
            item.get("id")
            for item in data.get("wines", [])
            if isinstance(item, Mapping)
            and any(
                isinstance(related, Mapping) and related.get("id") == related_entity_id
                for related in item.get(relation, [])
            )
        }
        return [wine for wine in wines if wine.id in matching_wine_ids]

    @staticmethod
    def _relationship_matches(
        relationship: GraphRelationship,
        entity_id: str,
        options: TraversalOptions,
    ) -> bool:
        if options.relations and relationship.relation not in options.relations:
            return False
        if options.direction is TraversalDirection.OUTGOING:
            return relationship.source.id == entity_id
        if options.direction is TraversalDirection.INCOMING:
            return relationship.target.id == entity_id
        return relationship.source.id == entity_id or relationship.target.id == entity_id

    def _entities_from_value(self, value: Any, kind: EntityKind) -> list[GraphEntity]:
        if not isinstance(value, Sequence) or isinstance(value, str):
            return []
        return [self._to_entity(item, kind) for item in value if isinstance(item, Mapping)]

    @staticmethod
    def _to_entity(value: Mapping[str, Any], kind: EntityKind = EntityKind.UNKNOWN) -> GraphEntity:
        identifier = value.get("id")
        if not isinstance(identifier, str):
            raise GraphBackendError("GraphDB returned an entity without a string id")
        inferred_kind = GraphRetrievalService._kind_from_value(value) or kind
        display_name = value.get("displayName")
        if isinstance(display_name, Mapping):
            display_name = display_name.get("value")
        label = display_name or value.get("label") or value.get("name")
        if label is None:
            label = identifier.rsplit("#", maxsplit=1)[-1]
        if label == identifier:
            label = identifier.rsplit("/", maxsplit=1)[-1]
        description = value.get("description")
        properties = {
            key: str(item)
            for key, item in value.items()
            if key not in {"id", "label", "name", "description", "type", "__typename"}
            and not isinstance(item, (Mapping, Sequence))
        }
        return GraphEntity(
            id=identifier,
            label=str(label),
            kind=inferred_kind,
            description=str(description) if description is not None else None,
            properties=properties,
        )

    @staticmethod
    def _kind_from_value(value: Mapping[str, Any]) -> EntityKind | None:
        type_name = str(value.get("__typename") or value.get("type") or "").upper()
        return EntityKind.__members__.get(type_name)

    @staticmethod
    def _deduplicate(entities: Sequence[GraphEntity]) -> list[GraphEntity]:
        unique: dict[str, GraphEntity] = {}
        for entity in entities:
            unique.setdefault(entity.id, entity)
        return list(unique.values())

    @staticmethod
    def _deduplicate_relationships(
        relationships: Sequence[GraphRelationship],
    ) -> list[GraphRelationship]:
        unique: dict[tuple[str, str, str], GraphRelationship] = {}
        for relationship in relationships:
            key = (
                relationship.source.id,
                relationship.target.id,
                relationship.relation,
            )
            unique.setdefault(key, relationship)
        return list(unique.values())
