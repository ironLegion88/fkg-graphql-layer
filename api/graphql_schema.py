"""Public, database-agnostic Strawberry GraphQL schema.

Resolvers depend only on ``GraphService``. GraphDB-specific GraphQL documents are
contained behind the service and retrieval boundaries.
"""

from __future__ import annotations

import json
import os
from enum import Enum
from pathlib import Path
from typing import NotRequired, TypedDict

import strawberry
from graphql import GraphQLError
from strawberry.schema.config import StrawberryConfig
from strawberry.types import Info

from api.security import GraphQLSafetyExtension
from domain.models import (
    ExpansionPreview as DomainExpansionPreview,
)
from domain.models import (
    GraphEntity,
    SearchOptions,
    TraversalDirection,
    TraversalOptions,
)
from domain.models import (
    GraphExpansion as DomainGraphExpansion,
)
from domain.models import (
    GraphRelationship as DomainGraphRelationship,
)
from domain.models import (
    SearchResult as DomainSearchResult,
)
from domain.ports import SemanticRepository
from domain.semantic_models import (
    Annotation,
    ClassInfo,
    CompactIRI,
    MultilingualLabel,
    PropertyInfo,
    ResourceMetadata,
    TypedValue,
)
from services.exceptions import (
    EntityNotFoundError,
    GraphQLErrorCode,
    GraphServiceError,
    InvalidTraversalError,
)
from services.graph_service import GraphService


class GraphQLContext(TypedDict):
    """Request dependencies available to Strawberry resolvers."""

    graph_service: GraphService
    semantic_repository: SemanticRepository
    deadline: NotRequired[float]
    role: NotRequired[str]
    active_build_id: NotRequired[str | None]


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
    # Provenance fields
    predicate_iri: str | None = None
    predicate_label: str | None = None
    is_inferred: bool = False
    source_graph: str | None = None
    explanation_handle: str | None = None


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


@strawberry.type
class GraphPath:
    entities: list[Entity]
    relations: list[str]

@strawberry.type
class PathResult:
    status: str
    path: GraphPath | None
    visited_nodes: int

@strawberry.type
class ComparisonResult:
    common_types: list[str]
    unique_types_a: list[str]
    unique_types_b: list[str]
    common_properties: list[str]
    unique_properties_a: list[str]
    unique_properties_b: list[str]
    shared_neighbors: list[Entity]


@strawberry.type
class ExplanationResult:
    available: bool
    proof_steps: list[str]
    reasoner: str | None = None
    message: str | None = None


@strawberry.type
class OverviewCluster:
    class_iri: str
    label: str
    instance_count: int
    color: str | None = None


@strawberry.type
class OverviewEdge:
    source_class: str
    target_class: str
    predicate: str
    count: int


@strawberry.type
class OverviewData:
    clusters: list[OverviewCluster]
    edges: list[OverviewEdge]
    total_instances: int
    total_relationships: int


@strawberry.type
class CompactIRIType:
    full_iri: str
    prefix: str | None = None
    local_name: str
    namespace: str | None = None


@strawberry.type
class MultilingualLabelType:
    value: str
    language: str | None = None
    datatype: str | None = None
    predicate_iri: str


@strawberry.type
class AnnotationType:
    predicate_iri: str
    value: str
    language: str | None = None


def _to_api_compact_iri(compact_iri: CompactIRI | None) -> CompactIRIType | None:
    if compact_iri is None:
        return None
    return CompactIRIType(
        full_iri=compact_iri.full_iri,
        prefix=compact_iri.prefix,
        local_name=compact_iri.local_name,
        namespace=compact_iri.namespace,
    )


def _to_api_label(label: MultilingualLabel) -> MultilingualLabelType:
    return MultilingualLabelType(
        value=label.value,
        language=label.language,
        datatype=label.datatype,
        predicate_iri=label.predicate_iri,
    )


def _to_api_annotation(annotation: Annotation) -> AnnotationType:
    val = annotation.value
    if isinstance(val, TypedValue):
        str_val = val.lexical_form
    else:
        str_val = str(val)
    return AnnotationType(
        predicate_iri=annotation.predicate_iri,
        value=str_val,
        language=annotation.language,
    )


