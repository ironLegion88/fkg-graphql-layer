"""Database-neutral fakes shared by graph contract tests."""

from __future__ import annotations

from domain.models import (
    GraphEntity,
    GraphExpansion,
    GraphRelationship,
    SemanticResourceKind,
    UNKNOWN_KIND,
    TraversalDirection,
    TraversalOptions,
)
from domain.traversal import paginate_relationships


class FakeGraphRepository:
    """Small deterministic repository implementing the production port."""

    def __init__(
        self,
        entities: list[GraphEntity],
        relationships: list[GraphRelationship],
    ) -> None:
        self.entities = {entity.id: entity for entity in entities}
        self.relationships = relationships
        self.search_queries: list[str] = []

    async def get_entity(self, entity_id: str) -> GraphEntity | None:
        return self.entities.get(entity_id)

    async def search_entities(self, query: str, limit: int = 250) -> list[GraphEntity]:
        self.search_queries.append(query)
        normalized = query.casefold()
        return [
            entity
            for entity in self.entities.values()
            if normalized in entity.label.casefold() or normalized in entity.id.casefold()
        ][:limit]

    async def get_neighbors(self, entity_id: str) -> list[GraphEntity]:
        neighbors: dict[str, GraphEntity] = {}
        for relationship in await self.get_relationships(entity_id):
            neighbor = (
                relationship.target
                if relationship.source.id == entity_id
                else relationship.source
            )
            neighbors.setdefault(neighbor.id, neighbor)
        return list(neighbors.values())

    async def get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions | None = None,
    ) -> list[GraphRelationship]:
        traversal = options or TraversalOptions()
        matches = self._matching_relationships(entity_id, traversal)
        return matches[: traversal.edge_limit]

    async def expand_graph(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> GraphExpansion:
        center = self.entities.get(entity_id)
        if center is None:
            raise ValueError(f"No graph entity exists with id '{entity_id}'")
        return paginate_relationships(
            center,
            self._matching_relationships(entity_id, options),
            options,
        )

    def _matching_relationships(
        self,
        entity_id: str,
        traversal: TraversalOptions,
    ) -> list[GraphRelationship]:
        matches: list[GraphRelationship] = []
        for relationship in self.relationships:
            if traversal.relations and relationship.relation not in traversal.relations:
                continue
            if (
                traversal.direction is TraversalDirection.OUTGOING
                and relationship.source.id != entity_id
            ):
                continue
            if (
                traversal.direction is TraversalDirection.INCOMING
                and relationship.target.id != entity_id
            ):
                continue
            if (
                traversal.direction is TraversalDirection.BOTH
                and relationship.source.id != entity_id
                and relationship.target.id != entity_id
            ):
                continue
            matches.append(relationship)
        return matches

    async def expand(self, entity_id: str, relation: str) -> list[GraphEntity]:
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


def wine_graph_fixture() -> tuple[
    list[GraphEntity],
    list[GraphRelationship],
    dict[str, GraphEntity],
]:
    wine = GraphEntity("wine:demo", "Demo Wine", "Wine")
    winery = GraphEntity("winery:demo", "Demo Winery", "Winery")
    grape = GraphEntity("grape:demo", "Demo Grape", "Grape")
    region = GraphEntity("region:demo", "Demo Region", "Region")
    entities = {entity.id: entity for entity in (wine, winery, grape, region)}
    relationships = [
        GraphRelationship(wine, winery, "hasMaker"),
        GraphRelationship(wine, grape, "madeFromGrape"),
        GraphRelationship(wine, region, "locatedIn"),
    ]
    return list(entities.values()), relationships, entities