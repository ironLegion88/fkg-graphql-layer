"""Validate shared fixtures match actual GraphQL API responses."""

from __future__ import annotations

from pathlib import Path

import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from adapters.oxigraph.semantic_repository import OxigraphSemanticRepository
from api.graphql_schema import schema
from domain.ontology_profile import load_ontology_profile
from ingestion.reasoning import materialize_semantics
from services.exceptions import GraphQLErrorCode
from services.graph_service import GraphService
from tests.shared.graphql_fixtures import (
    ACTIVE_PROFILE,
    CLASS_INFO,
    ERROR_RESPONSES,
    EXPANSION_PREVIEW,
    INFERRED_RELATIONSHIP,
    PROPERTY_INFO,
    PROVENANCE_RELATIONSHIP,
    SEARCH_RESULT,
    WINE_ENTITY,
)

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

            wine:Wine a owl:Class ;
                rdfs:label "Wine"@en .
            wine:Winery a owl:Class ;
                rdfs:label "Winery"@en .
            wine:Region a owl:Class ;
                rdfs:label "Region"@en .

            wine:ChateauMorgonBeaujolais a wine:Wine ;
                rdfs:label "ChateauMorgonBeaujolais"@en ;
                wine:hasMaker wine:ChateauMorgon .

            wine:ChateauMorgon a wine:Winery ;
                rdfs:label "ChateauMorgon"@en .

            wine:BeaujolaisRegion a wine:Region ;
                rdfs:label "BeaujolaisRegion"@en ;
                wine:adjacentRegion wine:ToursRegion .

            wine:ToursRegion a wine:Region ;
                rdfs:label "ToursRegion"@en .

            wine:hasMaker a owl:ObjectProperty ;
                rdfs:label "has maker"@en ;
                rdfs:domain wine:Wine ;
                rdfs:range wine:Winery .

            wine:adjacentRegion a owl:SymmetricProperty ;
                rdfs:label "adjacent region"@en .
        """,
        format=RdfFormat.TURTLE,
        to_graph=NamedNode("urn:test:asserted"),
    )
    materialize_semantics(store, "rdfs-wine-parity")
    return store


@pytest.fixture
def test_services(tmp_path: Path, profile, wine_store):
    settings = OxigraphSettings(tmp_path, ("en", "ANY"))
    graph_repo = OxigraphGraphRepository(profile, settings, wine_store)
    semantic_repo = OxigraphSemanticRepository(profile, settings, wine_store)
    graph_service = GraphService(graph_repo, profile)
    return {
        "graph_service": graph_service,
        "semantic_repository": semantic_repo,
        "role": "operator",
        "active_build_id": "build-2026-09-19-01",
    }


def test_all_sixteen_error_codes_present_in_shared_fixtures() -> None:
    """Verify all 16 GQ-115 error codes are present and canonical in ERROR_RESPONSES."""
    enum_codes = {member.value for member in GraphQLErrorCode}
    assert len(enum_codes) == 16
    assert set(ERROR_RESPONSES.keys()) == enum_codes

    for code, payload in ERROR_RESPONSES.items():
        assert "message" in payload and isinstance(payload["message"], str)
        assert len(payload["message"]) > 0
        assert "extensions" in payload and isinstance(payload["extensions"], dict)
        assert payload["extensions"]["code"] == code


@pytest.mark.asyncio
async def test_canonical_entity_shape_matches_graphql_response(test_services) -> None:
    """Verify WINE_ENTITY matches actual GraphQL get_entity response shape."""
    query = """
    query GetEntity($id: ID!) {
        get_entity(id: $id) {
            id
            label
            description
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"id": WINE_ENTITY["id"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    data = result.data["get_entity"]
    assert data is not None
    assert set(data.keys()) == set(WINE_ENTITY.keys())
    assert data["id"] == WINE_ENTITY["id"]
    assert data["label"] == WINE_ENTITY["label"]
    assert data["description"] == WINE_ENTITY["description"]


@pytest.mark.asyncio
async def test_provenance_relationship_fixture_matches_graphql_response(test_services) -> None:
    """Verify PROVENANCE_RELATIONSHIP contains all provenance fields matching GraphQL."""
    query = """
    query GetRelationships($id: ID!) {
        get_relationships(id: $id) {
            relation
            predicate_iri
            predicate_label
            is_inferred
            source_graph
            explanation_handle
            source {
                id
                label
                description
            }
            target {
                id
                label
                description
            }
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"id": WINE_ENTITY["id"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    relationships = result.data["get_relationships"]
    assert len(relationships) >= 1

    rel = relationships[0]
    expected_keys = set(PROVENANCE_RELATIONSHIP.keys())
    assert set(rel.keys()) == expected_keys
    assert rel["predicate_iri"] == PROVENANCE_RELATIONSHIP["predicate_iri"]
    assert rel["relation"] == PROVENANCE_RELATIONSHIP["relation"]
    assert rel["is_inferred"] is False
    assert rel["source_graph"] == "urn:test:asserted"
    assert rel["explanation_handle"] is None
    assert set(rel["source"].keys()) == set(PROVENANCE_RELATIONSHIP["source"].keys())
    assert set(rel["target"].keys()) == set(PROVENANCE_RELATIONSHIP["target"].keys())


@pytest.mark.asyncio
async def test_inferred_relationship_fixture_matches_graphql_structure(test_services) -> None:
    """Verify INFERRED_RELATIONSHIP contains valid provenance fields with is_inferred=True."""
    query = """
    query GetRelationships($id: ID!) {
        get_relationships(id: $id) {
            relation
            predicate_iri
            predicate_label
            is_inferred
            source_graph
            explanation_handle
            source {
                id
                label
                description
            }
            target {
                id
                label
                description
            }
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"id": INFERRED_RELATIONSHIP["source"]["id"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    relationships = result.data["get_relationships"]
    inferred_matches = [r for r in relationships if r["is_inferred"] is True]
    assert len(inferred_matches) >= 1

    matched = inferred_matches[0]
    assert set(matched.keys()) == set(INFERRED_RELATIONSHIP.keys())
    assert matched["is_inferred"] is True
    assert matched["relation"] == INFERRED_RELATIONSHIP["relation"]


@pytest.mark.asyncio
async def test_canonical_class_info_shape_matches_graphql_response(test_services) -> None:
    """Verify CLASS_INFO matches GraphQL get_class_info field structure."""
    query = """
    query GetClassInfo($iri: String!) {
        get_class_info(iri: $iri) {
            iri
            compact_iri {
                full_iri
                prefix
                local_name
                namespace
            }
            label
            direct_parents
            all_ancestors
            direct_children
            all_descendants
            equivalent_classes
            disjoint_classes
            instance_count
            restrictions
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"iri": CLASS_INFO["iri"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    class_info = result.data["get_class_info"]
    assert class_info is not None

    for key in (
        "iri",
        "label",
        "direct_parents",
        "all_ancestors",
        "direct_children",
        "all_descendants",
        "equivalent_classes",
        "disjoint_classes",
        "instance_count",
        "restrictions",
    ):
        assert key in class_info
    assert class_info["compact_iri"]["prefix"] == "vin"
    assert class_info["compact_iri"]["local_name"] == "Wine"


@pytest.mark.asyncio
async def test_canonical_property_info_shape_matches_graphql_response(test_services) -> None:
    """Verify PROPERTY_INFO matches GraphQL get_property_info field structure."""
    query = """
    query GetPropertyInfo($iri: String!) {
        get_property_info(iri: $iri) {
            iri
            compact_iri {
                full_iri
                prefix
                local_name
                namespace
            }
            label
            property_kind
            domains
            ranges
            characteristics
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"iri": PROPERTY_INFO["iri"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    prop_info = result.data["get_property_info"]
    assert prop_info is not None
    assert prop_info["iri"] == PROPERTY_INFO["iri"]
    assert prop_info["compact_iri"]["prefix"] == "vin"
    assert prop_info["compact_iri"]["local_name"] == "hasMaker"


@pytest.mark.asyncio
async def test_canonical_search_result_shape_matches_graphql_response(test_services) -> None:
    """Verify SEARCH_RESULT matches GraphQL search resolver return shape."""
    query = """
    query SearchEntities($options: SearchInput!) {
        search(options: $options) {
            total_matches
            entities {
                id
                label
                description
            }
        }
    }
    """
    result = await schema.execute(
        query,
        variable_values={"options": {"query": "ChateauMorgonBeaujolais"}},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    search_data = result.data["search"]
    assert set(search_data.keys()) == set(SEARCH_RESULT.keys())
    assert search_data["total_matches"] >= 1
    first_entity = search_data["entities"][0]
    assert set(first_entity.keys()) == set(WINE_ENTITY.keys())
    assert first_entity["id"] == WINE_ENTITY["id"]


@pytest.mark.asyncio
async def test_canonical_expansion_preview_shape_matches_graphql_response(test_services) -> None:
    """Verify EXPANSION_PREVIEW matches get_expansion_preview GraphQL response shape."""
    query = """
    query GetPreview($id: ID!) {
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
    """
    result = await schema.execute(
        query,
        variable_values={"id": EXPANSION_PREVIEW["entity_id"]},
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    preview_data = result.data["get_expansion_preview"]
    assert preview_data is not None
    assert set(preview_data.keys()) == set(EXPANSION_PREVIEW.keys())
    assert preview_data["entity_id"] == EXPANSION_PREVIEW["entity_id"]
    assert len(preview_data["groups"]) >= 1
    first_group = preview_data["groups"][0]
    assert set(first_group.keys()) == set(EXPANSION_PREVIEW["groups"][0].keys())


@pytest.mark.asyncio
async def test_canonical_active_profile_shape_matches_graphql_response(test_services) -> None:
    """Verify ACTIVE_PROFILE matches get_active_profile GraphQL response structure."""
    query = """
    query GetProfile {
        get_active_profile {
            metadata {
                package_id
                version
                title
                description
                ontology_iris
            }
            reasoning_profile
            build_id
        }
    }
    """
    result = await schema.execute(
        query,
        context_value=test_services,
    )
    assert result.errors is None
    assert result.data is not None
    profile_data = result.data["get_active_profile"]
    assert profile_data is not None
    assert set(profile_data.keys()) == set(ACTIVE_PROFILE.keys())
    assert profile_data["build_id"] == "build-2026-09-19-01"
