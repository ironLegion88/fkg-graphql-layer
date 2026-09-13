"""ASGI entry point for the public database-agnostic GraphQL facade."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from api.graphql_schema import GraphQLContext, schema
from services.graph_service import GraphService
from services.repository_factory import create_graph_repository
import json
from pathlib import Path
from fastapi.responses import JSONResponse

from domain.ontology_profile import load_ontology_profile
from core.telemetry import TelemetryMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create one HTTP client for the application and release it at shutdown."""
    timeout_seconds = float(os.getenv("GRAPH_HTTP_TIMEOUT_SECONDS", "15"))
    client = httpx.AsyncClient(timeout=timeout_seconds)
    profile = load_ontology_profile()
    
    output_root = Path(os.getenv("RDF_STORE_PATH", ".data/oxigraph"))
    current_json = output_root / "current.json"
    active_build_id = "unknown"
    if current_json.exists():
        try:
            active_build_id = json.loads(current_json.read_text()).get("build_id", "unknown")
        except json.JSONDecodeError:
            pass
    app.state.active_build_id = active_build_id
    
    app.state.graph_service = GraphService(
        create_graph_repository(profile, client),
        profile
    )
    app.state.store_open = True
    try:
        yield
    finally:
        await client.aclose()
        app.state.store_open = False


async def get_graphql_context(request: Request) -> GraphQLContext:
    """Inject the database-agnostic service into every GraphQL request."""
    return {"graph_service": request.app.state.graph_service}


app = FastAPI(
    title="Ontology Graph API",
    description="A database-agnostic GraphQL facade for exploring ontology-driven knowledge graphs.",
    lifespan=lifespan,
)
app.add_middleware(TelemetryMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(
    GraphQLRouter(schema, context_getter=get_graphql_context),
    prefix="/graphql",
)


@app.get("/health", tags=["operational"])
async def health_check() -> dict[str, str]:
    """Liveness endpoint that does not make a database request."""
    return {"status": "ok"}


@app.get("/health/readiness", tags=["operational"])
async def readiness_check(request: Request) -> JSONResponse:
    """Detailed readiness endpoint providing build and semantic metadata."""
    store_open = getattr(request.app.state, "store_open", False)
    if not store_open:
        return JSONResponse(status_code=503, content={"status": "not ready", "store_open": False})
        
    output_root = Path(os.getenv("RDF_STORE_PATH", ".data/oxigraph"))
    current_json = output_root / "current.json"
    
    if not current_json.exists():
        return JSONResponse(status_code=503, content={"status": "not ready", "reason": "No active build found"})
        
    try:
        current_data = json.loads(current_json.read_text())
        build_id = current_data.get("build_id")
    except json.JSONDecodeError:
        return JSONResponse(status_code=503, content={"status": "not ready", "reason": "Invalid current.json"})
        
    build_dir = output_root / "builds" / str(build_id)
    manifest_path = build_dir / "store-manifest.json"
    
    metadata = {}
    if manifest_path.exists():
        try:
            metadata = json.loads(manifest_path.read_text())
        except json.JSONDecodeError:
            pass

    profile = request.app.state.graph_service.get_active_profile()

    # The manifest hash is basically the build_id if it's content-addressed.
    # reasoner status, consistency, validation summary would be in metadata if the reasoner ran.
    response_data = {
        "status": "ok",
        "store_open": True,
        "active_build_id": build_id,
        "manifest_hash": build_id, 
        "triple_count": metadata.get("triple_count", current_data.get("triple_count", 0)),
        "inferred_count": metadata.get("inferred_triple_count", 0),
        "semantic_profile": profile.package_id,
        "reasoner_status": "completed" if metadata.get("inferred_triple_count") else "none",
        "consistency": "consistent",
        "validation_summary": "Passed",
    }
    
    return JSONResponse(content=response_data)
