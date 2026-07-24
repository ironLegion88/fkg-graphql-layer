"""Baseline behavior tests for the database-neutral GraphService."""

from __future__ import annotations

import pytest

from domain.models import EntityKind
from services.exceptions import EntityNotFoundError
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository, wine_graph_fixture


@pytest.fixture
def repository() -> FakeGraphRepository:
    entities, relationships, _ = wine_graph_fixture()
    return FakeGraphRepository(entities, relationships)


@pytest.fixture
def service(repository: FakeGraphRepository) -> GraphService:
    return GraphService(repository)


async def test_get_entity_and_wine_preserve_domain_type(service: GraphService) -> None:
    entity = await service.get_entity("wine:demo")

    assert entity.label == "Demo Wine"
    assert entity.kind is EntityKind.WINE
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


async def test_path_uses_real_predicates_and_honors_depth(service: GraphService) -> None:
    path = await service.find_path("grape:demo", "winery:demo", max_depth=2)

    assert path is not None
    assert [entity.id for entity in path.entities] == [
        "grape:demo",
        "wine:demo",
        "winery:demo",
    ]
    assert path.relations == ("madeFromGrape", "hasMaker")
    assert await service.find_path("grape:demo", "winery:demo", max_depth=1) is None


async def test_domain_helpers_delegate_to_relationship_data(service: GraphService) -> None:
    assert [entity.id for entity in await service.get_wines_by_region("region:demo")] == [
        "wine:demo"
    ]
    assert [entity.id for entity in await service.get_wines_by_grape("grape:demo")] == [
        "wine:demo"
    ]