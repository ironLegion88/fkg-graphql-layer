"""Tests for graph backend selection at the composition boundary."""

from __future__ import annotations

from pathlib import Path

import pytest

from adapters.oxigraph import OxigraphGraphRepository
from ingestion.build_store import build_store
from services.exceptions import GraphBackendError
from services.graph_retrieval import GraphRetrievalService
from services.repository_factory import create_graph_repository


def _build_promoted_store(root: Path) -> Path:
    (root / "source.ttl").write_text(
        '<https://example.org/item> <https://example.org/name> "Item" .\n',
        encoding="utf-8",
    )
    (root / "sources.yaml").write_text(
        """
        version: 1
        sources:
          - path: source.ttl
            format: turtle
            graph: urn:test:asserted
        reasoning_profile: none
        """,
        encoding="utf-8",
    )
    store_root = root / "output"
    build_store(root / "sources.yaml", store_root)
    return store_root


from domain.ontology_profile import load_ontology_profile

@pytest.fixture
def profile():
    return load_ontology_profile()

def test_factory_defaults_to_oxigraph(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    profile,
) -> None:
    monkeypatch.delenv("GRAPH_BACKEND", raising=False)
    monkeypatch.setenv("RDF_STORE_PATH", str(_build_promoted_store(tmp_path)))

    assert isinstance(create_graph_repository(profile), OxigraphGraphRepository)


def test_factory_allows_explicit_graphdb_rollback(
    monkeypatch: pytest.MonkeyPatch,
    profile,
) -> None:
    monkeypatch.setenv("GRAPH_BACKEND", "graphdb")

    assert isinstance(create_graph_repository(profile), GraphRetrievalService)


def test_factory_rejects_unknown_backend(monkeypatch: pytest.MonkeyPatch, profile) -> None:
    monkeypatch.setenv("GRAPH_BACKEND", "unknown")

    with pytest.raises(GraphBackendError, match="Unsupported graph backend"):
        create_graph_repository(profile)


def test_factory_selects_promoted_oxigraph_store(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    profile,
) -> None:
    store_root = _build_promoted_store(tmp_path)
    monkeypatch.setenv("GRAPH_BACKEND", "oxigraph")
    monkeypatch.setenv("RDF_STORE_PATH", str(store_root))

    assert isinstance(create_graph_repository(profile), OxigraphGraphRepository)