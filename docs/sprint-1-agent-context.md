# Sprint 1 Agent Context: Codebase Architecture & Implementation Guide

- **Document type:** Supplementary implementation context for LLM agent delegation
- **Status:** Active
- **Created:** 2026-09-10
- **Last updated:** 2026-09-11 (post Batch 1A)
- **Branch baseline:** `sprint-1/core-platform` (Batch 1A merged from `feat/ontology-neutral-profiles`)
- **Prerequisite reading:** Before beginning any batch, read these documents in order:
  1. [Project Status](project-status-2026-09-10.md) — what exists now
  2. [Ontology Graph Explorer Requirements](ontology-graph-explorer-requirements.md) — what to build
  3. [Ontology Graph Explorer Implementation Plan](ontology-graph-explorer-implementation-plan.md) — how to build it (Sprint 1 = Section 6)

This document provides the **architecture map, file inventory, coding conventions,
and Wine-specific code inventory** that the requirements and implementation plan
documents do not include. It exists so that an LLM agent can implement Sprint 1
without reverse-engineering the repository structure.

---

## 1. Repository Layout

```text
graphql_layer/
├── main.py                          # FastAPI ASGI entry point
├── pyproject.toml                   # Python packaging and dependencies
├── pizza.owl                        # Manchester Pizza ontology (second fixture)
├── wine.rdf                         # W3C Wine ontology (RDF/XML)
├── wine-labels.ttl                  # Supplemental Wine labels (Turtle)
├── wine.yaml                        # Wine SOML schema (reference, not used at runtime)
├── wine-with-labels.yaml            # Wine SOML schema variant (reference)
│
├── config/
│   └── rdf-sources.yaml             # Current source manifest for Wine builds
│
├── domain/                          # Pure domain layer — no I/O, no storage
│   ├── __init__.py
│   ├── models.py                    # Value objects: GraphEntity, GraphRelationship, etc.
│   ├── ports.py                     # GraphRepository protocol (repository port)
│   └── traversal.py                 # Cursor encoding/decoding, pagination logic
│
├── services/                        # Application/business logic layer
│   ├── __init__.py
│   ├── exceptions.py                # Service-layer exceptions
│   ├── graph_service.py             # Domain facade: GraphService
│   ├── graph_retrieval.py           # GraphDB adapter (legacy, rollback only)
│   └── repository_factory.py        # Backend selection factory
│
├── adapters/                        # Storage adapter layer
│   ├── __init__.py
│   └── oxigraph/
│       ├── __init__.py              # Re-exports OxigraphGraphRepository
│       └── repository.py            # PyOxigraph GraphRepository implementation
│
├── ingestion/                       # Offline store build pipeline
│   ├── __init__.py
│   ├── manifest.py                  # Pydantic source manifest models
│   ├── reasoning.py                 # Wine-parity materialization profiles
│   └── build_store.py               # Store construction, promotion, cleanup
│
├── api/                             # Public API layer
│   ├── __init__.py
│   └── graphql_schema.py            # Strawberry GraphQL schema and resolvers
│
├── frontend/                        # React + Vite Graph Explorer
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                 # React entry point
│       ├── App.tsx                  # Main app component (~15KB)
│       ├── App.css                  # Styles
│       ├── api/
│       │   └── graph.ts             # GraphQL client, types, queries
│       ├── graph/
│       │   ├── state.ts             # Renderer-neutral graph state management
│       │   ├── state.test.ts        # Graph state unit tests
│       │   └── CytoscapeGraph.tsx   # Cytoscape renderer component
│       └── benchmark/               # cosmos.gl benchmark route (not production)
│
├── tests/                           # Backend test suite (pytest)
│   ├── __init__.py
│   ├── fakes.py                     # FakeGraphRepository and wine fixtures
│   ├── test_graph_service.py        # GraphService behavior tests
│   ├── test_graphql_schema.py       # GraphQL resolver tests
│   ├── test_oxigraph_repository.py  # Oxigraph adapter integration tests
│   ├── test_traversal.py            # Cursor/pagination tests
│   ├── test_ingestion.py            # Store build pipeline tests
│   ├── test_reasoning.py            # Materialization tests
│   ├── test_repository_factory.py   # Backend selection tests
│   ├── test_main.py                 # FastAPI app tests
│   ├── test_backend_comparison.py   # GraphDB ↔ Oxigraph parity
│   └── test_generate_wine_labels.py # Label generation utility test
│
├── scripts/                         # Utility scripts
├── benchmarks/                      # Benchmark reports (markdown)
├── docs/                            # All specification and analysis documents
│   ├── adr/                         # Architecture Decision Records
│   └── benchmarks/                  # Benchmark evidence
│
└── .data/                           # Generated stores (git-ignored)
    └── oxigraph/
        ├── current.json             # Active build pointer
        └── builds/                  # Content-addressed store builds
```

