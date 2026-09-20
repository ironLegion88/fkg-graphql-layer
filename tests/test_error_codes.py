"""Tests for GraphQLErrorCode completeness, build_id propagation, readiness consistency, and auth error codes."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import strawberry

from api.graphql_schema import schema
from api.security import GraphQLSafetyExtension
from domain.ontology_profile import load_ontology_profile
from ingestion.build_store import build_store
from main import app
from services.exceptions import GraphQLErrorCode
from services.graph_service import GraphService
from tests.fakes import FakeGraphRepository


EXPECTED_16_ERROR_CODES = {
    "NOT_FOUND",
    "INVALID_CURSOR",
    "BUDGET_EXHAUSTED",
    "INTERNAL_ERROR",
    "INVALID_ARGUMENT",
    "TIMEOUT",
    "CANCELLED",
    "FORBIDDEN",
    "STORE_NOT_READY",
    "ONTOLOGY_INCONSISTENT",
    "REASONER_UNAVAILABLE",
    "EXPLANATION_UNAVAILABLE",
    "UNSUPPORTED_SEMANTIC_CONSTRUCT",
    "BACKEND_UNAVAILABLE",
    "INVALID_PREDICATE",
    "QUERY_TOO_COMPLEX",
}


@pytest.fixture
def fake_service() -> GraphService:
    repo = FakeGraphRepository([], [])
    return GraphService(repo, load_ontology_profile())


@pytest.fixture(autouse=True)
def reset_app_state():
    yield
    for attr in ("store_open", "graph_service", "semantic_repository", "active_build_id"):
        if hasattr(app.state, attr):
            delattr(app.state, attr)


def test_all_sixteen_error_codes_are_valid_enum_members() -> None:
    """Verify GraphQLErrorCode enum contains exactly the 16 required members."""
    assert len(GraphQLErrorCode) == 16, f"Expected 16 error codes, got {len(GraphQLErrorCode)}"
    for code_str in EXPECTED_16_ERROR_CODES:
        enum_member = GraphQLErrorCode(code_str)
        assert enum_member.value == code_str
        assert getattr(GraphQLErrorCode, code_str) == enum_member
    actual_codes = {member.value for member in GraphQLErrorCode}
    assert actual_codes == EXPECTED_16_ERROR_CODES


@pytest.mark.asyncio
async def test_build_id_populated_in_get_active_profile(fake_service: GraphService) -> None:
    """Verify get_active_profile populates build_id from GraphQL context."""
    query = """
    query {
        get_active_profile {
            build_id
            metadata {
                package_id
            }
        }
    }
    """
    result = await schema.execute(
        query,
        context_value={
            "graph_service": fake_service,
            "active_build_id": "build-20260921-prod-01",
            "role": "operator",
        },
    )
    assert not result.errors
    assert result.data is not None
    assert result.data["get_active_profile"]["build_id"] == "build-20260921-prod-01"


@pytest.mark.asyncio
async def test_build_id_none_when_omitted_in_context(fake_service: GraphService) -> None:
    """Verify get_active_profile gracefully returns None if active_build_id is absent from context."""
    query = """
    query {
        get_active_profile {
            build_id
            metadata {
                package_id
            }
        }
    }
    """
    result = await schema.execute(
        query,
        context_value={
            "graph_service": fake_service,
            "role": "operator",
        },
    )
    assert not result.errors
    assert result.data is not None
    assert result.data["get_active_profile"]["build_id"] is None


@pytest.mark.asyncio
async def test_build_id_populated_end_to_end_from_active_store(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """End-to-end verification that get_active_profile returns active build_id from promoted store."""
    (tmp_path / "source.ttl").write_text(
        """
        @prefix wine: <http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        wine:Wine a owl:Class .
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
    build_metadata = build_store(tmp_path / "sources.yaml", store_root)
    build_id = json.loads((store_root / "current.json").read_text())["build_id"]

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
                    "query": """
                        query {
                            get_active_profile {
                                build_id
                                metadata {
                                    package_id
                                }
                            }
                        }
                    """
                },
            )

    assert response.status_code == 200
    res_data = response.json()
    assert "errors" not in res_data
    assert res_data["data"]["get_active_profile"]["build_id"] == build_id
    assert res_data["data"]["get_active_profile"]["build_id"] is not None


