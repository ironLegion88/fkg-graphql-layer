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
    PathOptions,
    PathResult,
    PathStatus,
    GraphPath,
    ComparisonResult,
    SearchOptions,
    SearchResult,
    ExpansionPreview,
    PreviewGroup,
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

    async def search(self, options: SearchOptions) -> SearchResult:
        # Dummy implementation
        return SearchResult(entities=tuple(), total_matches=0)

    async def get_expansion_preview(self, entity_id: str) -> ExpansionPreview:
        return ExpansionPreview(entity_id=entity_id, total_count=0, groups=tuple())

    async def find_shortest_path(self, source_id: str, target_id: str, options: PathOptions) -> PathResult:
        if source_id == target_id:
            return PathResult(status=PathStatus.SUCCESS, path=GraphPath(entities=(self.entities[source_id],), relations=()), visited_nodes=1)
        queue = [(source_id, [source_id], [])]
        visited = {source_id}
        while queue:
            current, path_ids, path_rels = queue.pop(0)
            if len(path_ids) - 1 >= options.max_depth:
                continue
            for rel in self.relationships:
                if rel.source.id == current and rel.target.id not in visited:
                    next_id = rel.target.id
                    rel_name = rel.relation
                    if next_id == target_id:
                        entities = [self.entities[i] for i in path_ids + [next_id]]
                        path = GraphPath(entities=tuple(entities), relations=tuple(path_rels + [rel_name]))
                        return PathResult(status=PathStatus.SUCCESS, path=path, visited_nodes=len(visited)+1)
                    visited.add(next_id)
                    queue.append((next_id, path_ids + [next_id], path_rels + [rel_name]))
                elif rel.target.id == current and rel.source.id not in visited:
                    next_id = rel.source.id
                    rel_name = rel.relation
                    if next_id == target_id:
                        entities = [self.entities[i] for i in path_ids + [next_id]]
                        path = GraphPath(entities=tuple(entities), relations=tuple(path_rels + [rel_name]))
                        return PathResult(status=PathStatus.SUCCESS, path=path, visited_nodes=len(visited)+1)
                    visited.add(next_id)
                    queue.append((next_id, path_ids + [next_id], path_rels + [rel_name]))
        return PathResult(status=PathStatus.NO_PATH)


    async def compare_entities(self, id_a: str, id_b: str) -> ComparisonResult:
        return ComparisonResult(tuple(), tuple(), tuple(), tuple(), tuple(), tuple(), tuple())

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