---

## 2. Architecture Layers (Current)

```text
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  App.tsx → api/graph.ts → GraphQL HTTP requests      │
│  graph/state.ts → CytoscapeGraph.tsx                 │
└────────────────────────┬────────────────────────────┘
                         │ HTTP (GraphQL)
┌────────────────────────┴────────────────────────────┐
│              api/graphql_schema.py                    │
│  Strawberry schema, resolvers, concrete GQL types    │
│  Depends ONLY on: GraphService, domain models        │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────┐
│            services/graph_service.py                  │
│  Business logic facade: validation, limits, paths    │
│  Depends on: GraphRepository (port), domain models   │
└────────────────────────┬────────────────────────────┘
                         │ GraphRepository protocol
┌────────────────────────┴────────────────────────────┐
│               domain/ports.py                        │
│  GraphRepository = Protocol (abstract port)          │
│  domain/models.py = value objects                    │
│  domain/traversal.py = cursor logic                  │
└────────────────────────┬────────────────────────────┘
                         │ implemented by
          ┌──────────────┴──────────────┐
          │                             │
┌─────────┴───────────┐   ┌────────────┴──────────────┐
│  adapters/oxigraph/  │   │ services/graph_retrieval.py│
│  repository.py       │   │ (GraphDB legacy adapter)   │
│  DEFAULT backend     │   │ Rollback/parity only       │
└──────────┬──────────┘   └───────────────────────────┘
           │
┌──────────┴──────────┐
│  PyOxigraph Store    │
│  (.data/oxigraph/)   │
└──────────┬──────────┘
           │ built by
┌──────────┴──────────┐
│  ingestion/          │
│  manifest.py         │
│  reasoning.py        │
│  build_store.py      │
└─────────────────────┘
```

---

## 3. Key Interfaces & Models

### 3.1 Domain Models (`domain/models.py`)

| Class | Purpose |
|-------|---------|
| `EntityKind` | Enum: `WINE`, `WINERY`, `REGION`, `GRAPE`, `UNKNOWN` |
| `TraversalDirection` | Enum: `OUTGOING`, `INCOMING`, `BOTH` |
| `GraphEntity` | Value object: `id`, `label`, `kind`, `description`, `properties` |
| `GraphRelationship` | Directed edge: `source` → `target` with `relation` label |
| `TraversalOptions` | Bounded options: direction, relations, limits, cursor, include_inferred |
| `PathOptions` | Path discovery budgets (direction, relations, max_depth, visited_node_limit) |
| `PageInfo` | Pagination: `truncated`, `next_cursor` |
| `GraphExpansion` | One page of graph neighborhood: center, nodes, relationships, page_info |
| `GraphPath` | Ordered path: entities tuple + relations tuple |

### 3.2 Repository Port (`domain/ports.py`)

```python
class GraphRepository(Protocol):
    async def get_entity(entity_id: str) -> GraphEntity | None
    async def search_entities(query: str, limit: int = 250) -> list[GraphEntity]
    async def get_neighbors(entity_id: str) -> list[GraphEntity]
    async def get_relationships(entity_id: str, options?) -> list[GraphRelationship]
    async def expand_graph(entity_id: str, options) -> GraphExpansion
    async def expand(entity_id: str, relation: str) -> list[GraphEntity]
    async def get_wines_by_region(region_id: str) -> list[GraphEntity]  # Wine-specific
    async def get_wines_by_grape(grape_id: str) -> list[GraphEntity]   # Wine-specific
```

### 3.3 Service Layer (`services/graph_service.py`)

`GraphService` wraps `GraphRepository` with:
- Entity existence validation
- Input normalization
- Server-owned hard limits (`GraphServiceLimits`)
- Traversal option clamping
- BFS path finding (service-level, not repository-native)
- Wine-specific helpers: `get_wine()`, `get_wines_by_region()`, `get_wines_by_grape()`

### 3.4 Service Exceptions (`services/exceptions.py`)

```text
GraphServiceError (base)
├── EntityNotFoundError
├── InvalidTraversalError
└── GraphBackendError
```

### 3.5 GraphQL Schema (`api/graphql_schema.py`)

Concrete Strawberry types:
- `Entity` (interface): `id`, `label`, `description`
- `Wine(Entity)`, `Winery(Entity)`, `Region(Entity)`, `Grape(Entity)`, `GenericEntity(Entity)`
- `GraphRelationship`: `relation`, `source`, `target`
- `GraphExpansion`: `center`, `nodes`, `relationships`, `page_info`

