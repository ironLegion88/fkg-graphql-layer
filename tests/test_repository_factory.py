"""Tests for graph backend selection at the composition boundary."""

from __future__ import annotations

import pytest

from services.exceptions import GraphBackendError
from services.graph_retrieval import GraphRetrievalService
from services.repository_factory import create_graph_repository


def test_factory_defaults_to_graphdb(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GRAPH_BACKEND", raising=False)

    assert isinstance(create_graph_repository(), GraphRetrievalService)


def test_factory_rejects_unknown_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GRAPH_BACKEND", "unknown")

    with pytest.raises(GraphBackendError, match="Unsupported graph backend"):
        create_graph_repository()