"""Database-neutral ports implemented by graph storage adapters."""

from __future__ import annotations

from typing import Protocol

from domain.models import (
    GraphEntity,
    GraphExpansion,
    GraphRelationship,
    TraversalOptions,
    SearchOptions,
    SearchResult,
    ExpansionPreview,
    PathResult,
    ComparisonResult,
    PathOptions,
)
from domain.semantic_models import ResourceMetadata, ClassInfo, PropertyInfo


class GraphRepository(Protocol):
    """Storage-agnostic operations required by the graph application service."""

    async def get_entity(self, entity_id: str) -> GraphEntity | None: ...

    async def search_entities(self, query: str, limit: int = 250) -> list[GraphEntity]: ...

    async def search(self, options: SearchOptions) -> SearchResult: ...

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]: ...

    async def get_expansion_preview(self, entity_id: str) -> ExpansionPreview: ...

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

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
        """Expand a single generic relation. Deprecated: use expand_graph instead."""

    async def find_shortest_path(
        self,
        source_id: str,
        target_id: str,
        options: PathOptions,
    ) -> PathResult: ...

    async def compare_entities(
        self,
        id_a: str,
        id_b: str,
    ) -> ComparisonResult: ...


class SemanticRepository(Protocol):
    async def get_resource_metadata(self, iri: str) -> ResourceMetadata | None: ...
    async def get_class_info(self, class_iri: str) -> ClassInfo | None: ...
    async def get_property_info(self, property_iri: str) -> PropertyInfo | None: ...
    async def list_classes(self, limit: int = 100, offset: int = 0) -> list[ClassInfo]: ...
    async def list_properties(self, limit: int = 100, offset: int = 0) -> list[PropertyInfo]: ...