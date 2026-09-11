"""Baseline contract tests for the public Strawberry schema."""

from __future__ import annotations

from api.graphql_schema import schema
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository, wine_graph_fixture


from domain.ontology_profile import load_ontology_profile

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
        context_value={"graph_service": service},
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
        context_value={"graph_service": service},
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
        context_value={"graph_service": service},
    )

    assert result.errors is not None
    assert result.errors[0].extensions == {"code": "INVALID_ARGUMENT"}