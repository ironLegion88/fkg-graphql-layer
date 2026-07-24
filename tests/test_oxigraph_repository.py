"""Repository contract tests for the embedded Oxigraph adapter."""

from __future__ import annotations

from pathlib import Path

import pytest
from pyoxigraph import NamedNode, RdfFormat, Store

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from domain.models import EntityKind, TraversalDirection, TraversalOptions
from ingestion.reasoning import materialize_semantics
from services.exceptions import GraphBackendError


WINE = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"


@pytest.fixture
def repository(tmp_path: Path) -> OxigraphGraphRepository:
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
        OxigraphSettings(tmp_path, ("en", "ANY")),
        store,
    )


async def test_get_entity_maps_kind_and_preferred_language(
    repository: OxigraphGraphRepository,
) -> None:
    entity = await repository.get_entity(f"{WINE}DemoWine")

    assert entity is not None
    assert entity.kind is EntityKind.WINE
    assert entity.label == "Demo Wine"
    assert await repository.get_entity(f"{WINE}Missing") is None


async def test_search_is_bounded_and_returns_core_entities(
    repository: OxigraphGraphRepository,
) -> None:
    results = await repository.search_entities("Demo", limit=2)

    assert len(results) == 2
    assert all(result.kind is not EntityKind.UNKNOWN for result in results)
    assert await repository.search_entities("Demo", limit=0) == []


async def test_relationships_support_direction_relation_and_limits(
    repository: OxigraphGraphRepository,
) -> None:
    wine_id = f"{WINE}DemoWine"
    winery_id = f"{WINE}DemoWinery"

    outgoing = await repository.get_relationships(
        wine_id,
        TraversalOptions(
            direction=TraversalDirection.OUTGOING,
            relations=("hasMaker", "madeFromGrape"),
        ),
    )
    incoming = await repository.get_relationships(
        winery_id,
        TraversalOptions(direction=TraversalDirection.INCOMING),
    )
    limited = await repository.get_relationships(
        wine_id,
        TraversalOptions(edge_limit=1),
    )

    assert {relationship.relation for relationship in outgoing} == {
        "hasMaker",
        "madeFromGrape",
    }
    assert len(incoming) == 1
    assert incoming[0].source.id == wine_id
    assert incoming[0].target.id == winery_id
    assert len(limited) == 1


async def test_symmetric_inference_can_be_included_or_excluded(
    repository: OxigraphGraphRepository,
) -> None:
    other_region_id = f"{WINE}OtherRegion"
    with_inference = await repository.get_relationships(
        other_region_id,
        TraversalOptions(
            direction=TraversalDirection.OUTGOING,
            relations=("adjacentRegion",),
        ),
    )
    asserted_only = await repository.get_relationships(
        other_region_id,
        TraversalOptions(
            direction=TraversalDirection.OUTGOING,
            relations=("adjacentRegion",),
            include_inferred=False,
        ),
    )

    assert len(with_inference) == 1
    assert with_inference[0].target.id == f"{WINE}DemoRegion"
    assert asserted_only == []


async def test_expand_and_domain_helpers_use_canonical_relationships(
    repository: OxigraphGraphRepository,
) -> None:
    wine_id = f"{WINE}DemoWine"
    grape_id = f"{WINE}DemoGrape"
    region_id = f"{WINE}DemoRegion"

    assert [entity.id for entity in await repository.expand(wine_id, "hasMaker")] == [
        f"{WINE}DemoWinery"
    ]
    assert [entity.id for entity in await repository.get_wines_by_grape(grape_id)] == [
        wine_id
    ]
    assert [entity.id for entity in await repository.get_wines_by_region(region_id)] == [
        wine_id
    ]

    with pytest.raises(GraphBackendError, match="Unsupported graph relation"):
        await repository.expand(wine_id, "unknown")