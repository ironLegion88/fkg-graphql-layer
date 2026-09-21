"""Tests for GraphQL GraphRelationship provenance fields and DEF-0A-1 fix."""

from __future__ import annotations

from pathlib import Path

import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from api.graphql_schema import schema
from domain.ontology_profile import load_ontology_profile
from ingestion.reasoning import materialize_semantics
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository, wine_graph_fixture

WINE = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"


@pytest.fixture
def profile():
    return load_ontology_profile()


@pytest.fixture
def wine_store():
    store = Store()
    store.load(
        input=f"""
            @prefix wine: <{WINE}> .
            @prefix owl: <http://www.w3.org/2002/07/owl#> .
            @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

            wine:Wine a owl:Class .
            wine:Winery a owl:Class .
            wine:Region a owl:Class .
            wine:WineGrape a owl:Class .

            wine:DemoWine a wine:Wine ;
                rdfs:label "Vin exemple"@fr, "Demo Wine"@en ;
                rdfs:comment "A fine test wine"@en ;
                wine:hasMaker wine:DemoWinery ;
                wine:locatedIn wine:DemoRegion ;
                wine:madeFromGrape wine:DemoGrape .

            wine:DemoWinery a wine:Winery ;
                rdfs:label "Demo Winery"@en .

            wine:DemoRegion a wine:Region ;
                rdfs:label "Demo Region"@en ;
                wine:adjacentRegion wine:OtherRegion .

            wine:OtherRegion a wine:Region ;
                rdfs:label "Other Region"@en .

            wine:DemoGrape a wine:WineGrape ;
                rdfs:label "Demo Grape"@en .

            wine:adjacentRegion a owl:SymmetricProperty .

            wine:hasMaker a owl:ObjectProperty ;
                rdfs:label "has maker"@en ;
                rdfs:domain wine:Wine ;
                rdfs:range wine:Winery .
        """,
        format=RdfFormat.TURTLE,
        to_graph=NamedNode("urn:test:asserted"),
    )
    materialize_semantics(store, "rdfs-wine-parity")
    return store


@pytest.fixture
def oxigraph_service(tmp_path: Path, profile, wine_store):
    settings = OxigraphSettings(tmp_path, ("en", "ANY"))
    graph_repo = OxigraphGraphRepository(profile, settings, wine_store)
    return GraphService(graph_repo, profile)


