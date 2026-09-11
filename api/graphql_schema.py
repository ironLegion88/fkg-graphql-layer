"""Public, database-agnostic Strawberry GraphQL schema.

Resolvers depend only on ``GraphService``. GraphDB-specific GraphQL documents are
contained behind the service and retrieval boundaries.
"""

from __future__ import annotations

from enum import Enum
from typing import TypedDict

import strawberry
from graphql import GraphQLError
from strawberry.schema.config import StrawberryConfig
from strawberry.types import Info

from domain.models import (
    GraphEntity,
    GraphExpansion as DomainGraphExpansion,
    GraphRelationship as DomainGraphRelationship,
    TraversalDirection,
    TraversalOptions,
)
from services.exceptions import EntityNotFoundError, GraphServiceError, InvalidTraversalError
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


@strawberry.type(description="Deprecated: Use OntologyEntity instead")
class Wine(Entity):
    pass


@strawberry.type(description="Deprecated: Use OntologyEntity instead")
class Winery(Entity):
    pass


@strawberry.type(description="Deprecated: Use OntologyEntity instead")
class Region(Entity):
    pass


@strawberry.type(description="Deprecated: Use OntologyEntity instead")
class Grape(Entity):
    pass


@strawberry.type(description="Deprecated: Use OntologyEntity instead")
class GenericEntity(Entity):
    """A node whose backend ontology type is outside the Wine facade's core types."""


@strawberry.type
class OntologyEntity(Entity):
    """A generic profile-driven ontology entity."""
    kind: str


@strawberry.type
class OntologyProfileMetadata:
    package_id: str
    version: str
    title: str
    description: str
    ontology_iris: list[str]


@strawberry.type
class PrefixEntry:
    prefix: str
    iri: str


@strawberry.type
class SemanticCategory:
    name: str
    class_iris: list[str]
    color: str | None
    icon: str | None
    label: str | None


@strawberry.type
class PredicateInfo:
    name: str
    iri: str | None
    label: str | None
    traversable: bool
    hidden: bool


@strawberry.type
class ProfileLimits:
    max_depth: int
    max_nodes: int
    max_edges: int


@strawberry.type
class LanguageInfo:
    preferred_languages: list[str]


@strawberry.type
class ActiveProfile:
    metadata: OntologyProfileMetadata
    prefixes: list[PrefixEntry]
    categories: list[SemanticCategory]
    predicates: list[PredicateInfo]
    limits: ProfileLimits
    languages: LanguageInfo
    reasoning_profile: str
    build_id: str | None


@strawberry.type
class GraphRelationship:
    """A directed and labelled edge suitable for graph visualization clients."""

    source: Entity
    target: Entity
    relation: str


@strawberry.enum(name="TraversalDirection")
class TraversalDirectionValue(Enum):
    OUTGOING = "OUTGOING"
    INCOMING = "INCOMING"
    BOTH = "BOTH"


@strawberry.input
class TraversalInput:
    """Client-requested traversal values subject to stricter server limits."""

    direction: TraversalDirectionValue = TraversalDirectionValue.BOTH
    relations: list[str] | None = None
    max_depth: int = 1
    node_limit: int = 200
    edge_limit: int = 400
    cursor: str | None = None
    include_inferred: bool = True


@strawberry.type
class GraphPageInfo:
    truncated: bool
    next_cursor: str | None


@strawberry.type
class GraphExpansion:
    center: Entity
    nodes: list[Entity]
    relationships: list[GraphRelationship]
    page_info: GraphPageInfo


def _to_api_entity(entity: GraphEntity) -> Entity:
    """Convert database-neutral domain objects into stable public GraphQL types."""
    common = {
        "id": strawberry.ID(entity.id),
        "label": entity.label,
        "description": entity.description,
    }
    match entity.kind:
        case "Wine":
            return Wine(**common)
        case "Winery":
            return Winery(**common)
        case "Region":
            return Region(**common)
        case "Grape":
            return Grape(**common)
        case "Unknown":
            return GenericEntity(**common)
        case _:
            return OntologyEntity(kind=entity.kind, **common)


def _to_api_relationship(relationship: DomainGraphRelationship) -> GraphRelationship:
    return GraphRelationship(
        source=_to_api_entity(relationship.source),
        target=_to_api_entity(relationship.target),
        relation=relationship.relation,
    )


def _to_api_expansion(expansion: DomainGraphExpansion) -> GraphExpansion:
    return GraphExpansion(
        center=_to_api_entity(expansion.center),
        nodes=[_to_api_entity(entity) for entity in expansion.nodes],
        relationships=[
            _to_api_relationship(relationship)
            for relationship in expansion.relationships
        ],
        page_info=GraphPageInfo(
            truncated=expansion.page_info.truncated,
            next_cursor=expansion.page_info.next_cursor,
        ),
    )


def _to_domain_traversal(options: TraversalInput | None) -> TraversalOptions:
    if options is None:
        return TraversalOptions()
    return TraversalOptions(
        direction=TraversalDirection(options.direction.value),
        relations=tuple(options.relations or ()),
        max_depth=options.max_depth,
        node_limit=options.node_limit,
        edge_limit=options.edge_limit,
        cursor=options.cursor,
        include_inferred=options.include_inferred,
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
    async def expand_graph(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
        options: TraversalInput | None = None,
    ) -> GraphExpansion:
        try:
            expansion = await _graph_service(info).expand_graph(
                str(id),
                _to_domain_traversal(options),
            )
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except InvalidTraversalError as error:
            raise GraphQLError(
                str(error),
                extensions={"code": "INVALID_ARGUMENT"},
            ) from error
        except GraphServiceError as error:
            raise GraphQLError(
                "The graph service is unavailable",
                extensions={"code": "GRAPH_BACKEND_ERROR"},
            ) from error
        return _to_api_expansion(expansion)

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
    @strawberry.field
    async def get_active_profile(self, info: Info[GraphQLContext, None]) -> ActiveProfile:
        profile = _graph_service(info).get_active_profile()
        return ActiveProfile(
            metadata=OntologyProfileMetadata(
                package_id=profile.package_id,
                version=profile.version,
                title=profile.title,
                description=profile.description,
                ontology_iris=list(profile.ontology_iris),
            ),
            prefixes=[PrefixEntry(prefix=p, iri=i) for p, i in profile.prefixes.prefixes.items()],
            categories=[
                SemanticCategory(
                    name=name,
                    class_iris=list(cat.class_iris),
                    color=cat.color,
                    icon=cat.icon,
                    label=cat.label,
                ) for name, cat in profile.categories.items()
            ],
            predicates=[
                PredicateInfo(
                    name=p,
                    iri=None,
                    label=None,
                    traversable=True,
                    hidden=False,
                ) for p in profile.predicates.traversable_predicates
            ],
            limits=ProfileLimits(
                max_depth=profile.limits.max_depth,
                max_nodes=profile.limits.max_nodes,
                max_edges=profile.limits.max_edges,
            ),
            languages=LanguageInfo(
                preferred_languages=list(profile.languages.preferred_languages)
            ),
            reasoning_profile=profile.reasoning.profile_name,
            build_id=None,
        )


schema = strawberry.Schema(
    query=Query,
    types=[
        Wine,
        Winery,
        Region,
        Grape,
        GenericEntity,
        OntologyEntity,
        GraphRelationship,
        GraphExpansion,
    ],
    config=StrawberryConfig(auto_camel_case=False),
)
