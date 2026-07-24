"""Database-neutral domain facade used by the public GraphQL API."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, replace

from domain.models import (
    EntityKind,
    GraphEntity,
    GraphExpansion,
    GraphPath,
    GraphRelationship,
    TraversalOptions,
)
from domain.ports import GraphRepository
from services.exceptions import EntityNotFoundError, InvalidTraversalError


@dataclass(frozen=True, slots=True)
class GraphServiceLimits:
    """Server-owned hard limits for graph traversal operations."""

    max_depth: int = 1
    max_nodes: int = 2_000
    max_edges: int = 4_000


class GraphService:
    """Apply domain rules while delegating all persistence to the retrieval service."""

    def __init__(
        self,
        repository: GraphRepository,
        limits: GraphServiceLimits | None = None,
    ) -> None:
        self._repository = repository
        self._limits = limits or GraphServiceLimits()

    async def get_entity(self, entity_id: str) -> GraphEntity:
        entity = await self._repository.get_entity(entity_id)
        if entity is None:
            raise EntityNotFoundError(f"No graph entity exists with id '{entity_id}'")
        return entity

    async def get_wine(self, entity_id: str) -> GraphEntity:
        """Return a Wine only, preserving the public API's concrete type contract."""
        entity = await self.get_entity(entity_id)
        if entity.kind is not EntityKind.WINE:
            raise EntityNotFoundError(f"No wine exists with id '{entity_id}'")
        return entity

    async def search_entities(self, query: str) -> list[GraphEntity]:
        normalized_query = query.strip()
        if not normalized_query:
            return []
        return await self._repository.search_entities(normalized_query)

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]:
        await self.get_entity(entity_id)
        return await self._repository.get_neighbors(entity_id)

    async def get_relationships(self, entity_id: str) -> list[GraphRelationship]:
        """Return labelled edges touching an entity in either graph direction."""
        await self.get_entity(entity_id)
        return await self._repository.get_relationships(entity_id)

    async def expand_graph(
        self,
        entity_id: str,
        options: TraversalOptions | None = None,
    ) -> GraphExpansion:
        """Return one server-bounded graph page around an existing entity."""
        await self.get_entity(entity_id)
        traversal = self._normalize_traversal(options or TraversalOptions())
        try:
            return await self._repository.expand_graph(entity_id, traversal)
        except ValueError as error:
            raise InvalidTraversalError(str(error)) from error

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
        if not relation.strip():
            return []
        await self.get_entity(entity_id)
        return await self._repository.expand(entity_id, relation.strip())

    async def find_path(
        self,
        entity_a: str,
        entity_b: str,
        max_depth: int = 4,
    ) -> GraphPath | None:
        """Find a bounded shortest node path using the backend-agnostic neighbor API.

        A production graph backend can replace this with native path traversal while
        preserving this method's return type and public contract.
        """
        start = await self.get_entity(entity_a)
        target = await self.get_entity(entity_b)
        if start.id == target.id:
            return GraphPath(entities=(start,), relations=())

        pending: deque[tuple[GraphEntity, tuple[GraphEntity, ...], tuple[str, ...]]] = deque(
            [(start, (start,), ())]
        )
        visited = {start.id}
        while pending:
            current, path, relations = pending.popleft()
            if len(relations) >= max_depth:
                continue
            for relationship in await self.get_relationships(current.id):
                neighbor = (
                    relationship.target
                    if relationship.source.id == current.id
                    else relationship.source
                )
                if neighbor.id in visited:
                    continue
                next_path = (*path, neighbor)
                next_relations = (*relations, relationship.relation)
                if neighbor.id == target.id:
                    return GraphPath(
                        entities=next_path,
                        relations=next_relations,
                    )
                visited.add(neighbor.id)
                pending.append((neighbor, next_path, next_relations))
        return None

    async def get_wines_by_region(self, region_id: str) -> list[GraphEntity]:
        return await self._repository.get_wines_by_region(region_id)

    async def get_wines_by_grape(self, grape_id: str) -> list[GraphEntity]:
        return await self._repository.get_wines_by_grape(grape_id)

    def _normalize_traversal(self, options: TraversalOptions) -> TraversalOptions:
        if options.max_depth <= 0 or options.max_depth > self._limits.max_depth:
            raise InvalidTraversalError(
                f"max_depth must be between 1 and {self._limits.max_depth}"
            )
        if options.node_limit <= 0 or options.edge_limit <= 0:
            raise InvalidTraversalError("node_limit and edge_limit must be positive")
        relations = tuple(
            dict.fromkeys(relation.strip() for relation in options.relations if relation.strip())
        )
        return replace(
            options,
            relations=relations,
            node_limit=min(options.node_limit, self._limits.max_nodes),
            edge_limit=min(options.edge_limit, self._limits.max_edges),
        )
