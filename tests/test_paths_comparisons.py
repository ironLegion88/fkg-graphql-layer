import pytest
from domain.models import PathOptions, PathStatus, GraphPath, GraphEntity, ComparisonResult, GraphRelationship
from tests.fakes import FakeGraphRepository
from services.graph_service import GraphService
from domain.ontology_profile import load_ontology_profile

@pytest.fixture
def profile():
    return load_ontology_profile()

@pytest.fixture
def repository() -> FakeGraphRepository:
    wine = GraphEntity("wine:test", "Test Wine", "Wine")
    grape = GraphEntity("grape:test", "Test Grape", "Grape")
    region = GraphEntity("region:test", "Test Region", "Region")
    entities = [wine, grape, region]
    relationships = [
        GraphRelationship(wine, grape, "madeFromGrape"),
        GraphRelationship(wine, region, "locatedIn"),
    ]
    return FakeGraphRepository(entities, relationships)

@pytest.fixture
def service(repository: FakeGraphRepository, profile) -> GraphService:
    return GraphService(repository, profile)


@pytest.mark.asyncio
async def test_find_path_success(service: GraphService) -> None:
    result = await service.find_path("grape:test", "region:test", PathOptions(max_depth=3))
    assert result.status == PathStatus.SUCCESS
    assert result.path is not None
    assert len(result.path.entities) == 3
    assert result.path.entities[0].id == "grape:test"
    assert result.path.entities[-1].id == "region:test"


@pytest.mark.asyncio
async def test_compare_entities_empty_fake(service: GraphService) -> None:
    # Our fake just returns an empty comparison result for now
    result = await service.compare_entities("grape:test", "region:test")
    assert result is not None
    assert isinstance(result, ComparisonResult)