@strawberry.type
class ResourceMetadataType:
    iri: str
    compact_iri: CompactIRIType | None = None
    semantic_kind: str
    asserted_types: list[str]
    inferred_types: list[str]
    labels: list[MultilingualLabelType]
    preferred_label: str
    descriptions: list[MultilingualLabelType]
    aliases: list[MultilingualLabelType]
    annotations: list[AnnotationType]
    source_graphs: list[str]
    build_id: str | None = None


def _to_api_resource_metadata(meta: ResourceMetadata | None) -> ResourceMetadataType | None:
    if meta is None:
        return None
    return ResourceMetadataType(
        iri=meta.iri,
        compact_iri=_to_api_compact_iri(meta.compact_iri),
        semantic_kind=str(meta.semantic_kind),
        asserted_types=list(meta.asserted_types),
        inferred_types=list(meta.inferred_types),
        labels=[_to_api_label(lbl) for lbl in meta.labels],
        preferred_label=meta.preferred_label,
        descriptions=[_to_api_label(d) for d in meta.descriptions],
        aliases=[_to_api_label(a) for a in meta.aliases],
        annotations=[_to_api_annotation(ann) for ann in meta.annotations],
        source_graphs=list(meta.source_graphs),
        build_id=meta.build_id,
    )


@strawberry.type
class ClassInfoType:
    iri: str
    compact_iri: CompactIRIType | None = None
    label: str
    direct_parents: list[str]
    all_ancestors: list[str]
    direct_children: list[str]
    all_descendants: list[str]
    equivalent_classes: list[str]
    disjoint_classes: list[str]
    instance_count: int
    annotations: list[AnnotationType]
    restrictions: list[str]


def _to_api_class_info(info: ClassInfo | None) -> ClassInfoType | None:
    if info is None:
        return None
    return ClassInfoType(
        iri=info.iri,
        compact_iri=_to_api_compact_iri(info.compact_iri),
        label=info.label,
        direct_parents=list(info.direct_parents),
        all_ancestors=list(info.all_ancestors),
        direct_children=list(info.direct_children),
        all_descendants=list(info.all_descendants),
        equivalent_classes=list(info.equivalent_classes),
        disjoint_classes=list(info.disjoint_classes),
        instance_count=info.instance_count,
        annotations=[_to_api_annotation(a) for a in info.annotations],
        restrictions=list(info.restrictions),
    )


@strawberry.type
class PropertyInfoType:
    iri: str
    compact_iri: CompactIRIType | None = None
    label: str
    property_kind: str
    domains: list[str]
    ranges: list[str]
    inverse_of: str | None = None
    equivalent_properties: list[str]
    sub_properties: list[str]
    super_properties: list[str]
    characteristics: list[str]
    usage_count: int
    annotations: list[AnnotationType]


def _to_api_property_info(info: PropertyInfo | None) -> PropertyInfoType | None:
    if info is None:
        return None
    return PropertyInfoType(
        iri=info.iri,
        compact_iri=_to_api_compact_iri(info.compact_iri),
        label=info.label,
        property_kind=str(info.property_kind),
        domains=list(info.domains),
        ranges=list(info.ranges),
        inverse_of=info.inverse_of,
        equivalent_properties=list(info.equivalent_properties),
        sub_properties=list(info.sub_properties),
        super_properties=list(info.super_properties),
        characteristics=list(info.characteristics),
        usage_count=info.usage_count,
        annotations=[_to_api_annotation(a) for a in info.annotations],
    )


@strawberry.type
class ValidationFindingType:
    severity: str
    message: str
    focus_node: str | None = None
    source_shape: str | None = None


@strawberry.type
class BuildStatusType:
    build_id: str | None
    status: str
    consistency: str
    triple_count: int
    inferred_count: int
    semantic_profile: str | None
    reasoner_status: str | None
    reasoner_name: str | None
    validation_summary: str | None
    unsatisfiable_classes: list[str]
    unsupported_constructs: list[str]
    findings: list[ValidationFindingType]


@strawberry.type
class PreviewGroupType:
    relation: str
    direction: TraversalDirectionValue
    count: int


@strawberry.type
class ExpansionPreviewType:
    entity_id: str
    total_count: int
    groups: list[PreviewGroupType]