@pytest.mark.asyncio
async def test_readiness_returns_consistency_from_manifest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verify /health/readiness reads consistency and validation_summary from store-manifest.json."""
    build_id = "build-manifest-consistent"
    build_dir = tmp_path / "builds" / build_id
    build_dir.mkdir(parents=True)

    current_data = {"build_id": build_id, "triple_count": 120}
    (tmp_path / "current.json").write_text(json.dumps(current_data), encoding="utf-8")

    manifest_data = {
        "triple_count": 120,
        "inferred_triple_count": 45,
        "consistency": "consistent",
        "validation_summary": "Passed all OWL 2 DL checks",
    }
    (build_dir / "store-manifest.json").write_text(json.dumps(manifest_data), encoding="utf-8")

    monkeypatch.setenv("RDF_STORE_PATH", str(tmp_path))
    profile = load_ontology_profile()
    service = GraphService(FakeGraphRepository([], []), profile)

    app.state.store_open = True
    app.state.graph_service = service

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/health/readiness")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["active_build_id"] == build_id
    assert data["consistency"] == "consistent"
    assert data["validation_summary"] == "Passed all OWL 2 DL checks"
    assert data["inferred_count"] == 45


@pytest.mark.asyncio
async def test_readiness_falls_back_to_unknown_when_manifest_omits_fields(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Verify /health/readiness falls back to 'unknown' when consistency is absent from manifest."""
    build_id = "build-without-consistency"
    build_dir = tmp_path / "builds" / build_id
    build_dir.mkdir(parents=True)

    current_data = {"build_id": build_id, "triple_count": 50}
    (tmp_path / "current.json").write_text(json.dumps(current_data), encoding="utf-8")

    manifest_data = {
        "triple_count": 50,
    }
    (build_dir / "store-manifest.json").write_text(json.dumps(manifest_data), encoding="utf-8")

    monkeypatch.setenv("RDF_STORE_PATH", str(tmp_path))
    profile = load_ontology_profile()
    service = GraphService(FakeGraphRepository([], []), profile)

    app.state.store_open = True
    app.state.graph_service = service

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/health/readiness")

    assert response.status_code == 200
    data = response.json()
    assert data["consistency"] == "unknown"
    assert data["validation_summary"] == "unknown"


@pytest.mark.asyncio
async def test_auth_rejection_uses_forbidden_code_graph_service(fake_service: GraphService) -> None:
    """Verify auth rejection for graph_service uses GraphQLErrorCode.FORBIDDEN."""
    query = """
    query {
        get_entity(id: "node:1") {
            id
        }
    }
    """
    result = await schema.execute(
        query,
        context_value={"graph_service": fake_service, "role": "unauthorized_role"},
    )
    assert result.errors
    assert result.errors[0].extensions["code"] == GraphQLErrorCode.FORBIDDEN.value
    assert "Unauthorized access" in str(result.errors[0])


@pytest.mark.asyncio
async def test_auth_rejection_uses_forbidden_code_semantic_repository() -> None:
    """Verify auth rejection for semantic_repository uses GraphQLErrorCode.FORBIDDEN."""
    query = """
    query {
        list_classes(limit: 10) {
            iri
        }
    }
    """
    result = await schema.execute(
        query,
        context_value={"semantic_repository": None, "role": "unauthorized_role"},
    )
    assert result.errors
    assert result.errors[0].extensions["code"] == GraphQLErrorCode.FORBIDDEN.value
    assert "Unauthorized access" in str(result.errors[0])


@pytest.mark.asyncio
async def test_safety_extension_timeout_emits_timeout_code() -> None:
    """Verify safety extension timeout handler emits GraphQLErrorCode.TIMEOUT."""
    class FastTimeoutExtension(GraphQLSafetyExtension):
        timeout_seconds = 0.02

    @strawberry.type
    class Query:
        @strawberry.field
        async def slow_operation(self) -> str:
            await asyncio.sleep(0.1)
            return "done"

    from strawberry.schema.config import StrawberryConfig
    test_schema = strawberry.Schema(
        query=Query,
        extensions=[FastTimeoutExtension],
        config=StrawberryConfig(auto_camel_case=False),
    )
    result = await test_schema.execute("query { slow_operation }")
    assert result.errors
    assert result.errors[0].extensions["code"] == GraphQLErrorCode.TIMEOUT.value
    assert "GraphQL execution timed out" in str(result.errors[0])
