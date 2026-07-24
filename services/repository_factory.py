"""Composition helpers for selecting a graph repository implementation."""

from __future__ import annotations

import os

import httpx

from domain.ports import GraphRepository
from services.exceptions import GraphBackendError
from services.graph_retrieval import GraphDBSettings, GraphRetrievalService


def create_graph_repository(
    client: httpx.AsyncClient | None = None,
) -> GraphRepository:
    """Create the configured storage adapter behind the neutral repository port."""
    backend = os.getenv("GRAPH_BACKEND", "graphdb").strip().casefold()
    if backend == "graphdb":
        return GraphRetrievalService(GraphDBSettings.from_environment(), client)
    raise GraphBackendError(f"Unsupported graph backend '{backend}'")