Query fields:
- `get_wine(id)` — returns `Wine` only
- `get_entity(id)` — returns `Entity`
- `search_entities(query)` — returns `[Entity]`
- `get_neighbors(id)` — returns `[Entity]`
- `get_relationships(id)` — returns `[GraphRelationship]`
- `expand(id, relation)` — legacy single-relation expand
- `expand_graph(id, options)` — bounded expansion with cursor

### 3.6 Source Manifest (`ingestion/manifest.py`)

Pydantic models:
- `RDFSource`: path, format, named graph
- `ImportPolicy`: mode (disabled/vendored), allowlist
- `RDFSourceManifest`: version, sources, imports, reasoning_profile
- `ResolvedRDFSource`: resolved path + SHA-256 checksum

---

## 4. Wine-Specific Code Inventory

These are all the locations where Wine ontology concepts are hardcoded. Sprint 1
Batch 1A must generalize all of them.

### 4.1 Domain Layer

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `domain/models.py` | Lines 9–16 | `EntityKind` enum: `WINE`, `WINERY`, `REGION`, `GRAPE` |
| `domain/ports.py` | Lines 37–38 | `get_wines_by_region()`, `get_wines_by_grape()` port methods |

### 4.2 Service Layer

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `services/graph_service.py` | Lines 46–51 | `get_wine()` method (enforces `EntityKind.WINE`) |
| `services/graph_service.py` | Lines 130–134 | `get_wines_by_region()`, `get_wines_by_grape()` delegations |

### 4.3 Oxigraph Adapter

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `adapters/oxigraph/repository.py` | Line 25 | `WINE_NAMESPACE` constant |
| `adapters/oxigraph/repository.py` | Lines 31–36 | `TYPE_BY_KIND` dict mapping `EntityKind` → Wine IRI |
| `adapters/oxigraph/repository.py` | Lines 37–42 | `RELATION_BY_NAME` dict: `hasMaker`, `locatedIn`, `madeFromGrape`, `adjacentRegion` |
| `adapters/oxigraph/repository.py` | Lines 129–134 | `expand()` rejects unknown relations against `RELATION_BY_NAME` |
| `adapters/oxigraph/repository.py` | Lines 146–168 | `get_wines_by_region()`, `get_wines_by_grape()`, `_related_wines()` |
| `adapters/oxigraph/repository.py` | Lines 181–208 | `_search_entities()` filters by `TYPE_BY_KIND` values |
| `adapters/oxigraph/repository.py` | Lines 218, 228–229 | `_get_relationships()` uses `RELATION_BY_NAME` |
| `adapters/oxigraph/repository.py` | Lines 277–281 | `_kind_for()` maps entity to `EntityKind` via `TYPE_BY_KIND` |

### 4.4 GraphQL API

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `api/graphql_schema.py` | Lines 44–73 | Concrete types: `Wine`, `Winery`, `Region`, `Grape`, `GenericEntity` |
| `api/graphql_schema.py` | Lines 75–98 | `_to_api_entity()` maps `EntityKind` → concrete GQL type |
| `api/graphql_schema.py` | Lines 217–234 | `get_wine()` resolver |
| `api/graphql_schema.py` | Lines 304–316 | Schema `types=` list includes concrete Wine types |

### 4.5 Frontend

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `frontend/src/api/graph.ts` | Lines 3, 84–97 | `EntityKind` type, `entityKind()` switch on `__typename` |
| `frontend/src/App.tsx` | Throughout | Wine-specific colors, legend, relation filter labels |

### 4.6 Tests & Fixtures

| File | Wine-specific code |
|------|-------------------|
| `tests/fakes.py` | `wine_graph_fixture()`, `FakeGraphRepository._wines_related_to()` |
| `tests/test_graph_service.py` | Tests reference `EntityKind.WINE`, Wine fixture entities |
| `tests/test_graphql_schema.py` | Tests reference Wine concrete types |
| `tests/test_oxigraph_repository.py` | Tests against Wine store |

### 4.7 Ingestion & Config

| File | Wine-specific code |
|------|-------------------|
| `config/rdf-sources.yaml` | References `wine.rdf`, `wine-labels.ttl`, `rdfs-wine-parity` |
| `ingestion/reasoning.py` | Only supports `rdfs-wine-parity` profile (line 33) |

### 4.8 Application Entry Point

| File | Location | Wine-specific code |
|------|----------|-------------------|
| `main.py` | Lines 36–40 | `title="Wine Graph API"`, description mentions Wine |

