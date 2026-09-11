"""Repository contract tests for the embedded Oxigraph adapter."""

from __future__ import annotations

from pathlib import Path

import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from domain.models import TraversalDirection, TraversalOptions
from ingestion.reasoning import materialize_semantics
from services.exceptions import GraphBackendError


WINE = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"


from domain.ontology_profile import load_ontology_profile

@pytest.fixture
def profile():
    return load_ontology_profile()

@pytest.fixture
def repository(tmp_path: Path, profile) -> OxigraphGraphRepository:
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
                wine:hasMaker wine:DemoWinery ;
                wine:locatedIn wine:DemoRegion ;
                wine:madeFromGrape wine:DemoGrape .
            wine:DemoWinery a wine:Winery ; rdfs:label "Demo Winery"@en .
            wine:DemoRegion a wine:Region ; rdfs:label "Demo Region"@en ;
                wine:adjacentRegion wine:OtherRegion .
            wine:OtherRegion a wine:Region ; rdfs:label "Other Region"@en .
            wine:DemoGrape a wine:WineGrape ; rdfs:label "Demo Grape"@en .
            wine:adjacentRegion a owl:SymmetricProperty .
        """,
        format=RdfFormat.TURTLE,
        to_graph=NamedNode("urn:test:asserted"),
    )
    materialize_semantics(store, "rdfs-wine-parity")
    return OxigraphGraphRepository(
        profile,
        OxigraphSettings(tmp_path, ("en", "ANY")),
        store,
    )


async def test_get_entity_maps_kind_and_preferred_language(
    repository: OxigraphGraphRepository,
) -> None:
    entity = await repository.get_entity(f"{WINE}DemoWine")

    assert entity is not None
    assert entity.kind == "Wine"
    assert entity.label == "Demo Wine"
    assert await repository.get_entity(f"{WINE}Missing") is None


async def test_search_is_bounded_and_returns_core_entities(
    repository: OxigraphGraphRepository,
) -> None:
    results = await repository.search_entities("Demo", limit=2)

    assert len(results) == 2
    assert all(result.kind != "Unknown" for result in results)


async def test_relationships_support_direction_relation_and_limits(
    repository: OxigraphGraphRepository,
) -> None:
    wine_id = f"{WINE}DemoWine"
    region_id = f"{WINE}DemoRegion"

    outgoing = await repository.get_relationships(wine_id)
    assert len(outgoing) == 3
    assert {edge.relation for edge in outgoing} == {
        "hasMaker",
        "locatedIn",
        "madeFromGrape",
    }
    assert all(edge.source.id == wine_id for edge in outgoing)

    incoming = await repository.get_relationships(
        region_id,
        TraversalOptions(direction=TraversalDirection.INCOMING, relations=("locatedIn",)),
    )
    assert len(incoming) == 1
    assert incoming[0].source.id == wine_id
    assert incoming[0].relation == "locatedIn"

    filtered = await repository.get_relationships(
        wine_id,
        TraversalOptions(relations=("locatedIn", "hasMaker"), edge_limit=1),
    )
    assert len(filtered) == 1
    assert filtered[0].relation in ("locatedIn", "hasMaker")


async def test_symmetric_inference_can_be_included_or_excluded(
    repository: OxigraphGraphRepository,
) -> None:
    region_id = f"{WINE}DemoRegion"
    other_region_id = f"{WINE}OtherRegion"

    with_inference = await repository.get_relationships(
        other_region_id,
        TraversalOptions(
            relations=("adjacentRegion",),
            direction=TraversalDirection.OUTGOING,
        ),
    )
    assert len(with_inference) == 1
    assert with_inference[0].target.id == region_id

    without_inference = await repository.get_relationships(
        other_region_id,
        TraversalOptions(
            relations=("adjacentRegion",),
            direction=TraversalDirection.OUTGOING,
            include_inferred=False,
        ),
    )
    assert len(without_inference) == 0


async def test_expand_and_domain_helpers_use_canonical_relationships(
    repository: OxigraphGraphRepository,
) -> None:
    wine_id = f"{WINE}DemoWine"

    assert [entity.id for entity in await repository.expand(wine_id, "hasMaker")] == [
        f"{WINE}DemoWinery"
    ]

    with pytest.raises(GraphBackendError, match="Unsupported graph relation"):
        await repository.expand(wine_id, "unknown")


async def test_expand_graph_returns_cursor_pages(
    repository: OxigraphGraphRepository,
) -> None:
    wine_id = f"{WINE}DemoWine"
    options = TraversalOptions(node_limit=1, edge_limit=1)

    first = await repository.expand_graph(wine_id, options)
    second = await repository.expand_graph(
        wine_id,
        TraversalOptions(
            node_limit=1,
            edge_limit=1,
            cursor=first.page_info.next_cursor,
        ),
    )

    assert len(first.nodes) == 1
    assert len(first.relationships) == 1
    assert first.page_info.truncated is True
    assert second.nodes[0].id != first.nodes[0].id