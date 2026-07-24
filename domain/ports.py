"""Database-neutral ports implemented by graph storage adapters."""

from __future__ import annotations

from typing import Protocol

from domain.models import GraphEntity, GraphExpansion, GraphRelationship, TraversalOptions


class GraphRepository(Protocol):
    """Storage-agnostic operations required by the graph application service."""

    async def get_entity(self, entity_id: str) -> GraphEntity | None: ...

    async def search_entities(
        self,
        query: str,
        limit: int = 250,
    ) -> list[GraphEntity]: ...

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]: ...

    async def get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions | None = None,
    ) -> list[GraphRelationship]: ...

    async def expand_graph(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> GraphExpansion: ...

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]: ...

    async def get_wines_by_region(self, region_id: str) -> list[GraphEntity]: ...

    async def get_wines_by_grape(self, grape_id: str) -> list[GraphEntity]: ...