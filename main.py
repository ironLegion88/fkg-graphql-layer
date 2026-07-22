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
from services.graph_retrieval import GraphDBSettings, GraphRetrievalService
from services.graph_service import GraphService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create one HTTP client for the application and release it at shutdown."""
    settings = GraphDBSettings.from_environment()
    client = httpx.AsyncClient(timeout=settings.timeout_seconds)
    app.state.graph_service = GraphService(GraphRetrievalService(settings, client))
    try:
        yield
    finally:
        await client.aclose()


async def get_graphql_context(request: Request) -> GraphQLContext:
    """Inject the database-agnostic service into every GraphQL request."""
    return {"graph_service": request.app.state.graph_service}


app = FastAPI(
    title="Wine Graph API",
    description="A database-agnostic GraphQL facade for the Sample Wines knowledge graph.",
    lifespan=lifespan,
)
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
