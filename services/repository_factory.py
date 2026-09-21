"""Composition helpers for selecting a graph repository implementation."""

from __future__ import annotations

import os

from adapters.oxigraph import OxigraphGraphRepository
from domain.ontology_profile import OntologyPackage
from domain.ports import GraphRepository
from services.exceptions import GraphBackendError


def create_graph_repository(
    profile: OntologyPackage,
    client: object | None = None,
) -> GraphRepository:
    """Create the configured storage adapter behind the neutral repository port."""
    backend = os.getenv("GRAPH_BACKEND", "oxigraph").strip().casefold()
    if backend == "graphdb":
        import httpx

        from services.graph_retrieval import GraphDBSettings, GraphRetrievalService

        if not isinstance(client, httpx.AsyncClient):
            raise GraphBackendError("GraphDB backend requires an httpx.AsyncClient")
        return GraphRetrievalService(GraphDBSettings.from_environment(), client)
    if backend == "oxigraph":
        return OxigraphGraphRepository(profile=profile)
    raise GraphBackendError(f"Unsupported graph backend '{backend}'")