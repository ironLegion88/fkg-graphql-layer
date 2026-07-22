"""Public, database-agnostic Strawberry GraphQL schema.

Resolvers depend only on ``GraphService``. GraphDB-specific GraphQL documents are
contained behind the service and retrieval boundaries.
"""

from __future__ import annotations

from typing import TypedDict

import strawberry
from graphql import GraphQLError
from strawberry.schema.config import StrawberryConfig
from strawberry.types import Info

from domain.models import EntityKind, GraphEntity, GraphRelationship as DomainGraphRelationship
from services.exceptions import EntityNotFoundError, GraphServiceError
from services.graph_service import GraphService


class GraphQLContext(TypedDict):
    """Request dependencies available to Strawberry resolvers."""

    graph_service: GraphService


@strawberry.interface
class Entity:
    """A stable representation of any node in the knowledge graph."""

    id: strawberry.ID
    label: str
    description: str | None


@strawberry.type
class Wine(Entity):
    pass


@strawberry.type
class Winery(Entity):
    pass


@strawberry.type
class Region(Entity):
    pass


@strawberry.type
class Grape(Entity):
    pass


@strawberry.type
class GenericEntity(Entity):
    """A node whose backend ontology type is outside the Wine facade's core types."""


@strawberry.type
class GraphRelationship:
    """A directed and labelled edge suitable for graph visualization clients."""

    source: Entity
    target: Entity
    relation: str


def _to_api_entity(entity: GraphEntity) -> Entity:
    """Convert database-neutral domain objects into stable public GraphQL types."""
    common = {
        "id": strawberry.ID(entity.id),
        "label": entity.label,
        "description": entity.description,
    }
    match entity.kind:
        case EntityKind.WINE:
            return Wine(**common)
        case EntityKind.WINERY:
            return Winery(**common)
        case EntityKind.REGION:
            return Region(**common)
        case EntityKind.GRAPE:
            return Grape(**common)
        case EntityKind.UNKNOWN:
            return GenericEntity(**common)


def _to_api_relationship(relationship: DomainGraphRelationship) -> GraphRelationship:
    return GraphRelationship(
        source=_to_api_entity(relationship.source),
        target=_to_api_entity(relationship.target),
        relation=relationship.relation,
    )


def _graph_service(info: Info[GraphQLContext, None]) -> GraphService:
    return info.context["graph_service"]


async def _resolve_entity(operation: object) -> Entity:
    """Translate service errors into intentionally database-agnostic GraphQL errors."""
    try:
        entity = await operation  # type: ignore[union-attr]
    except EntityNotFoundError as error:
        raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
    except GraphServiceError as error:
        raise GraphQLError(
            "The graph service is unavailable",
            extensions={"code": "GRAPH_BACKEND_ERROR"},
        ) from error
    return _to_api_entity(entity)  # type: ignore[arg-type]


@strawberry.type
class Query:
    """Queries exposed to UI and LLM clients."""

    @strawberry.field
    async def get_wine(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> Wine:
        entity = await _resolve_entity(_graph_service(info).get_wine(str(id)))
        if not isinstance(entity, Wine):
            raise GraphQLError("The requested entity is not a wine", extensions={"code": "NOT_FOUND"})
        return entity

    @strawberry.field
    async def get_entity(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> Entity:
        return await _resolve_entity(_graph_service(info).get_entity(str(id)))

    @strawberry.field
    async def search_entities(
        self,
        info: Info[GraphQLContext, None],
        query: str,
    ) -> list[Entity]:
        try:
            entities = await _graph_service(info).search_entities(query)
        except GraphServiceError as error:
            raise GraphQLError(
                "The graph service is unavailable",
                extensions={"code": "GRAPH_BACKEND_ERROR"},
            ) from error
        return [_to_api_entity(entity) for entity in entities]

    @strawberry.field
    async def get_neighbors(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> list[Entity]:
        try:
            entities = await _graph_service(info).get_neighbors(str(id))
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except GraphServiceError as error:
            raise GraphQLError(
                "The graph service is unavailable",
                extensions={"code": "GRAPH_BACKEND_ERROR"},
            ) from error
        return [_to_api_entity(entity) for entity in entities]

    @strawberry.field
    async def get_relationships(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> list[GraphRelationship]:
        try:
            relationships = await _graph_service(info).get_relationships(str(id))
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except GraphServiceError as error:
            raise GraphQLError(
                "The graph service is unavailable",
                extensions={"code": "GRAPH_BACKEND_ERROR"},
            ) from error
        return [_to_api_relationship(relationship) for relationship in relationships]

    @strawberry.field
    async def expand(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
        relation: str,
    ) -> list[Entity]:
        try:
            entities = await _graph_service(info).expand(str(id), relation)
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except GraphServiceError as error:
            raise GraphQLError(
                "The graph service is unavailable",
                extensions={"code": "GRAPH_BACKEND_ERROR"},
            ) from error
        return [_to_api_entity(entity) for entity in entities]


schema = strawberry.Schema(
    query=Query,
    types=[Wine, Winery, Region, Grape, GenericEntity, GraphRelationship],
    config=StrawberryConfig(auto_camel_case=False),
)