@pytest.mark.asyncio
async def test_relationship_provenance_fields_in_graphql_response(oxigraph_service):
    result = await schema.execute(
        """
        query GetRelationships($id: ID!) {
          get_relationships(id: $id) {
            relation
            predicate_iri
            predicate_label
            is_inferred
            source_graph
            explanation_handle
            source { id label }
            target { id label }
          }
        }
        """,
        variable_values={"id": f"{WINE}DemoWine"},
        context_value={"graph_service": oxigraph_service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    relationships = result.data["get_relationships"]
    assert len(relationships) >= 1

    by_relation = {r["relation"]: r for r in relationships}
    assert "hasMaker" in by_relation
    maker_rel = by_relation["hasMaker"]

    assert maker_rel["predicate_iri"] == f"{WINE}hasMaker"
    assert maker_rel["predicate_label"] == "has maker"
    assert maker_rel["is_inferred"] is False
    assert maker_rel["source_graph"] == "urn:test:asserted"
    assert maker_rel["explanation_handle"] is None
    assert maker_rel["source"]["id"] == f"{WINE}DemoWine"
    assert maker_rel["target"]["id"] == f"{WINE}DemoWinery"


@pytest.mark.asyncio
async def test_relationship_inferred_vs_asserted_distinction(oxigraph_service):
    # Query asserted relationships for DemoRegion -> OtherRegion
    result_asserted = await schema.execute(
        """
        query GetAsserted($id: ID!) {
          get_relationships(id: $id) {
            relation
            predicate_iri
            is_inferred
            source_graph
            target { id }
          }
        }
        """,
        variable_values={"id": f"{WINE}DemoRegion"},
        context_value={"graph_service": oxigraph_service, "role": "operator"},
    )
    assert result_asserted.errors is None
    assert result_asserted.data is not None
    asserted_rels = [
        r for r in result_asserted.data["get_relationships"]
        if r["relation"] == "adjacentRegion" and r["target"]["id"] == f"{WINE}OtherRegion"
    ]
    assert len(asserted_rels) == 1
    assert asserted_rels[0]["is_inferred"] is False
    assert asserted_rels[0]["source_graph"] == "urn:test:asserted"

    # Query inferred symmetric relationship for OtherRegion -> DemoRegion
    result_inferred = await schema.execute(
        """
        query GetInferred($id: ID!) {
          get_relationships(id: $id) {
            relation
            predicate_iri
            is_inferred
            source_graph
            target { id }
          }
        }
        """,
        variable_values={"id": f"{WINE}OtherRegion"},
        context_value={"graph_service": oxigraph_service, "role": "operator"},
    )
    assert result_inferred.errors is None
    assert result_inferred.data is not None
    inferred_rels = [
        r for r in result_inferred.data["get_relationships"]
        if r["relation"] == "adjacentRegion" and r["target"]["id"] == f"{WINE}DemoRegion"
    ]
    assert len(inferred_rels) == 1
    assert inferred_rels[0]["is_inferred"] is True
    assert inferred_rels[0]["source_graph"] == "urn:fkg:graph:inferred"


@pytest.mark.asyncio
async def test_relationship_default_values_when_provenance_missing(profile):
    entities, relationships, _ = wine_graph_fixture()
    fake_service = GraphService(FakeGraphRepository(entities, relationships), profile)

    result = await schema.execute(
        """
        query GetRelationshipsWithDefaults($id: ID!) {
          get_relationships(id: $id) {
            relation
            predicate_iri
            predicate_label
            is_inferred
            source_graph
            explanation_handle
          }
        }
        """,
        variable_values={"id": "wine:demo"},
        context_value={"graph_service": fake_service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    relationships_data = result.data["get_relationships"]
    assert len(relationships_data) == 3

    for rel in relationships_data:
        assert rel["is_inferred"] is False
        assert rel["source_graph"] is None
        assert rel["predicate_iri"] is None
        assert rel["predicate_label"] is None
        assert rel["explanation_handle"] is None


@pytest.mark.asyncio
async def test_expand_graph_includes_relationship_provenance(oxigraph_service):
    result = await schema.execute(
        """
        query ExpandWithProvenance($id: ID!) {
          expand_graph(id: $id, options: {max_depth: 1}) {
            center { id }
            relationships {
              relation
              predicate_iri
              predicate_label
              is_inferred
              source_graph
            }
          }
        }
        """,
        variable_values={"id": f"{WINE}DemoWine"},
        context_value={"graph_service": oxigraph_service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    rels = result.data["expand_graph"]["relationships"]
    assert len(rels) >= 1
    by_relation = {r["relation"]: r for r in rels}
    assert "hasMaker" in by_relation
    assert by_relation["hasMaker"]["predicate_iri"] == f"{WINE}hasMaker"
    assert by_relation["hasMaker"]["is_inferred"] is False
    assert by_relation["hasMaker"]["source_graph"] == "urn:test:asserted"


@pytest.mark.asyncio
async def test_search_end_to_end_without_sparql_projection_error(oxigraph_service):
    # Verifies DEF-0A-1 is fixed: _search SPARQL query projection includes ?needle
    result = await schema.execute(
        """
        query SearchEndToEnd($query: String!) {
          search(options: {query: $query}) {
            total_matches
            entities {
              id
              label
              __typename
            }
          }
        }
        """,
        variable_values={"query": "Demo"},
        context_value={"graph_service": oxigraph_service, "role": "operator"},
    )

    assert result.errors is None
    assert result.data is not None
    search_data = result.data["search"]
    assert search_data["total_matches"] >= 1
    assert any("Demo" in e["label"] for e in search_data["entities"])
