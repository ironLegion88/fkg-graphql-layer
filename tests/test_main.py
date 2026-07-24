"""Operational API baseline tests that do not require GraphDB."""

from __future__ import annotations

from pathlib import Path

import httpx

from ingestion.build_store import build_store
from main import app


async def test_health_endpoint() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_frontend_cors_preflight() -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.options(
            "/graphql",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "POST",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


async def test_graphql_runs_without_graphdb_using_promoted_oxigraph_store(
    monkeypatch,
    tmp_path: Path,
) -> None:
    wine_iri = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#DemoWine"
    (tmp_path / "source.ttl").write_text(
        f"""
        @prefix wine: <http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        wine:Wine a owl:Class .
        wine:DemoWine a wine:Wine ; rdfs:label "GraphDB-free Wine"@en .
        """,
        encoding="utf-8",
    )
    (tmp_path / "sources.yaml").write_text(
        """
        version: 1
        sources:
          - path: source.ttl
            format: turtle
            graph: urn:test:asserted
        reasoning_profile: rdfs-wine-parity
        """,
        encoding="utf-8",
    )
    store_root = tmp_path / "output"
    build_store(tmp_path / "sources.yaml", store_root)
    monkeypatch.setenv("GRAPH_BACKEND", "oxigraph")
    monkeypatch.setenv("RDF_STORE_PATH", str(store_root))

    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        ) as client:
            response = await client.post(
                "/graphql",
                json={
                    "query": "query($id: ID!) { get_wine(id: $id) { id label } }",
                    "variables": {"id": wine_iri},
                },
            )

    assert response.status_code == 200
    assert response.json() == {
        "data": {
            "get_wine": {
                "id": wine_iri,
                "label": "GraphDB-free Wine",
            }
        }
    }