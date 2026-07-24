"""Baseline contract tests for the public Strawberry schema."""

from __future__ import annotations

from api.graphql_schema import schema
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository, wine_graph_fixture


def test_schema_preserves_public_graph_fields() -> None:
    schema_text = schema.as_str()

    for field in (
        "get_wine",
        "get_entity",
        "search_entities",
        "get_neighbors",
        "get_relationships",
        "expand",
    ):
        assert field in schema_text


async def test_search_and_relationship_resolvers_use_database_neutral_service() -> None:
    entities, relationships, _ = wine_graph_fixture()
    service = GraphService(FakeGraphRepository(entities, relationships))
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