---

## 5. Coding Conventions

### 5.1 Python

- **Python 3.12+** with `from __future__ import annotations`
- **Type hints** on all function signatures
- **Frozen dataclasses** with `slots=True` for domain value objects
- **Pydantic v2** with `model_config = ConfigDict(frozen=True)` for config/manifest models
- **Async** service and repository APIs (using `asyncio.to_thread` to offload blocking PyOxigraph calls)
- **Protocol** for ports (not ABC)
- **No global mutable state** — dependencies injected via constructor
- **Imports:** stdlib → third-party → project (absolute imports only)
- **Docstrings:** One-line module docstrings, concise method docstrings

### 5.2 Testing

- **pytest** with `pytest-asyncio` (async tests use `async def test_...`)
- **Fakes over mocks** — `FakeGraphRepository` in `tests/fakes.py`
- **Fixtures** via `@pytest.fixture`
- **Test naming:** `test_<behavior_description>` (descriptive, no test IDs)
- **Assertions:** Plain `assert`, `pytest.raises` for expected errors
- **Run:** `pytest` from repo root; all 46 backend tests + 6 frontend tests must pass

### 5.3 Frontend

- **React 18 + TypeScript + Vite**
- **graphql-request** client library
- **Cytoscape.js** for graph rendering
- **No state management library** — pure functions in `state.ts`
- **Test:** Vitest (`npm test` in `frontend/`)
- **Build:** `npm run build` in `frontend/`

### 5.4 Git

- **Conventional Commits:** `feat(scope):`, `fix(scope):`, `refactor(scope):`, `docs(scope):`, `test(scope):`
- **Clean worktree check:** `git diff --check` must pass
- **No generated files committed:** `.data/`, `node_modules/`, `__pycache__/`, build artifacts

---

## 6. Second Ontology Fixture: Pizza

The `pizza.owl` file at the repository root is the Manchester Pizza Tutorial
Ontology v1.5 (~241KB, ~6800 lines, RDF/XML). It provides a structurally
different fixture for ontology-swap validation:

| Aspect | Wine Ontology | Pizza Ontology |
|--------|--------------|----------------|
| Namespace | `http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#` | `https://raw.githubusercontent.com/owlcs/pizza-ontology/refs/heads/master/pizza.owl#` |
| Primary classes | Wine, Winery, Region, WineGrape | Pizza, PizzaTopping, PizzaBase, Country |
| Key properties | hasMaker, locatedIn, madeFromGrape, adjacentRegion | hasTopping, hasBase, hasCountryOfOrigin, isIngredientOf |
| Imports | Declares food ontology import | None |
| Size | ~78KB RDF/XML + 18KB labels TTL | ~241KB RDF/XML |
| OWL features | Restrictions, inverses, symmetrics, intersections | Restrictions, disjoints, enumerations, equivalents, value restrictions |

---

## 7. Environment & Commands

### Run backend
```bash
uvicorn main:app --reload --port 8000
```

### Run backend tests
```bash
pytest
```

### Run frontend dev server
```bash
cd frontend && npm run dev
```

### Run frontend tests and build
```bash
cd frontend && npm test && npm run build && npx eslint .
```

### Build RDF store (must exist before backend starts with oxigraph)
```bash
python -m ingestion.build_store config/rdf-sources.yaml
```

