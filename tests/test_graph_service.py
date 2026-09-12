"""Baseline behavior tests for the database-neutral GraphService."""

from __future__ import annotations

import pytest

from dataclasses import replace

from domain.models import TraversalOptions, UNKNOWN_KIND
from services.exceptions import EntityNotFoundError, InvalidTraversalError
from services.graph_service import GraphService, GraphServiceLimits
from tests.fakes import FakeGraphRepository, wine_graph_fixture


from domain.ontology_profile import load_ontology_profile

@pytest.fixture
def profile():
    return load_ontology_profile()

@pytest.fixture
def repository() -> FakeGraphRepository:
    entities, relationships, _ = wine_graph_fixture()
    return FakeGraphRepository(entities, relationships)


@pytest.fixture
def service(repository: FakeGraphRepository, profile) -> GraphService:
    return GraphService(repository, profile)


async def test_get_entity_and_wine_preserve_domain_type(service: GraphService) -> None:
    entity = await service.get_entity("wine:demo")

    assert entity.label == "Demo Wine"
    assert entity.kind == "Wine"
    assert await service.get_wine("wine:demo") == entity


async def test_missing_and_non_wine_entities_raise_not_found(service: GraphService) -> None:
    with pytest.raises(EntityNotFoundError, match="No graph entity"):
        await service.get_entity("wine:missing")

    with pytest.raises(EntityNotFoundError, match="No wine"):
        await service.get_wine("winery:demo")


async def test_search_normalizes_input_and_skips_empty_queries(
    service: GraphService,
    repository: FakeGraphRepository,
) -> None:
    assert await service.search_entities("  wine:demo  ") == [
        repository.entities["wine:demo"]
    ]
    assert repository.search_queries == ["wine:demo"]

    assert await service.search_entities("   ") == []
    assert repository.search_queries == ["wine:demo"]


async def test_relationships_are_available_from_either_endpoint(
    service: GraphService,
) -> None:
    wine_relationships = await service.get_relationships("wine:demo")
    winery_relationships = await service.get_relationships("winery:demo")

    assert {relationship.relation for relationship in wine_relationships} == {
        "hasMaker",
        "madeFromGrape",
        "locatedIn",
    }
    assert winery_relationships == [wine_relationships[0]]
    assert winery_relationships[0].source.id == "wine:demo"
    assert winery_relationships[0].target.id == "winery:demo"


async def test_expand_filters_by_relation(service: GraphService) -> None:
    neighbors = await service.expand("wine:demo", "madeFromGrape")

    assert [neighbor.id for neighbor in neighbors] == ["grape:demo"]
    assert await service.expand("wine:demo", "  ") == []


from domain.models import PathOptions

async def test_path_uses_real_predicates_and_honors_depth(service: GraphService) -> None:
    result = await service.find_path("grape:demo", "winery:demo", PathOptions(max_depth=2))

    assert result.path is not None
    assert [entity.id for entity in result.path.entities] == [
        "grape:demo",
        "wine:demo",
        "winery:demo",
    ]
    assert result.path.relations == ("madeFromGrape", "hasMaker")
    
    result2 = await service.find_path("grape:demo", "winery:demo", PathOptions(max_depth=1))
    assert result2.path is None

async def test_domain_helpers_delegate_to_relationship_data(service: GraphService) -> None:
    assert [entity.id for entity in await service.get_wines_by_region("region:demo")] == [
        "wine:demo"
    ]
    assert [entity.id for entity in await service.get_wines_by_grape("grape:demo")] == [
        "wine:demo"
    ]


async def test_bounded_expansion_clamps_limits_and_continues_with_cursor(
    repository: FakeGraphRepository,
    profile,
) -> None:
    service = GraphService(repository, profile)
    service._limits = GraphServiceLimits(max_nodes=1, max_edges=2)
    requested = TraversalOptions(node_limit=100, edge_limit=100)

    first = await service.expand_graph("wine:demo", requested)
    second = await service.expand_graph(
        "wine:demo",
        replace(requested, cursor=first.page_info.next_cursor),
    )

    assert len(first.nodes) == 1
    assert len(first.relationships) == 1
    assert first.page_info.truncated is True
    assert first.page_info.next_cursor is not None
    assert len(second.nodes) == 1
    assert first.nodes[0].id != second.nodes[0].id


async def test_invalid_traversal_is_rejected_by_service(service: GraphService) -> None:
    with pytest.raises(InvalidTraversalError, match="max_depth"):
        await service.expand_graph("wine:demo", TraversalOptions(max_depth=2))

    with pytest.raises(InvalidTraversalError, match="Invalid graph cursor"):
        await service.expand_graph("wine:demo", TraversalOptions(cursor="invalid"))