def _to_api_expansion_preview(preview: DomainExpansionPreview) -> ExpansionPreviewType:
    return ExpansionPreviewType(
        entity_id=preview.entity_id,
        total_count=preview.total_count,
        groups=[
            PreviewGroupType(
                relation=g.relation,
                direction=TraversalDirectionValue(
                    g.direction.value if hasattr(g.direction, "value") else str(g.direction)
                ),
                count=g.count,
            )
            for g in preview.groups
        ],
    )


def _to_api_entity(
entity: GraphEntity) -> Entity:
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
        predicate_iri=relationship.predicate_iri or None,
        predicate_label=relationship.predicate_label,
        is_inferred=relationship.is_inferred,
        source_graph=relationship.source_graph,
        explanation_handle=relationship.explanation_handle,
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


@strawberry.input
class SearchInput:
    query: str
    limit: int = 100
    offset: int = 0
    kinds: list[str] | None = None
    require_description: bool = False


@strawberry.type
class SearchResultType:
    entities: list[Entity]
    total_matches: int


def _to_domain_search_options(options: SearchInput) -> SearchOptions:
    return SearchOptions(
        query=options.query,
        limit=options.limit,
        offset=options.offset,
        kinds=tuple(options.kinds or ()),
        require_description=options.require_description,
    )


def _to_api_search_result(result: DomainSearchResult) -> SearchResultType:
    return SearchResultType(
        entities=[_to_api_entity(e) for e in result.entities],
        total_matches=result.total_matches,
    )


def _graph_service(info: Info[GraphQLContext, None]) -> GraphService:
    ctx = info.context
    if ctx.get("role") not in ("operator", "anonymous"):
        raise GraphQLError("Unauthorized access", extensions={"code": GraphQLErrorCode.FORBIDDEN.value})
    return ctx["graph_service"]


def _semantic_repository(info: Info[GraphQLContext, None]) -> SemanticRepository:
    ctx = info.context
    if ctx.get("role") not in ("operator", "anonymous"):
        raise GraphQLError("Unauthorized access", extensions={"code": GraphQLErrorCode.FORBIDDEN.value})
    return ctx["semantic_repository"]