### Environment variables
```text
GRAPH_BACKEND=oxigraph          # or "graphdb"
RDF_STORE_PATH=.data/oxigraph   # store root
RDF_LABEL_LANGUAGES=en,ANY      # label preference
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

---

## 8. Sprint 1 Batch Sequencing

| Batch | Name | Depends On | Status | Focus |
|-------|------|-----------|--------|-------|
| **1A** | Ontology-Neutral Profiles | — | ✅ DONE | Profile schema, remove Wine hardcoding, profile metadata API |
| **1B** | Semantic Domain & Repository | 1A | 🔜 NEXT | Generic domain types, enriched repository, class/property models |
| **1C** | Secure Imports & Parsing | 1A | ⬜ | Vendor Food import, parser hardening, serialization tests |
| **1D** | Full OWL 2 DL Reasoning | 1A, 1C | ⬜ | Reasoner ADR, ReasoningProvider port, isolated reasoning |
| **1E** | Paths, Comparison, Errors | 1A, 1B | ⬜ | Repository-native paths, comparison, stable error codes |
| **1F** | GraphQL Safety | 1A, 1E | ⬜ | Complexity limits, timeouts, auth boundary |
| **1G** | Store Operations | 1A, 1D | ⬜ | Lifecycle commands, readiness, telemetry |
| **1H** | Frontend Contracts & CI | 1A, 1B | ⬜ | Shared packages, renderer contracts, CI gates |

---

## 9. Batch 1A Completion Summary

Batch 1A was implemented in commit `08c8776` on branch `feat/ontology-neutral-profiles`.
All 50 backend tests pass. All 6 frontend tests pass. Frontend builds cleanly.

### 9.1 What Batch 1A Changed

#### New Files
- `domain/ontology_profile.py` — Pydantic ontology package schema and loader
- `config/wine-profile.yaml` — Wine ontology profile
- `config/pizza-profile.yaml` — Pizza ontology profile  
- `tests/test_ontology_profile.py` — 4 profile schema tests

#### Key Modifications
- `domain/models.py` — `EntityKind` enum replaced with `SemanticResourceKind = str` + `UNKNOWN_KIND`
- `domain/ports.py` — `get_wines_by_region()`, `get_wines_by_grape()` removed from `GraphRepository` protocol
- `services/graph_service.py` — Takes `OntologyPackage` profile, validates relations against profile, Wine methods deprecated with `warnings.warn()`
- `adapters/oxigraph/repository.py` — Takes `OntologyPackage` profile, all kind/predicate/search logic is profile-driven. Wine constants removed.
- `api/graphql_schema.py` — Added `OntologyEntity`, `ActiveProfile` types, `get_active_profile` query. Wine types marked deprecated.
- `services/repository_factory.py` — Passes profile to adapters
- `main.py` — Loads profile, generic title
- `frontend/src/api/graph.ts` — Added `fetchProfile()`, `ActiveProfile` types, `OntologyEntity` support
- `frontend/src/App.tsx` — Dynamic title, categories, predicates from profile
- All test files updated for string-based kinds and profile injection

### 9.2 Outstanding Defects (Must-Fix in Batch 1B)

| ID | Severity | Description | File | Lines |
|----|----------|-------------|------|-------|
| DEF-1 | **HIGH** | `Query.expand` resolver missing `return` statement — returns `None` instead of entities | `api/graphql_schema.py` | 349–364 |
| DEF-2 | **MEDIUM** | Cytoscape canvas stylesheet has hardcoded Wine color selectors (`node.wine`, etc.) — non-Wine profiles render gray nodes | `frontend/src/graph/CytoscapeGraph.tsx` | 107–110 |
| DEF-3 | **LOW** | `_label_for()` and `_literal_value()` hardcode `RDFS_LABEL`/`RDFS_COMMENT` instead of reading profile's label/description predicates | `adapters/oxigraph/repository.py` | 271–289 |
| DEF-4 | **LOW** | No GraphQL test for `get_active_profile` query | `tests/test_graphql_schema.py` | — |
| DEF-5 | **LOW** | No GraphQL test for `expand(id, relation)` resolver (which would have caught DEF-1) | `tests/test_graphql_schema.py` | — |

### 9.3 Current Architecture After Batch 1A

```text
OntologyPackage (profile YAML)
        │
        ├──→ OxigraphGraphRepository (profile-driven kind/search/predicates)
        │
        ├──→ GraphService (profile-driven limits + traversal validation)
        │         │
        │         └──→ get_active_profile() → OntologyPackage
        │
        └──→ GraphQL schema (get_active_profile query → ActiveProfile type)
                  │
                  └──→ Frontend (fetchProfile() → dynamic categories/predicates)
```

### 9.4 Key Interfaces After Batch 1A

| Interface | Location | Notes |
|-----------|----------|-------|
| `SemanticResourceKind = str` | `domain/models.py` | Replaces old `EntityKind` enum |
| `UNKNOWN_KIND = "Unknown"` | `domain/models.py` | Default for unclassified entities |
| `OntologyPackage` | `domain/ontology_profile.py` | Top-level profile schema |
| `load_ontology_profile(path?)` | `domain/ontology_profile.py` | Reads YAML, validates, returns profile |
| `GraphService(repo, profile)` | `services/graph_service.py` | Constructor now requires profile |
| `OxigraphGraphRepository(profile, ...)` | `adapters/oxigraph/repository.py` | Constructor now requires profile |
| `create_graph_repository(profile, client?)` | `services/repository_factory.py` | Factory now requires profile |
| `OntologyEntity(Entity)` | `api/graphql_schema.py` | Generic GQL type with `kind: str` |
| `ActiveProfile` | `api/graphql_schema.py` | Profile metadata GQL type |
| `fetchProfile()` | `frontend/src/api/graph.ts` | Frontend profile fetcher |
