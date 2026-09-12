"""Database-neutral domain facade used by the public GraphQL API."""

from __future__ import annotations

import warnings
from collections import deque
from dataclasses import dataclass, replace

from domain.models import (
    GraphEntity,
    GraphExpansion,
    GraphPath,
    GraphRelationship,
    PageInfo,
    TraversalOptions,
    TraversalDirection,
    SearchOptions,
    SearchResult,
    ExpansionPreview,
    PathOptions,
    PathResult,
    ComparisonResult,
)
from domain.ports import GraphRepository
from domain.ontology_profile import OntologyPackage
from services.exceptions import EntityNotFoundError, InvalidTraversalError


@dataclass(frozen=True, slots=True)
class GraphServiceLimits:
    """Server-owned hard limits for graph traversal operations."""

    max_depth: int = 1
    max_nodes: int = 2_000
    max_edges: int = 4_000

    @classmethod
    def from_profile(cls, profile: OntologyPackage) -> GraphServiceLimits:
        return cls(
            max_depth=profile.limits.max_depth,
            max_nodes=profile.limits.max_nodes,
            max_edges=profile.limits.max_edges,
        )


class GraphService:
    """Apply domain rules while delegating all persistence to the retrieval service."""

    def __init__(
        self,
        repository: GraphRepository,
        profile: OntologyPackage,
    ) -> None:
        self._repository = repository
        self._profile = profile
        self._limits = GraphServiceLimits.from_profile(profile)

    def get_active_profile(self) -> OntologyPackage:
        """Expose the active ontology profile metadata."""
        return self._profile

    async def get_entity(self, entity_id: str) -> GraphEntity:
        entity = await self._repository.get_entity(entity_id)
        if entity is None:
            raise EntityNotFoundError(f"No graph entity exists with id '{entity_id}'")
        return entity

    async def get_wine(self, entity_id: str) -> GraphEntity:
        """Return a Wine only, preserving the public API's concrete type contract."""
        warnings.warn("get_wine() is deprecated", DeprecationWarning, stacklevel=2)
        entity = await self.get_entity(entity_id)
        if entity.kind != "Wine":
            raise EntityNotFoundError(f"No wine exists with id '{entity_id}'")
        return entity

    async def search_entities(self, query: str) -> list[GraphEntity]:
        normalized_query = query.strip()
        if not normalized_query:
            return []
        return await self._repository.search_entities(normalized_query)

    async def search(self, options: SearchOptions) -> SearchResult:
        normalized_query = options.query.strip()
        if not normalized_query:
            return SearchResult(entities=(), total_matches=0)
        
        # apply limits bounds
        bounded_limit = min(max(options.limit, 1), self._profile.limits.max_nodes)
        bounded_offset = max(options.offset, 0)
        
        bounded_options = SearchOptions(
            query=normalized_query,
            limit=bounded_limit,
            offset=bounded_offset,
            kinds=options.kinds,
            require_description=options.require_description
        )
        return await self._repository.search(bounded_options)

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]:
        await self.get_entity(entity_id)
        return await self._repository.get_neighbors(entity_id)

    async def get_expansion_preview(self, entity_id: str) -> ExpansionPreview:
        await self.get_entity(entity_id)
        return await self._repository.get_expansion_preview(entity_id)

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
        options: PathOptions | None = None,
    ) -> PathResult:
        await self.get_entity(entity_a)
        await self.get_entity(entity_b)
        if options is None:
            options = PathOptions()
        return await self._repository.find_shortest_path(entity_a, entity_b, options)

    async def compare_entities(
        self,
        id_a: str,
        id_b: str,
    ) -> ComparisonResult:
        await self.get_entity(id_a)
        await self.get_entity(id_b)
        return await self._repository.compare_entities(id_a, id_b)

    async def get_wines_by_region(
self, region_id: str) -> list[GraphEntity]:
        warnings.warn("get_wines_by_region is deprecated", DeprecationWarning, stacklevel=2)
        options = TraversalOptions(direction=TraversalDirection.INCOMING, relations=("locatedIn",), node_limit=1000, edge_limit=1000)
        rels = await self._repository.get_relationships(region_id, options)
        wines: list[GraphEntity] = []
        wines.extend(r.source for r in rels if r.source.kind == "Wine")
        return wines

    async def get_wines_by_grape(self, grape_id: str) -> list[GraphEntity]:
        warnings.warn("get_wines_by_grape is deprecated", DeprecationWarning, stacklevel=2)
        options = TraversalOptions(direction=TraversalDirection.INCOMING, relations=("madeFromGrape",), node_limit=1000, edge_limit=1000)
        rels = await self._repository.get_relationships(grape_id, options)
        wines: list[GraphEntity] = []
        wines.extend(r.source for r in rels if r.source.kind == "Wine")
        return wines

    def _normalize_traversal(self, options: TraversalOptions) -> TraversalOptions:
        if options.max_depth <= 0 or options.max_depth > self._limits.max_depth:
            raise InvalidTraversalError(
                f"max_depth must be between 1 and {self._limits.max_depth}"
            )
        if options.node_limit <= 0 or options.edge_limit <= 0:
            raise InvalidTraversalError("node_limit and edge_limit must be positive")

        # Validate requested relations against profile's traversable predicates
        requested = [r.strip() for r in options.relations if r.strip()]
        traversable = self._profile.predicates.traversable_predicates
        for req in requested:
            if req not in traversable:
                raise InvalidTraversalError(f"Relation '{req}' is not a traversable predicate in the active profile")

        relations = tuple(dict.fromkeys(requested))
        return replace(
            options,
            relations=relations,
            node_limit=min(options.node_limit, self._limits.max_nodes),
            edge_limit=min(options.edge_limit, self._limits.max_edges),
        )
