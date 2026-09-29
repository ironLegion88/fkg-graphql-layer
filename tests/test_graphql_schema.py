"""Baseline contract tests for the public Strawberry schema."""

from __future__ import annotations

from api.graphql_schema import schema
from domain.ontology_profile import load_ontology_profile
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository, wine_graph_fixture


def get_profile():
    return load_ontology_profile()

def test_schema_preserves_public_graph_fields() -> None:
    schema_text = schema.as_str()

    for field in (
        "get_wine",
        "get_entity",
        "search_entities",
        "get_neighbors",
        "get_relationships",
        "expand_graph",
        "expand",
    ):
        assert field in schema_text


async def test_search_and_relationship_resolvers_use_database_neutral_service() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query PrototypeBaseline($query: String!, $id: ID!) {
          search_entities(query: $query) {
            __typename
            id
            label
          }
          get_relationships(id: $id) {
            relation
            source { id label }
            target { id label }
          }
        }
        """,
        variable_values={"query": "wine:demo", "id": "wine:demo"},
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["search_entities"] == [
        {"__typename": "Wine", "id": "wine:demo", "label": "Demo Wine"}
    ]
    assert {edge["relation"] for edge in result.data["get_relationships"]} == {
        "hasMaker",
        "madeFromGrape",
        "locatedIn",
    }


async def test_bounded_expansion_resolver_returns_page_metadata() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query BoundedExpansion($id: ID!) {
          expand_graph(id: $id, options: {node_limit: 1, edge_limit: 1}) {
            center { id label }
            nodes { id label }
            relationships { relation source { id } target { id } }
            page_info { truncated next_cursor }
          }
        }
        """,
        variable_values={"id": "wine:demo"},
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    expansion = result.data["expand_graph"]
    assert expansion["center"]["id"] == "wine:demo"
    assert len(expansion["nodes"]) == 1
    assert len(expansion["relationships"]) == 1
    assert expansion["page_info"]["truncated"] is True
    assert expansion["page_info"]["next_cursor"] is not None


async def test_invalid_expansion_returns_stable_error_code() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query InvalidExpansion($id: ID!) {
          expand_graph(id: $id, options: {max_depth: 2}) {
            center { id }
          }
        }
        """,
        variable_values={"id": "wine:demo"},
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is not None
    assert result.errors[0].extensions == {"code": "INVALID_ARGUMENT"}

async def test_expand_query_returns_entities() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query ExpandQuery($id: ID!, $relation: String!) {
          expand(id: $id, relation: $relation) {
            id
            label
          }
        }
        """,
        variable_values={"id": "wine:demo", "relation": "hasMaker"},
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    assert len(result.data["expand"]) > 0
    assert result.data["expand"][0]["id"] == "winery:demo"


async def test_get_active_profile_query() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query GetProfile {
          get_active_profile {
            metadata {
              package_id
              title
            }
          }
        }
        """,
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["get_active_profile"]["metadata"]["package_id"] is not None


async def test_get_build_status_query() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query GetBuildStatus {
          get_build_status {
            build_id
            status
            consistency
            triple_count
            inferred_count
            semantic_profile
            reasoner_status
            reasoner_name
            validation_summary
            unsatisfiable_classes
            unsupported_constructs
            findings {
              severity
              message
            }
          }
        }
        """,
        context_value={"graph_service": service, "role": "operator", "active_build_id": "test_bld_123"},
    )

    assert result.errors is None
    assert result.data is not None
    status = result.data["get_build_status"]
    assert status["build_id"] == "test_bld_123"
    assert status["status"] == "ready"
    assert status["semantic_profile"] is not None
    assert isinstance(status["unsatisfiable_classes"], list)


async def test_get_explanation_stub() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships), get_profile())
    result = await schema.execute(
        """
        query GetExplanation($handle: String!) {
          get_explanation(handle: $handle) {
            available
            proof_steps
            reasoner
            message
          }
        }
        """,
        variable_values={"handle": "handle_test_456"},
        context_value={"graph_service": service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    explanation = result.data["get_explanation"]
    assert explanation["available"] is False
    assert explanation["proof_steps"] == []
    assert explanation["reasoner"] is None
    assert "not yet available" in explanation["message"]