async def _resolve_entity(operation: object) -> Entity:
    """Translate service errors into intentionally database-agnostic GraphQL errors."""
    try:
        entity = await operation  # type: ignore[union-attr]
    except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
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
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return [_to_api_entity(entity) for entity in entities]

    @strawberry.field
    async def get_neighbors(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> list[Entity]:
        try:
            entities = await _graph_service(info).get_neighbors(str(id))
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return [_to_api_entity(entity) for entity in entities]

    @strawberry.field
    async def get_relationships(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> list[GraphRelationship]:
        try:
            relationships = await _graph_service(info).get_relationships(str(id))
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
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
                info.context.get("deadline")
            )
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except InvalidTraversalError as error:
            raise GraphQLError(
                str(error),
                extensions={"code": "INVALID_ARGUMENT"},
            ) from error
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_expansion(expansion)

    @strawberry.field
    async def expand(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
        relation: str,
    ) -> list[Entity]:
        try:
            entities = await _graph_service(info).expand(str(id), relation, info.context.get("deadline"))
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return [_to_api_entity(entity) for entity in entities]

    @strawberry.field
    async def find_path(
        self,
        info: Info[GraphQLContext, None],
        source_id: strawberry.ID,
        target_id: strawberry.ID,
    ) -> PathResult:
        try:
            result = await _graph_service(info).find_path(str(source_id), str(target_id), deadline=info.context.get("deadline"))
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
            
        path = None
        if result.path:
            path = GraphPath(
                entities=[_to_api_entity(e) for e in result.path.entities],
                relations=list(result.path.relations)
            )
            
        return PathResult(
            status=result.status.value,
            path=path,
            visited_nodes=result.visited_nodes
        )

    @strawberry.field
    async def compare(
        self,
        info: Info[GraphQLContext, None],
        id_a: strawberry.ID,
        id_b: strawberry.ID,
    ) -> ComparisonResult:
        try:
            result = await _graph_service(info).compare_entities(str(id_a), str(id_b), info.context.get("deadline"))
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
            
        return ComparisonResult(
            common_types=list(result.common_types),
            unique_types_a=list(result.unique_types_a),
            unique_types_b=list(result.unique_types_b),
            common_properties=list(result.common_properties),
            unique_properties_a=list(result.unique_properties_a),
            unique_properties_b=list(result.unique_properties_b),
            shared_neighbors=[_to_api_entity(e) for e in result.shared_neighbors]
        )

    @strawberry.field
    async def get_explanation(
        self,
        info: Info[GraphQLContext, None],
        handle: str,
    ) -> ExplanationResult:
        """Stub: explanation service not yet implemented."""
        return ExplanationResult(
            available=False,
            proof_steps=[],
            reasoner=None,
            message="Explanation service is not yet available. The inference was produced by the configured reasoner.",
        )

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
            build_id=info.context.get("active_build_id"),
        )

    @strawberry.field
    async def get_resource_metadata(
        self,
        info: Info[GraphQLContext, None],
        iri: str,
    ) -> ResourceMetadataType | None:
        try:
            meta = await _semantic_repository(info).get_resource_metadata(iri)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_resource_metadata(meta)

    @strawberry.field
    async def get_class_info(
        self,
        info: Info[GraphQLContext, None],
        iri: str,
    ) -> ClassInfoType | None:
        try:
            class_info = await _semantic_repository(info).get_class_info(iri)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_class_info(class_info)

    @strawberry.field
    async def list_classes(
        self,
        info: Info[GraphQLContext, None],
        limit: int = 100,
        offset: int = 0,
    ) -> list[ClassInfoType]:
        try:
            classes = await _semantic_repository(info).list_classes(limit, offset)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return [api_cls for c in classes if (api_cls := _to_api_class_info(c)) is not None]

    @strawberry.field
    async def get_property_info(
        self,
        info: Info[GraphQLContext, None],
        iri: str,
    ) -> PropertyInfoType | None:
        try:
            prop_info = await _semantic_repository(info).get_property_info(iri)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_property_info(prop_info)

    @strawberry.field
    async def list_properties(
        self,
        info: Info[GraphQLContext, None],
        limit: int = 100,
        offset: int = 0,
    ) -> list[PropertyInfoType]:
        try:
            properties = await _semantic_repository(info).list_properties(limit, offset)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return [api_prop for p in properties if (api_prop := _to_api_property_info(p)) is not None]

    @strawberry.field
    async def get_expansion_preview(
        self,
        info: Info[GraphQLContext, None],
        id: strawberry.ID,
    ) -> ExpansionPreviewType:
        try:
            preview = await _graph_service(info).get_expansion_preview(str(id))
        except EntityNotFoundError as error:
            raise GraphQLError(str(error), extensions={"code": "NOT_FOUND"}) from error
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_expansion_preview(preview)

    @strawberry.field
    async def search(
        self,
        info: Info[GraphQLContext, None],
        options: SearchInput,
    ) -> SearchResultType:
        try:
            domain_options = _to_domain_search_options(options)
            result = await _graph_service(info).search(domain_options)
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None
        return _to_api_search_result(result)

    @strawberry.field
    async def get_build_status(
        self,
        info: Info[GraphQLContext, None],
    ) -> BuildStatusType:
        build_id = info.context.get("active_build_id")
        output_root = Path(os.getenv("RDF_STORE_PATH", ".data/oxigraph"))
        metadata: dict[str, object] = {}
        if build_id and build_id != "unknown":
            manifest_path = output_root / "builds" / str(build_id) / "store-manifest.json"
            if manifest_path.exists():
                try:
                    metadata = json.loads(manifest_path.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    metadata = {}

        profile = _graph_service(info).get_active_profile()
        reasoner_name = profile.reasoning.profile_name if hasattr(profile, "reasoning") else None
        triple_count = int(metadata.get("triple_count", 0))  # type: ignore[arg-type]
        inferred_count = int(metadata.get("inferred_triple_count", 0))  # type: ignore[arg-type]
        consistency = str(metadata.get("consistency", "consistent" if inferred_count > 0 else "unknown"))
        validation_summary = str(metadata.get("validation_summary", "Passed" if consistency == "consistent" else "unknown"))
        raw_unsatisfiable = metadata.get("unsatisfiable_classes", [])
        unsatisfiable_classes = [str(c) for c in raw_unsatisfiable] if isinstance(raw_unsatisfiable, list) else []
        raw_unsupported = metadata.get("unsupported_constructs", [])
        unsupported_constructs = [str(c) for c in raw_unsupported] if isinstance(raw_unsupported, list) else []
        raw_findings = metadata.get("validation_findings", [])
        findings = [
            ValidationFindingType(
                severity=str(f.get("severity", "info")),
                message=str(f.get("message", "")),
                focus_node=f.get("focus_node"),
                source_shape=f.get("source_shape"),
            )
            for f in raw_findings
            if isinstance(f, dict)
        ] if isinstance(raw_findings, list) else []

        return BuildStatusType(
            build_id=build_id,
            status="ready",
            consistency=consistency,
            triple_count=triple_count,
            inferred_count=inferred_count,
            semantic_profile=profile.package_id,
            reasoner_status="completed" if inferred_count > 0 else "none",
            reasoner_name=reasoner_name,
            validation_summary=validation_summary,
            unsatisfiable_classes=unsatisfiable_classes,
            unsupported_constructs=unsupported_constructs,
            findings=findings,
        )

    @strawberry.field
    async def get_overview(
        self,
        info: Info[GraphQLContext, None],
    ) -> OverviewData:
        try:
            semantic_repo = _semantic_repository(info)
            profile = _graph_service(info).get_active_profile()

            all_classes = await semantic_repo.list_classes(limit=200, offset=0)
            sorted_classes = sorted(all_classes, key=lambda c: c.instance_count, reverse=True)[:100]

            class_to_color: dict[str, str] = {}
            for cat in profile.categories.values():
                if cat.color:
                    for term in cat.class_iris:
                        resolved = (
                            semantic_repo._resolve_iri(term)
                            if hasattr(semantic_repo, "_resolve_iri")
                            else term
                        )
                        class_to_color[resolved] = cat.color
                        class_to_color[term] = cat.color

            clusters: list[OverviewCluster] = []
            class_iris: set[str] = set()
            for c in sorted_classes:
                class_iris.add(c.iri)
                color = class_to_color.get(c.iri)
                if not color:
                    for parent in c.direct_parents:
                        if parent in class_to_color:
                            color = class_to_color[parent]
                            break
                if not color:
                    for anc in c.all_ancestors:
                        if anc in class_to_color:
                            color = class_to_color[anc]
                            break
                if not color:
                    for cat_name, cat in profile.categories.items():
                        if cat_name.lower() == c.label.lower() and cat.color:
                            color = cat.color
                            break

                clusters.append(
                    OverviewCluster(
                        class_iri=c.iri,
                        label=c.label,
                        instance_count=c.instance_count,
                        color=color,
                    )
                )

            raw_edges = await semantic_repo.get_inter_class_edges(class_iris, limit=500)
            edges = [
                OverviewEdge(
                    source_class=sc,
                    target_class=tc,
                    predicate=p,
                    count=cnt,
                )
                for sc, tc, p, cnt in raw_edges
            ]

            total_instances = sum(cl.instance_count for cl in clusters)
            total_relationships = sum(e.count for e in edges)

            return OverviewData(
                clusters=clusters,
                edges=edges,
                total_instances=total_instances,
                total_relationships=total_relationships,
            )
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None

    @strawberry.field
    async def get_class_instances(
        self,
        info: Info[GraphQLContext, None],
        class_iri: str,
        limit: int = 50,
    ) -> list[OntologyEntity]:
        try:
            semantic_repo = _semantic_repository(info)
            bounded_limit = max(1, min(limit, 100))
            instances = await semantic_repo.get_class_instances(class_iri, limit=bounded_limit)
            return [
                OntologyEntity(
                    id=strawberry.ID(inst.iri),
                    label=inst.preferred_label,
                    description=inst.descriptions[0].value if inst.descriptions else None,
                    kind="NAMED_INDIVIDUAL",
                )
                for inst in instances
            ]
        except GraphServiceError as error:
            msg = "The graph service is unavailable" if error.code == GraphQLErrorCode.INTERNAL_ERROR else error.message
            raise GraphQLError(msg, extensions={"code": error.code.value}) from None


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
        GraphPath,
        PathResult,
        ComparisonResult,
        CompactIRIType,
        MultilingualLabelType,
        AnnotationType,
        ResourceMetadataType,
        ClassInfoType,
        PropertyInfoType,
        ExpansionPreviewType,
        PreviewGroupType,
        SearchResultType,
        ValidationFindingType,
        BuildStatusType,
        OverviewCluster,
        OverviewEdge,
        OverviewData,
    ],

    extensions=[GraphQLSafetyExtension],
    config=StrawberryConfig(auto_camel_case=False),
)
