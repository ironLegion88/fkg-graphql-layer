import pytest
from strawberry import Schema
from api.graphql_schema import schema
from services.graph_service import GraphService
from domain.models import GraphEntity
from tests.fakes import FakeGraphRepository
from domain.ontology_profile import load_ontology_profile
import time

@pytest.fixture
def fake_service() -> GraphService:
    entities = [
        GraphEntity("node:1", "Node", "Unknown", None, {}),
    ]
    repo = FakeGraphRepository(entities, [])
    return GraphService(repo, load_ontology_profile())

@pytest.mark.asyncio
async def test_budget_exhausted_on_massive_aliases(fake_service: GraphService) -> None:
    # 101 aliases to break the 100 max fields limit
    aliases = "\n".join([f"f{i}: expand(id: $id, relation: \"hasMaker\") {{ id }}" for i in range(105)])
    query_massive = f"query Spam($id: ID!) {{\n{aliases}\n}}"
    
    result = await schema.execute(
        query_massive,
        variable_values={"id": "node:1"},
        context_value={"graph_service": fake_service}
    )
    assert result.errors
    assert "Query complexity exceeds maximum allowed fields" in str(result.errors[0])
    assert result.errors[0].extensions["code"] == "BUDGET_EXHAUSTED"

@pytest.mark.asyncio
async def test_unauthorized_if_invalid_role(fake_service: GraphService) -> None:
    query = """
    query {
        get_active_profile {
            metadata {
                title
            }
        }
    }
    """
    # Overriding the 'role' context value
    result = await schema.execute(
        query,
        context_value={"graph_service": fake_service, "role": "hacker"}
    )
    # The role 'hacker' is invalid and not "operator"
    assert result.errors
    assert "Unauthorized access" in str(result.errors[0])
    assert result.errors[0].extensions["code"] == "UNAUTHORIZED"

@pytest.mark.asyncio
async def test_deadline_injected_and_timeout(fake_service: GraphService) -> None:
    query = """
    query {
        get_active_profile {
            metadata {
                title
            }
        }
    }
    """
    ctx = {"graph_service": fake_service}
    result = await schema.execute(
        query,
        context_value=ctx
    )
    assert not result.errors
    assert "deadline" in ctx
    assert "role" in ctx
    assert ctx["role"] == "operator"
    assert ctx["deadline"] > time.monotonic()
