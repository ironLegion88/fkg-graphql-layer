"""Tests for semantic GraphQL resolvers, types, and context injection."""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from adapters.oxigraph.semantic_repository import OxigraphSemanticRepository
from api.graphql_schema import schema
from domain.ontology_profile import load_ontology_profile
from ingestion.build_store import build_store
from ingestion.reasoning import materialize_semantics
from main import app
from services.graph_service import GraphService

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

            wine:RedWine rdfs:subClassOf wine:Wine .
            wine:WhiteWine rdfs:subClassOf wine:Wine .

            wine:DemoWine a wine:Wine ;
                rdfs:label "Vin exemple"@fr, "Demo Wine"@en ;
                wine:hasMaker wine:DemoWinery ;
                wine:locatedIn wine:DemoRegion ;
                wine:madeFromGrape wine:DemoGrape .
            wine:DemoWinery a wine:Winery ; rdfs:label "Demo Winery"@en .
            wine:DemoRegion a wine:Region ; rdfs:label "Demo Region"@en ;
                wine:adjacentRegion wine:OtherRegion .
            wine:OtherRegion a wine:Region ; rdfs:label "Other Region"@en .
            wine:DemoGrape a wine:WineGrape ; rdfs:label "Demo Grape"@en .
            wine:adjacentRegion a owl:SymmetricProperty .

            wine:hasMaker a owl:ObjectProperty ;
                rdfs:label "has maker"@en ;
                rdfs:domain wine:Wine ;
                rdfs:range wine:Winery .

            wine:hasWinery a owl:ObjectProperty ;
                owl:equivalentProperty wine:hasMaker .
        """,
        format=RdfFormat.TURTLE,
        to_graph=NamedNode("urn:test:asserted"),
    )
    materialize_semantics(store, "rdfs-wine-parity")
    return store


@pytest.fixture
def graphql_context(tmp_path: Path, profile, wine_store):
    settings = OxigraphSettings(tmp_path, ("en", "ANY"))
    graph_repo = OxigraphGraphRepository(profile, settings, wine_store)
    semantic_repo = OxigraphSemanticRepository(profile, settings, wine_store)
    service = GraphService(graph_repo, profile)
    return {
        "graph_service": service,
        "semantic_repository": semantic_repo,
        "role": "operator",
    }


@pytest.mark.asyncio
async def test_get_resource_metadata_valid_iri(graphql_context):
    result = await schema.execute(
        """
        query GetMetadata($iri: String!) {
          get_resource_metadata(iri: $iri) {
            iri
            preferred_label
            semantic_kind
            asserted_types
            compact_iri {
              prefix
              local_name
            }
            labels {
              value
              language
            }
          }
        }
        """,
        variable_values={"iri": f"{WINE}DemoWine"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    metadata = result.data["get_resource_metadata"]
    assert metadata is not None
    assert metadata["iri"] == f"{WINE}DemoWine"
    assert metadata["preferred_label"] in ("Demo Wine", "Vin exemple")
    assert metadata["semantic_kind"] == "NAMED_INDIVIDUAL"
    assert f"{WINE}Wine" in metadata["asserted_types"]
    assert metadata["compact_iri"]["prefix"] == "vin"
    assert metadata["compact_iri"]["local_name"] == "DemoWine"
    assert len(metadata["labels"]) >= 1


@pytest.mark.asyncio
async def test_get_resource_metadata_unknown_iri(graphql_context):
    result = await schema.execute(
        """
        query GetMetadata($iri: String!) {
          get_resource_metadata(iri: $iri) {
            iri
          }
        }
        """,
        variable_values={"iri": "http://example.org/unknown"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["get_resource_metadata"] is None


@pytest.mark.asyncio
async def test_get_class_info_valid_class(graphql_context):
    result = await schema.execute(
        """
        query GetClassInfo($iri: String!) {
          get_class_info(iri: $iri) {
            iri
            label
            compact_iri {
              prefix
              local_name
            }
            direct_children
            instance_count
          }
        }
        """,
        variable_values={"iri": f"{WINE}Wine"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    info = result.data["get_class_info"]
    assert info is not None
    assert info["iri"] == f"{WINE}Wine"
    assert info["compact_iri"]["prefix"] == "vin"
    assert info["compact_iri"]["local_name"] == "Wine"
    assert f"{WINE}RedWine" in info["direct_children"]
    assert f"{WINE}WhiteWine" in info["direct_children"]
    assert info["instance_count"] >= 1


@pytest.mark.asyncio
async def test_get_class_info_unknown_iri(graphql_context):
    result = await schema.execute(
        """
        query GetClassInfo($iri: String!) {
          get_class_info(iri: $iri) {
            iri
          }
        }
        """,
        variable_values={"iri": "http://example.org/not_a_class"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["get_class_info"] is None


@pytest.mark.asyncio
async def test_get_property_info_valid_property(graphql_context):
    result = await schema.execute(
        """
        query GetPropInfo($iri: String!) {
          get_property_info(iri: $iri) {
            iri
            label
            property_kind
            domains
            ranges
            equivalent_properties
            usage_count
          }
        }
        """,
        variable_values={"iri": f"{WINE}hasMaker"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    info = result.data["get_property_info"]
    assert info is not None
    assert info["iri"] == f"{WINE}hasMaker"
    assert info["property_kind"] == "OBJECT_PROPERTY"
    assert f"{WINE}Wine" in info["domains"]
    assert f"{WINE}Winery" in info["ranges"]
    assert f"{WINE}hasWinery" in info["equivalent_properties"]
    assert info["usage_count"] >= 1


@pytest.mark.asyncio
async def test_get_property_info_unknown_iri(graphql_context):
    result = await schema.execute(
        """
        query GetPropInfo($iri: String!) {
          get_property_info(iri: $iri) {
            iri
          }
        }
        """,
        variable_values={"iri": "http://example.org/not_a_property"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["get_property_info"] is None


@pytest.mark.asyncio
async def test_list_classes(graphql_context):
    result = await schema.execute(
        """
        query ListClasses {
          list_classes(limit: 10, offset: 0) {
            iri
            label
          }
        }
        """,
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    classes = result.data["list_classes"]
    assert len(classes) > 0
    iris = {c["iri"] for c in classes}
    assert f"{WINE}Wine" in iris


@pytest.mark.asyncio
async def test_list_properties(graphql_context):
    result = await schema.execute(
        """
        query ListProperties {
          list_properties(limit: 10, offset: 0) {
            iri
            property_kind
          }
        }
        """,
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    props = result.data["list_properties"]
    assert len(props) > 0
    iris = {p["iri"] for p in props}
    assert f"{WINE}hasMaker" in iris


@pytest.mark.asyncio
async def test_get_expansion_preview_known_entity(graphql_context):
    result = await schema.execute(
        """
        query Preview($id: ID!) {
          get_expansion_preview(id: $id) {
            entity_id
            total_count
            groups {
              relation
              direction
              count
            }
          }
        }
        """,
        variable_values={"id": f"{WINE}DemoWine"},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    preview = result.data["get_expansion_preview"]
    assert preview["entity_id"] == f"{WINE}DemoWine"
    assert preview["total_count"] > 0
    relations = {g["relation"] for g in preview["groups"]}
    assert "hasMaker" in relations


@pytest.mark.asyncio
async def test_get_expansion_preview_unknown_entity(graphql_context):
    result = await schema.execute(
        """
        query Preview($id: ID!) {
          get_expansion_preview(id: $id) {
            entity_id
          }
        }
        """,
        variable_values={"id": "http://example.org/unknown"},
        context_value=graphql_context,
    )

    assert result.errors is not None
    assert result.errors[0].extensions["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_search_with_query(graphql_context):
    result = await schema.execute(
        """
        query SearchEntities($options: SearchInput!) {
          search(options: $options) {
            total_matches
            entities {
              id
              label
              __typename
            }
          }
        }
        """,
        variable_values={"options": {"query": "Demo Wine", "limit": 10}},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    search_data = result.data["search"]
    assert search_data["total_matches"] > 0
    ids = [e["id"] for e in search_data["entities"]]
    assert f"{WINE}DemoWine" in ids


@pytest.mark.asyncio
async def test_search_with_empty_results(graphql_context):
    result = await schema.execute(
        """
        query SearchEntities($options: SearchInput!) {
          search(options: $options) {
            total_matches
            entities {
              id
            }
          }
        }
        """,
        variable_values={"options": {"query": "nonexistent_string_12345", "limit": 10}},
        context_value=graphql_context,
    )

    assert result.errors is None
    assert result.data is not None
    assert result.data["search"]["total_matches"] == 0
    assert result.data["search"]["entities"] == []


@pytest.mark.asyncio
async def test_semantic_repository_injected_into_context(monkeypatch, tmp_path: Path):
    source_file = tmp_path / "wine_test.ttl"
    source_file.write_text(
        f"""
        @prefix wine: <{WINE}> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

        wine:Wine a owl:Class .
        wine:Winery a owl:Class .
        wine:DemoWine a wine:Wine ;
            rdfs:label "HTTP Demo Wine"@en ;
            wine:hasMaker wine:DemoWinery .
        wine:DemoWinery a wine:Winery ; rdfs:label "HTTP Demo Winery"@en .
        """,
        encoding="utf-8",
    )
    manifest_file = tmp_path / "sources.yaml"
    manifest_file.write_text(
        f"""
        version: 1
        sources:
          - path: {source_file.name}
            format: turtle
            graph: urn:test:asserted
        reasoning_profile: rdfs-wine-parity
        """,
        encoding="utf-8",
    )
    store_root = tmp_path / "store_out"
    build_store(manifest_file, store_root)

    monkeypatch.setenv("GRAPH_BACKEND", "oxigraph")
    monkeypatch.setenv("RDF_STORE_PATH", str(store_root))

    async with app.router.lifespan_context(app):
        # Verify app.state has semantic_repository
        assert hasattr(app.state, "semantic_repository")
        assert isinstance(app.state.semantic_repository, OxigraphSemanticRepository)

        # Test full HTTP GraphQL endpoint
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/graphql",
                json={
                    "query": """
                    query TestInjected($iri: String!) {
                      get_resource_metadata(iri: $iri) {
                        iri
                        preferred_label
                        compact_iri { prefix local_name }
                      }
                      list_classes(limit: 5) {
                        iri
                      }
                    }
                    """,
                    "variables": {"iri": f"{WINE}DemoWine"},
                },
            )

            assert response.status_code == 200
            data = response.json()
            assert "errors" not in data or data["errors"] is None
            meta = data["data"]["get_resource_metadata"]
            assert meta["iri"] == f"{WINE}DemoWine"
            assert meta["preferred_label"] == "HTTP Demo Wine"
            assert meta["compact_iri"]["local_name"] == "DemoWine"
            classes = data["data"]["list_classes"]
            assert len(classes) >= 1
