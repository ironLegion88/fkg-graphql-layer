# Sprint 2 Agent Context: Architecture, Inventory & Implementation Guide

- **Document type:** Supplementary implementation context for LLM agent delegation
- **Status:** Active — Phase 0 complete, Phase 1 in progress
- **Created:** 2026-09-19
- **Last Updated:** 2026-09-27 (Batch 2B complete)
- **Current Sprint:** Sprint 2 (Supported Application)
- **Phase 0 Status:** ✅ COMPLETE (all 9 gaps resolved, 142 backend + 6 frontend tests passing)
- **Phase 1 Progress:** Batch 2A (AppShell & Navigation) and Batch 2B (Semantic Inspector & Provenance) ✅ COMPLETE
- **Sprint 2 Baseline Branch:** `sprint-2/cytoscape` (created from `sprint-1/core-platform`, with `sprint-2/gap-remediation` merged)
- **Per-batch branches:** Each Phase 1 batch gets a dedicated branch from `sprint-2/cytoscape`, merged back upon completion
- **Prerequisite reading:** Before beginning any batch, read these documents in order:
  1. [Sprint 2 Implementation Plan](sprint-2-implementation-plan.md) — what to build and how (Phase 1)
  2. [Requirements](ontology-graph-explorer-requirements.md) — full requirements specification
  3. [Implementation Plan](ontology-graph-explorer-implementation-plan.md) — Sprint 2 = Section 7
  4. This document — architecture map, file inventory, coding conventions

This document provides the **architecture map, file inventory, interface details,
coding conventions, and batch-specific guidance** needed to implement Sprint 2
Phase 1 (the supported application) without reverse-engineering the repository.

---

## 1. Repository Layout (Post-Sprint 1)

```text
graphql_layer/
├── main.py                              # FastAPI ASGI entry point
├── pyproject.toml                       # Python packaging and dependencies
├── pizza.owl                            # Manchester Pizza ontology fixture
├── wine.rdf                             # W3C Wine ontology (RDF/XML)
├── wine-labels.ttl                      # Supplemental Wine labels (Turtle)
│
├── config/
│   ├── rdf-sources.yaml                 # Production source manifest (Wine)
│   ├── wine-profile.yaml                # Wine ontology package profile
│   └── pizza-profile.yaml               # Pizza ontology package profile
│
├── vendor/
│   └── food.rdf                         # Vendored W3C Food Ontology (SHA-256 pinned)
│
├── domain/                              # Pure domain layer — no I/O, no storage
│   ├── __init__.py
│   ├── models.py                        # GraphEntity, GraphRelationship, Path*, Search*, Comparison*, Expansion*
│   ├── semantic_models.py               # SemanticKind, CompactIRI, ClassInfo, PropertyInfo, ResourceMetadata
│   ├── ontology_profile.py              # OntologyPackage (12 Pydantic sections), load_ontology_profile()
│   ├── ports.py                         # GraphRepository + SemanticRepository protocols
│   └── traversal.py                     # Cursor encoding/decoding, pagination
│
├── services/                            # Application logic layer
│   ├── __init__.py
│   ├── exceptions.py                    # GraphQLErrorCode enum, GraphServiceError hierarchy
│   ├── graph_service.py                 # Domain facade: validation, limits, deprecated Wine shims
│   ├── graph_retrieval.py               # GraphDB adapter (legacy, rollback only)
│   └── repository_factory.py            # Backend selection: oxigraph (default) vs graphdb
│
├── adapters/                            # Storage adapter layer
│   └── oxigraph/
│       ├── __init__.py
│       ├── repository.py                # OxigraphGraphRepository (BFS paths, comparison, deadlines)
│       └── semantic_repository.py       # OxigraphSemanticRepository (class/property introspection)
│
├── ingestion/                           # Offline store build pipeline
│   ├── __init__.py
│   ├── manifest.py                      # Pydantic source manifest + build ID
│   ├── reasoning.py                     # Profile dispatch (parity / hermit / none)
│   ├── build_store.py                   # Atomic build, promotion, cleanup
│   ├── security.py                      # Path traversal, file size, XXE protection
│   ├── imports.py                       # Vendored import resolution with BFS cycle detection
│   ├── lifecycle.py                     # CLI: list, backup, restore, promote, rollback
│   └── reasoners/
│       ├── provider.py                  # ReasoningProvider protocol
│       ├── hermit_provider.py           # HermiT subprocess provider
│       └── _hermit_worker.py            # owlready2 subprocess worker
│
├── core/
│   └── telemetry.py                     # TelemetryMiddleware (structured JSON logs)
│
├── api/                                 # Public API layer
│   ├── __init__.py
│   ├── graphql_schema.py                # Strawberry GraphQL schema (489 lines)
│   └── security.py                      # GraphQLSafetyExtension (depth/fields/timeout/auth)
│
├── frontend/                            # React 19 + TypeScript + Vite
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                     # Entry point (App mode vs Benchmark mode)
│       ├── App.tsx                      # Root workspace component
│       ├── App.css
│       ├── api/
│       │   └── graph.ts                 # GraphQL client (OntologyDataProvider impl)
│       ├── graph/
│       │   ├── CytoscapeGraph.tsx        # DetailGraphRenderer (Cytoscape wrapper)
│       │   ├── state.ts                 # Pure functional graph state engine
│       │   └── state.test.ts
│       ├── interfaces/
│       │   ├── models.ts                # Shared TypeScript domain types
│       │   ├── renderers.ts             # DetailGraphRenderer, OverviewGraphRenderer, OntologyDataProvider
│       │   └── index.ts
│       └── benchmark/                   # cosmos.gl benchmark suite (not production)
│
├── tests/                               # 104 backend tests (pytest)
│   ├── __init__.py
│   ├── fakes.py                         # FakeGraphRepository and wine fixtures
│   ├── fixtures/                        # 14 RDF test fixtures
│   ├── test_graph_service.py            # 8 tests
│   ├── test_graphql_schema.py           # 8 tests
│   ├── test_graphql_safety.py           # 5 tests
│   ├── test_oxigraph_repository.py      # 6 tests
│   ├── test_oxigraph_semantic_repository.py # 2 tests
│   ├── test_ontology_profile.py         # 4 tests
│   ├── test_import_resolution.py        # 12 tests
│   ├── test_parser_security.py          # 7 tests
│   ├── test_serialization.py            # 12 tests
│   ├── test_reasoning.py               # 3 tests
│   ├── test_reasoning_providers.py      # 3 tests
│   ├── test_traversal.py               # 6 tests
│   ├── test_ingestion.py               # 7 tests
│   ├── test_store_lifecycle.py          # 2 tests
│   ├── test_telemetry.py               # 3 tests
│   ├── test_main.py                     # 4 tests
│   ├── test_repository_factory.py       # 4 tests
│   ├── test_semantic_models.py          # 4 tests
│   ├── test_exceptions.py              # 3 tests
│   ├── test_paths_comparisons.py        # 2 tests
│   ├── test_additional_fixtures.py      # 3 tests
│   ├── test_backend_comparison.py       # 1 test
│   └── test_generate_wine_labels.py     # 1 test
│
├── .github/workflows/
│   └── ci.yml                           # GitHub Actions: pytest + vitest + vite build
│
├── docs/                                # All specification and planning documents
│   ├── batch-reports/                   # Sprint 1 batch reports (1A–1H)
│   ├── reasoner-adr.md
│   ├── deployment-model.md
│   ├── sprint-1-completion-report.md
│   ├── project-status-2026-09-14.md
│   ├── sprint-2-implementation-plan.md  # ← PRIMARY PLAN FOR THIS SPRINT
│   └── sprint-3-implementation-plan.md
│
└── .data/                               # Generated stores (git-ignored)
    └── oxigraph/
        ├── current.json                 # Active build pointer
        └── builds/                      # Content-addressed store builds
```

---

## 2. Architecture Layers (Post-Sprint 1)

```text
┌──────────────────────────────────────────────────────────┐
│  Frontend (React 19 + TypeScript + Vite)                 │
│  ├─ CytoscapeGraph (DetailGraphRenderer)                 │
│  ├─ Graph State Engine (pure functions, 500/1000 limits) │
│  ├─ GraphQL Client (graphql-request)                     │
│  └─ Shared Interfaces (models.ts, renderers.ts)          │
├──────────────────────────────────────────────────────────┤
│  GraphQL API (Strawberry + GraphQLSafetyExtension)       │
│  ├─ 10 Query fields (get_entity, search, expand, etc.)   │
│  ├─ Safety: depth=7, fields=100, timeout=15s, auth       │
│  └─ Error Masking: 5 stable codes (needs 16)             │
├──────────────────────────────────────────────────────────┤
│  GraphService (services/graph_service.py)                │
│  ├─ Validation, limits, deadline propagation             │
│  └─ Profile-driven traversal normalization               │
├──────────────────────────────────────────────────────────┤
│  Domain (domain/)                                        │
│  ├─ GraphRepository protocol (11 methods)                │
│  ├─ SemanticRepository protocol (5 methods) ← NOT WIRED │
│  └─ OntologyPackage Pydantic config                      │
├──────────────────────────────────────────────────────────┤
│  Adapters (adapters/oxigraph/)                           │
│  ├─ OxigraphGraphRepository (all 11 methods)             │
│  └─ OxigraphSemanticRepository (all 5 methods)           │
├──────────────────────────────────────────────────────────┤
│  Ingestion Pipeline (ingestion/)                         │
│  ├─ Secure parsing, vendored imports, HermiT reasoning   │
│  └─ Lifecycle CLI, atomic promotion                      │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Critical Gap Inventory (Phase 0 Must-Fix)

These are the specific gaps from Sprint 1 that Phase 0 must address. Each gap includes exact file locations and the code that needs changing.

### Gap 1: SemanticRepository Not Wired into GraphQL — ✅ RESOLVED (Batch 0A)

Resolved by Batch 0A (commit `6f66e5e` → `6f8f821`):
- `OxigraphSemanticRepository` instantiated in `main.py` lifespan (line 45–48)
- `GraphQLContext` TypedDict includes `semantic_repository` (line 49)
- 7 new query resolvers added: `get_resource_metadata`, `get_class_info`, `get_property_info`, `list_classes`, `list_properties`, `get_expansion_preview`, `search`
- 10 new Strawberry types added for all semantic models
- 13 new tests in `tests/test_semantic_graphql.py`

**Known issue from Batch 0A:** `adapters/oxigraph/repository.py:254` has a SPARQL projection bug — `SELECT DISTINCT ?entity` should be `SELECT DISTINCT ?entity ?needle` when using variable substitutions. Patched in test scope only. Should be fixed in a maintenance commit.

### Gap 2: GraphQL Relationship Lacks Provenance

**What exists:**
- `domain/models.py` `GraphRelationship` has: `relationship_id`, `predicate_iri`, `predicate_compact_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`

**What's missing:**
- `api/graphql_schema.py` `GraphRelationship` (line 137) only has: `source`, `target`, `relation`
- `_to_api_relationship()` (line 223) drops all provenance fields

### Gap 3: Error Codes Incomplete

**What exists:**
- `services/exceptions.py` `GraphQLErrorCode` has 5 codes: `NOT_FOUND`, `INVALID_CURSOR`, `BUDGET_EXHAUSTED`, `INTERNAL_ERROR`, `INVALID_ARGUMENT`
- `api/security.py` emits `TIMEOUT` string (line 103) and `BUDGET_EXHAUSTED` (lines 90, 95) but NOT via enum
- `api/graphql_schema.py` emits `UNAUTHORIZED` string (line 263) but NOT via enum

**What's missing:**
- 11 additional codes needed: `TIMEOUT`, `CANCELLED`, `FORBIDDEN`, `STORE_NOT_READY`, `ONTOLOGY_INCONSISTENT`, `REASONER_UNAVAILABLE`, `EXPLANATION_UNAVAILABLE`, `UNSUPPORTED_SEMANTIC_CONSTRUCT`, `BACKEND_UNAVAILABLE`, `INVALID_PREDICATE`, `QUERY_TOO_COMPLEX`

### Gap 4: build_id Always None

**What exists:**
- `main.py` line 39: `app.state.active_build_id = active_build_id` (correctly read from `current.json`)

**What's missing:**
- `api/graphql_schema.py` line 466: `build_id=None` is hardcoded instead of reading from context

### Gap 5: Readiness Hardcodes Consistency

**Where:** `main.py` line 132: `"consistency": "consistent"` hardcoded instead of reading from `store-manifest.json`

---

## 4. Key Interfaces & Current State

### 4.1 GraphRepository Protocol (`domain/ports.py`)

```python
class GraphRepository(Protocol):
    async def get_entity(entity_id: str) -> GraphEntity | None
    async def search_entities(query: str, limit: int = 250) -> list[GraphEntity]
    async def search(options: SearchOptions) -> SearchResult                      # ← NOT in GraphQL
    async def get_neighbors(entity_id: str) -> list[GraphEntity]
    async def get_expansion_preview(entity_id: str) -> ExpansionPreview           # ← NOT in GraphQL
    async def get_relationships(entity_id, options, ...) -> list[GraphRelationship]
    async def expand_graph(entity_id, options, deadline=None) -> GraphExpansion
    async def expand(entity_id, relation, deadline=None) -> list[GraphEntity]     # deprecated
    async def find_shortest_path(source_id, target_id, options, deadline) -> PathResult
    async def compare_entities(id_a, id_b, deadline=None) -> ComparisonResult
```

### 4.2 SemanticRepository Protocol (`domain/ports.py`) — NOT YET WIRED TO GRAPHQL

```python
class SemanticRepository(Protocol):
    async def get_resource_metadata(iri: str) -> ResourceMetadata | None
    async def get_class_info(class_iri: str) -> ClassInfo | None
    async def get_property_info(property_iri: str) -> PropertyInfo | None
    async def list_classes(limit: int = 100, offset: int = 0) -> list[ClassInfo]
    async def list_properties(limit: int = 100, offset: int = 0) -> list[PropertyInfo]
```

### 4.3 Current GraphQL Query Fields (`api/graphql_schema.py`)

| Field | Status | Notes |
|---|---|---|
| `get_entity(id)` | ✅ Active | Generic entity lookup |
| `search_entities(query)` | ✅ Active | Basic string search |
| `get_neighbors(id)` | ✅ Active | 1-hop neighbors |
| `get_relationships(id)` | ✅ Active | Missing provenance fields (Gap 2) |
| `expand_graph(id, options)` | ✅ Active | Bounded with cursors |
| `find_path(source_id, target_id)` | ✅ Active | BFS shortest path |
| `compare(id_a, id_b)` | ✅ Active | Entity comparison |
| `get_active_profile()` | ✅ Active | build_id still None (Gap 4) |
| `get_resource_metadata(iri)` | ✅ Active | Added Batch 0A |
| `get_class_info(iri)` | ✅ Active | Added Batch 0A |
| `get_property_info(iri)` | ✅ Active | Added Batch 0A |
| `list_classes(limit, offset)` | ✅ Active | Added Batch 0A |
| `list_properties(limit, offset)` | ✅ Active | Added Batch 0A |
| `get_expansion_preview(id)` | ✅ Active | Added Batch 0A |
| `search(options)` | ✅ Active | Added Batch 0A |
| `expand(id, relation)` | ⚠️ Deprecated | Legacy |
| `get_wine(id)` | ⚠️ Deprecated | Legacy |

### 4.4 Semantic Domain Types Available (`domain/semantic_models.py`)

| Type | Fields | GraphQL Type Needed |
|---|---|---|
| `SemanticKind` | 12-value Literal | String |
| `CompactIRI` | `full_iri`, `prefix`, `local_name`, `namespace` | `CompactIRIType` |
| `TypedValue` | `lexical_form`, `datatype_iri`, `language`, `normalized_value` | `TypedValueType` |
| `MultilingualLabel` | `value`, `language`, `datatype`, `predicate_iri` | `MultilingualLabelType` |
| `Annotation` | `predicate_iri`, `value`, `language` | `AnnotationType` |
| `SourceProvenance` | `source_graph`, `build_id`, `is_inferred` | — |
| `ResourceMetadata` | `iri`, `compact_iri`, `semantic_kind`, `asserted_types`, `inferred_types`, `labels`, `preferred_label`, `descriptions`, `aliases`, `annotations`, `source_graphs`, `build_id` | `ResourceMetadataType` |
| `ClassInfo` | `iri`, `compact_iri`, `label`, `direct_parents`, `all_ancestors`, `direct_children`, `all_descendants`, `equivalent_classes`, `disjoint_classes`, `instance_count`, `annotations`, `restrictions` | `ClassInfoType` |
| `PropertyInfo` | `iri`, `compact_iri`, `label`, `property_kind`, `domains`, `ranges`, `inverse_of`, `equivalent_properties`, `sub_properties`, `super_properties`, `characteristics`, `usage_count`, `annotations` | `PropertyInfoType` |

### 4.5 Frontend Renderer Contracts (`frontend/src/interfaces/renderers.ts`)

```typescript
interface DetailGraphRenderer {
  graph: ExplorerGraph
  selectedId: string | null
  categoryColors?: Record<string, string>
  onSelectEntity(id: string): void
}

interface OverviewGraphRenderer {
  graph: ExplorerGraph
  onSelectCluster(clusterId: string): void
  onSelectEntity(entityId: string): void
}

interface OntologyDataProvider {
  fetchProfile(): Promise<ActiveProfile>
  searchEntities(query: string): Promise<GraphEntity[]>
  expandGraph(request: ExpansionRequest): Promise<GraphExpansion>
}
```

### 4.6 Graph State Engine (`frontend/src/graph/state.ts`)

- `ExplorerGraph` — `entities: Record<string, GraphEntity>`, `relationships: Record<string, GraphRelationship>`
- `DEFAULT_VISIBLE_LIMITS` — 500 nodes, 1,000 edges
- `mergeExpansion()` — Enforces limits, prevents dangling edges, tracks in `ExpansionRecord`
- `collapseExpansion()` — Removes added edges, prunes orphan nodes
- `relationshipsForEntity()` — Incident edge lookup

---

## 5. Coding Conventions

### 5.1 Python

- **Python 3.12+** with `from __future__ import annotations`
- **Type hints** on all function signatures
- **Frozen dataclasses** with `slots=True` for domain value objects
- **Pydantic v2** with `model_config = ConfigDict(frozen=True)` for config/manifest models
- **Async** service and repository APIs (using `asyncio.to_thread` for blocking PyOxigraph)
- **Protocol** for ports (not ABC)
- **No global mutable state** — dependencies injected via constructor or context
- **Imports:** stdlib → third-party → project (absolute imports only)
- **Docstrings:** One-line module docstrings, concise method docstrings

### 5.2 Testing

- **pytest** with `pytest-asyncio`
- **Fakes over mocks** — `FakeGraphRepository` in `tests/fakes.py`
- **Test naming:** `test_<behavior_description>`
- **Run backend:** `.venv\Scripts\python.exe -m pytest tests/ -v --tb=short`
- **Run frontend:** `cd frontend; npm test`
- **Build frontend:** `cd frontend; npm run build`
- **All 117 backend + 6 frontend tests must pass after Batch 0A**

### 5.3 Frontend

- **React 19 + TypeScript ~6.0 + Vite 8.1**
- **graphql-request** client library
- **Cytoscape.js** for graph rendering
- **@cosmos.gl/graph** for GPU overview (Sprint 2)
- **No state management library** — pure functions in `state.ts`
- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`

### 5.4 Git (CRITICAL — Follow Precisely)

- **Conventional Commits:**
  ```
  <type>(<scope>): short description (≤72 chars)

  Longer description of what changed and why.
  Reference requirement IDs where applicable (e.g., "Implements GQ-104").
  ```
- **Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `ci`, `chore`
- **Scopes:** `api`, `domain`, `services`, `adapters`, `ingestion`, `frontend`, `graphql`, `store`, `ci`
- **Small, focused commits** — ONE logical change per commit. Never combine unrelated changes.
- **Clean worktree:** `git diff --check` must pass
- **No generated files:** `.data/`, `node_modules/`, `__pycache__/`, `dist/`

### 5.5 Documentation

- Each batch MUST produce a report: `docs/batch-reports/batch-{id}-report.md`
- Update `docs/sprint-2-agent-context.md` after each batch with completion summary
- Follow the Sprint 1 batch report format (see `docs/batch-reports/batch-1a-report.md` for example)

---

## 6. Phase 0 Batch Sequencing & Definition of Done

| Batch | Name | Depends On | Status | Focus |
|---|---|---|---|---|
| **0A** | Wire SemanticRepository into GraphQL | — | ✅ DONE | 7 new resolvers, 10 new types, 13 new tests |
| **0B** | Expose Relationship Provenance | 0A | ✅ DONE | 5 provenance fields, DEF-0A-1 fix, 5 new tests |
| **0C** | Error Codes + build_id + Readiness | 0A | ✅ DONE | Complete enum (16 codes), wire build_id, dynamic readiness consistency |
| **0D** | CI Hardening + Tech Debt | 0A | ✅ DONE | Strict lint, guard imports, shared fixtures |

### Definition of Done (per batch)

A batch is complete only when:
1. Code is implemented with layer boundaries intact
2. All new and existing tests pass (`pytest` + `npm test` + `npm run build`)
3. Public errors contain no sensitive implementation details
4. Batch report written to `docs/batch-reports/`
5. Agent context document updated with completion summary
6. `git diff --check` passes
7. Each commit follows conventional commit format with focused scope

---

## 7. Phase 1 Batch Sequencing

| Batch | Name | Depends On | Status | Focus |
|---|---|---|---|---|
| **2A** | App Shell & Navigation | Phase 0 | ✅ DONE | Three-panel layout, class tree, search, command palette |
| **2B** | Semantic Inspector | 2A | Pending | Resource, class, property, consistency, provenance panels |
| **2C** | Cytoscape Detail | 2A | Pending | Preview, undo/redo, multi-hop, layouts |
| **2D** | Accessible Views | 2A | Pending | Table, trees, ARIA, responsive, reduced motion |
| **2E** | Paths/Comparison/Explanation UI | 2B | Pending | Path builder, comparison, "Why?" panel |
| **2F** | Sessions | 2B, 2C | Pending | Save/restore, compatibility, deep links |
| **2G** | cosmos.gl Overview | 2A | Pending | Class-based clusters, GPU fallback, drill-down |
| **2H** | E2E Testing | 2A–2G | Pending | Playwright, accessibility, performance, memory |

---

## 8. Environment & Commands

### Backend
```powershell
# Run backend
uvicorn main:app --reload --port 8000

# Run tests
.venv\Scripts\python.exe -m pytest tests/ -v --tb=short

# Build RDF store
.venv\Scripts\python.exe -m ingestion.build_store config/rdf-sources.yaml

# Lifecycle commands
.venv\Scripts\python.exe -m ingestion.lifecycle list
.venv\Scripts\python.exe -m ingestion.lifecycle promote <build_id>
```

### Frontend
```powershell
cd frontend
npm test        # Vitest
npm run build   # tsc -b && vite build
npm run dev     # Dev server on :5173
```

### Environment Variables
```text
GRAPH_BACKEND=oxigraph               # default
RDF_STORE_PATH=.data/oxigraph        # store root
ONTOLOGY_PROFILE=config/wine-profile.yaml  # active profile
FRONTEND_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
GRAPH_HTTP_TIMEOUT_SECONDS=15
```

---

## 9. Food Ontology Reference (for Synthetic Test Fixture)

The custom Indian Food Knowledge Graph ontology is not yet available as an OWL file. For Sprint 2 testing (Batch 2H), generate a synthetic fixture based on this schema:

**Core Classes:** Recipe, Ingredient, Dish, Region, Diet, Cuisine, FoodProduct, NutritionalInfo, CookingMethod, MealType, FoodCategory, Allergen

**Key Properties:** hasIngredient, hasCuisine, hasRegion, hasDiet, hasNutritionalInfo, hasCookingMethod, hasMealType, isIngredientOf, hasAllergen, hasCalories, hasProtein, hasFat, hasCarbohydrates

**Target Scale:** Tier M (~10K–50K triples) for performance benchmarking

**Design Reference:** The ontology models Indian food with entities like recipes (biryani, dosa, etc.), ingredients (rice, lentils, spices), dishes, regional cuisines, dietary classifications (vegetarian, vegan, Jain), and nutritional information with full OWL 2 class expressions.

---

## 10. Batch 0A Completion Summary
*(Implemented on `sprint-2/gap-remediation`, commits `6f66e5e` → `6f8f821`)*

### What Changed
- Instantiated `OxigraphSemanticRepository` during application lifespan in `main.py` (now 144 lines) using the shared store.
- Injected `semantic_repository` into `get_graphql_context()` and `GraphQLContext` TypedDict.
- Added 10 new Strawberry GraphQL types: `CompactIRIType`, `MultilingualLabelType`, `AnnotationType`, `ResourceMetadataType`, `ClassInfoType`, `PropertyInfoType`, `PreviewGroupType`, `ExpansionPreviewType`, `SearchResultType`, `SearchInput`.
- Added helper `_semantic_repository()` (line 509) for auth-gated context access.
- Added conversion mappers: `_to_api_compact_iri`, `_to_api_label`, `_to_api_annotation`, `_to_api_resource_metadata`, `_to_api_class_info`, `_to_api_property_info`, `_to_api_expansion_preview`, `_to_domain_search_options`, `_to_api_search_result`.
- Added 7 query resolvers to `Query`: `get_resource_metadata`, `get_class_info`, `get_property_info`, `list_classes`, `list_properties`, `get_expansion_preview`, `search`.
- `api/graphql_schema.py` is now 843 lines (was 489).
- Created `tests/test_semantic_graphql.py` (530 lines, 13 tests).

### Test Counts After Batch 0A
- Backend: **117 passed** (104 baseline + 13 new), 9 deprecation warnings
- Frontend: **6 passed** (Vitest)
- Frontend build: Clean

### Known Defect (DEF-0A-1)
`adapters/oxigraph/repository.py:254`: `_search` SPARQL query has `SELECT DISTINCT ?entity` but supplies `{Variable("needle"): Literal(options.query)}` substitution. PyOxigraph requires substitution variables in SELECT projection. Should be `SELECT DISTINCT ?entity ?needle`. Patched in test scope only — needs adapter fix.

---

## 11. Post-Batch-0A File State (Key Files)

| File | Lines | Last Modified By |
|---|---|---|
| `main.py` | 144 | Batch 0A |
| `api/graphql_schema.py` | 853 | Batch 0B |
| `adapters/oxigraph/repository.py` | 600 | Batch 0B |
| `api/security.py` | 104 | Sprint 1 (Batch 1F) |
| `services/exceptions.py` | 39 | Sprint 1 (Batch 1E) |
| `services/repository_factory.py` | 27 | Sprint 1 |
| `services/graph_service.py` | ~140 | Sprint 1 |
| `.github/workflows/ci.yml` | 63 | Sprint 1 (Batch 1H) |
| `tests/test_semantic_graphql.py` | 460 | Batch 0B |
| `tests/test_relationship_provenance.py` | 264 | Batch 0B |

### Remaining Gaps for Batches 0C–0D

| Gap | Target Batch | Status |
|---|---|---|
| Gap 2: `GraphRelationship` lacks provenance fields | 0B | ✅ RESOLVED |
| Gap 3: `GraphQLErrorCode` has only 5 of 16 codes | 0C | ✅ RESOLVED |
| Gap 4: `build_id=None` hardcoded in `get_active_profile` | 0C | ✅ RESOLVED |
| Gap 5: Readiness hardcodes `"consistent"` | 0C | ✅ RESOLVED |
| CI: ruff has `continue-on-error: true` | 0D | ✅ RESOLVED |
| Tech debt: Unconditional `httpx`/GraphDB import in factory | 0D | ✅ RESOLVED |
| DEF-0A-1: SPARQL projection bug in `_search` | 0B | ✅ RESOLVED |

---

## 12. Batch 0B Completion Summary
*(Implemented on `sprint-2/gap-remediation`, commits `d9e2356` → `cfdc138`)*

### What Changed
- Fixed DEF-0A-1 in `adapters/oxigraph/repository.py`: SPARQL query in `_search` now includes `?needle` in `SELECT DISTINCT ?entity ?needle` projection, eliminating runtime errors under PyOxigraph variable substitution.
- Added 5 provenance fields to Strawberry `GraphRelationship` type in `api/graphql_schema.py`: `predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`.
- Updated mapper `_to_api_relationship` in `api/graphql_schema.py` to pass through all domain provenance attributes (`predicate_iri or None`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`).
- Removed temporary monkeypatch workaround `patch_oxigraph_search_projection` from `tests/test_semantic_graphql.py`.
- Created `tests/test_relationship_provenance.py` (264 lines, 5 tests) covering provenance field presence, inferred vs asserted distinction, defaults, expand_graph provenance, and end-to-end search fix.

### Test Counts After Batch 0B
- Backend: **122 passed** (117 baseline + 5 new), 9 deprecation warnings
- Frontend: **6 passed** (Vitest)
- Frontend build: Clean (`tsc -b && vite build` passed)

### Issues Discovered
- None. All 122 backend tests and 6 frontend tests pass cleanly without defects.

---

## 13. Batch 0C Completion Summary
*(Implemented on `sprint-2/gap-remediation`, commits `5bcaeda` → `1ee7d5c`)*

### What Changed
- Expanded `GraphQLErrorCode` enum in `services/exceptions.py` from 5 to all 16 required codes (`TIMEOUT`, `CANCELLED`, `FORBIDDEN`, `STORE_NOT_READY`, `ONTOLOGY_INCONSISTENT`, `REASONER_UNAVAILABLE`, `EXPLANATION_UNAVAILABLE`, `UNSUPPORTED_SEMANTIC_CONSTRUCT`, `BACKEND_UNAVAILABLE`, `INVALID_PREDICATE`, `QUERY_TOO_COMPLEX`).
- Refactored `api/security.py` to use `GraphQLErrorCode.BUDGET_EXHAUSTED.value` and `GraphQLErrorCode.TIMEOUT.value` instead of raw strings.
- Refactored `api/graphql_schema.py` `_graph_service()` and `_semantic_repository()` auth rejection to emit `GraphQLErrorCode.FORBIDDEN.value` instead of raw string `"UNAUTHORIZED"`.
- Added `active_build_id: NotRequired[str | None]` to `GraphQLContext` TypedDict, populated it from `app.state.active_build_id` in `main.py`, and wired it into `get_active_profile` query resolver.
- Updated `/health/readiness` endpoint in `main.py` to dynamically read `consistency` and `validation_summary` from `store-manifest.json` metadata with fallback to `"unknown"`.
- Updated test assertion in `tests/test_graphql_safety.py` to expect `"FORBIDDEN"`.
- Created `tests/test_error_codes.py` (318 lines, 9 tests) covering all 16 enum codes, context and end-to-end `build_id` resolution, readiness manifest reading and fallback, auth rejection `FORBIDDEN` codes, and timeout `TIMEOUT` codes.

### Test Counts After Batch 0C
- Backend: **131 passed** (122 baseline + 9 new), 9 deprecation warnings
- Frontend: **6 passed** (Vitest)
- Frontend build: Clean (`tsc -b && vite build` passed)

### Issues Discovered
- None. All 131 backend tests and 6 frontend tests pass cleanly without defects.

---

## 14. Batch 0D Completion Summary
*(Implemented on `sprint-2/gap-remediation`, commits `5e0e8e0` → `20e21f9`)*

### What Changed
- Fixed all 147 ruff lint violations across 46 files (unused imports, duplicate `TypedDict` in `api/graphql_schema.py`, sorting, collection constructors, and broad exception handlers).
- Made ruff lint strict in CI by removing `continue-on-error: true` from `.github/workflows/ci.yml`.
- Expanded GitHub Actions push and PR triggers to include `sprint-2/*` branches.
- Lazy-imported GraphDB adapter (`httpx`, `GraphDBSettings`, `GraphRetrievalService`) within `create_graph_repository` in `services/repository_factory.py`, removing `httpx` as a hard runtime dependency when using the default Oxigraph backend.
- Enforced `isinstance(client, httpx.AsyncClient)` check for GraphDB backend in repository factory.
- Added client validation tests and module-level import verification in `tests/test_repository_factory.py` (2 new tests).
- Created shared test fixtures package `tests/shared/` containing:
  - `tests/shared/__init__.py`: Package marker.
  - `tests/shared/graphql_fixtures.py`: Canonical shapes for entities, all 16 error codes, provenance relationships, class/property metadata, search results, expansion previews, and active profiles.
  - `tests/shared/test_conformance.py`: 9 conformance tests validating fixture structure and field parity against Strawberry GraphQL schema execution.

### Test Counts After Batch 0D
- Backend: **142 passed** (131 baseline + 11 new), 9 deprecation warnings
- Frontend: **6 passed** (Vitest)
- Frontend build: Clean (`tsc -b && vite build` passed)
- Ruff lint: Clean (0 errors across entire repository)

### Issues Discovered
- None. All 142 backend tests and 6 frontend tests pass cleanly without defects.

---

## 15. Phase 0 Complete Summary

Phase 0 (Sprint 1 Gap Remediation) is officially **COMPLETE**.

### Summary of Resolved Items
1. **Gap 1 (SemanticRepository GraphQL)**: Wired into application lifespan, GraphQL context, 7 query resolvers, 10 types (Batch 0A).
2. **Gap 2 (Relationship Provenance)**: Exposed `predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle` on `GraphRelationship` (Batch 0B).
3. **Gap 3 (Error Codes)**: Expanded `GraphQLErrorCode` to all 16 stable codes required by GQ-115; wired through safety extension and auth guards (Batch 0C).
4. **Gap 4 (build_id)**: Injected active build ID from application state into `get_active_profile` resolver (Batch 0C).
5. **Gap 5 (Readiness Consistency)**: Dynamically reading `consistency` and `validation_summary` from `store-manifest.json` metadata (Batch 0C).
6. **DEF-0A-1 (SPARQL Projection)**: Corrected `_search` projection to include `?needle` in `adapters/oxigraph/repository.py` (Batch 0B).
7. **CI Strictness & Triggers**: Removed `continue-on-error` from ruff step; added `sprint-2/*` triggers (Batch 0D).
8. **Tech Debt (Lazy Imports)**: Lazy-imported GraphDB adapter in repository factory (Batch 0D).
9. **Shared Fixtures**: Canonical fixtures and 9 conformance tests in `tests/shared/` (Batch 0D).

### Phase 0 Metrics
- **Phase 0 Branch:** `sprint-2/gap-remediation`
- **Total Commits on Branch:** 27 commits across Batches 0A–0D
- **Total Backend Tests:** 142 passed (+38 tests added across Phase 0 from 104 baseline)
- **Total Frontend Tests:** 6 passed (Vitest), clean build
- **Lint Status:** 0 errors (`ruff check .` strict)
- **Status:** ✅ Complete. Merged into `sprint-2/cytoscape` baseline branch.

---

## Phase 1: Frontend Context for Supported Application

### Branching Strategy for Phase 1

```
sprint-2/cytoscape (baseline — Phase 0 merged)
  ├── batch-2a/app-shell         → merge back to sprint-2/cytoscape
  ├── batch-2b/semantic-inspector → merge back to sprint-2/cytoscape
  ├── batch-2c/cytoscape-detail  → merge back to sprint-2/cytoscape
  └── batch-2d/accessible-views  → merge back to sprint-2/cytoscape
```

Each batch branch is created from the current HEAD of `sprint-2/cytoscape` (which will include all previously merged batches).

### Current Frontend File Inventory (Phase 1 Starting Point)

| File | Lines | Purpose | Phase 1 Action |
|---|---|---|---|
| `App.tsx` | 426 | Monolithic app with search, filters, graph, entity list | **Decompose** into shell + panels |
| `App.css` | ~200 | All styles in one file | **Split** per component |
| `api/graph.ts` | 116 | GraphQL client with 3 queries (profile, search, expand) | **Extend** with 7+ new query functions |
| `graph/state.ts` | 169 | Pure functional state engine (merge/collapse/limits) | **Extend** with undo/redo, multi-hop |
| `graph/CytoscapeGraph.tsx` | ~200 | Cytoscape wrapper component | **Enhance** with profile-driven styling |
| `interfaces/models.ts` | 62 | TypeScript domain types | **Update** to match backend schema |
| `interfaces/renderers.ts` | 33 | Renderer contracts | Keep as-is |
| `main.tsx` | 20 | Entry point (App vs Benchmark mode) | Keep as-is |

### CRITICAL: Frontend TypeScript Models Are Outdated

The `interfaces/models.ts` file does NOT match the current backend GraphQL schema. Phase 1 agents must update these:

**`GraphRelationship` — missing provenance fields:**
```typescript
// CURRENT (incomplete):
export interface GraphRelationship {
  relation: string
  source: GraphEntity
  target: GraphEntity
}

// MUST BECOME:
export interface GraphRelationship {
  relation: string
  source: GraphEntity
  target: GraphEntity
  predicate_iri: string | null
  predicate_label: string | null
  is_inferred: boolean
  source_graph: string | null
  explanation_handle: string | null
}
```

**`ActiveProfile` — missing full profile fields:**
```typescript
// CURRENT (incomplete):
export interface ActiveProfile {
  metadata: { title: string; description: string }
  categories: SemanticCategory[]
  predicates: PredicateInfo[]
}

// MUST BECOME:
export interface ActiveProfile {
  metadata: { package_id: string; version: string; title: string; description: string; ontology_iris: string[] }
  prefixes: { prefix: string; iri: string }[]
  categories: SemanticCategory[]
  predicates: PredicateInfo[]
  limits: { max_depth: number; max_nodes: number; max_edges: number }
  languages: { preferred_languages: string[] }
  reasoning_profile: string
  build_id: string | null
}
```

### New TypeScript Types Needed (not yet in `models.ts`)

These types map to the backend GraphQL types added in Phase 0:

```typescript
export interface CompactIRI { full_iri: string; prefix: string | null; local_name: string }
export interface MultilingualLabel { value: string; language: string | null; predicate_iri: string }
export interface Annotation { predicate_iri: string; value: string; language: string | null }
export interface ResourceMetadata {
  iri: string; compact_iri: CompactIRI | null; semantic_kind: string
  asserted_types: string[]; inferred_types: string[]
  labels: MultilingualLabel[]; preferred_label: string
  descriptions: MultilingualLabel[]; annotations: Annotation[]
  source_graphs: string[]; build_id: string | null
}
export interface ClassInfo {
  iri: string; compact_iri: CompactIRI | null; label: string
  direct_parents: string[]; all_ancestors: string[]
  direct_children: string[]; all_descendants: string[]
  equivalent_classes: string[]; disjoint_classes: string[]
  instance_count: number; annotations: Annotation[]; restrictions: string[]
}
export interface PropertyInfo {
  iri: string; compact_iri: CompactIRI | null; label: string
  property_kind: string; domains: string[]; ranges: string[]
  inverse_of: string | null; characteristics: string[]; usage_count: number
  annotations: Annotation[]
}
export interface PreviewGroup { relation: string; direction: TraversalDirection; count: number }
export interface ExpansionPreview { entity_id: string; total_count: number; groups: PreviewGroup[] }
export interface SearchResult { entities: GraphEntity[]; total_matches: number }
export interface SearchOptions { query: string; limit?: number; offset?: number; kinds?: string[] }
```

### Available Backend GraphQL Queries (Phase 0 Delivered)

All of these are operational and tested. Frontend query strings and functions must be added in Phase 1:

| Query | Signature | Used By (Batch) |
|---|---|---|
| `get_resource_metadata(iri)` | → `ResourceMetadataType \| null` | 2B (Resource Inspector) |
| `get_class_info(iri)` | → `ClassInfoType \| null` | 2A (Class Tree), 2B (Class Inspector) |
| `get_property_info(iri)` | → `PropertyInfoType \| null` | 2A (Property Browser), 2B (Property Inspector) |
| `list_classes(limit, offset)` | → `[ClassInfoType!]!` | 2A (Class Tree) |
| `list_properties(limit, offset)` | → `[PropertyInfoType!]!` | 2A (Property Browser) |
| `get_expansion_preview(id)` | → `ExpansionPreviewType` | 2C (Expansion Preview Dialog) |
| `search(options: SearchInput)` | → `SearchResultType` | 2A (Search Panel) |
| `get_active_profile()` | → `ActiveProfile` (with build_id) | 2A (Profile metadata) |
| `get_build_status` | → `BuildStatusType` | 2B (Consistency Panel) |

### Frontend Dependencies Available

From `package.json`:
- `react@^19.2.7`, `react-dom@^19.2.7`
- `@tanstack/react-query@^5.101.2` (data fetching / caching)
- `cytoscape@^3.34.0`, `react-cytoscapejs@^2.0.0`
- `@cosmos.gl/graph@^3.3.0` (GPU overview — Batch 2G)
- `graphql-request@^7.4.0`
- `lucide-react@^1.25.0` (icons)
- `vitest@^4.1.10` (testing)
- TypeScript `~6.0.2`, Vite `^8.1.1`

---

## 16. Batch 2A Completion Summary
*(Implemented on `batch-2a/app-shell`, merged into `sprint-2/cytoscape`)*

### What Changed
- **Updated TypeScript Models (`interfaces/models.ts`):** Added provenance fields (`predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`) to `GraphRelationship`. Expanded `ActiveProfile` with `prefixes`, `limits`, `languages`, `reasoning_profile`, `build_id`, and full `ProfileMetadata`. Added all semantic model types: `CompactIRI`, `MultilingualLabel`, `Annotation`, `ResourceMetadata`, `ClassInfo`, `PropertyInfo`, `PreviewGroup`, `ExpansionPreview`, `SearchResult`, `SearchOptions`.
- **Added GraphQL Query Functions (`api/graph.ts`):** Implemented typed wrappers for `listClasses`, `listProperties`, `getClassInfo`, `getPropertyInfo`, `getResourceMetadata`, `getExpansionPreview`, and `advancedSearch`. Updated `fetchProfile` to request all profile fields and `expandGraph` to include provenance fields.
- **Created Three-Panel AppShell (`shell/AppShell.tsx`, `AppShell.css`):** Built responsive layout shell with resizable Navigation, Canvas, and Inspector panels, drag handles, panel collapse/expand toggles, header bar with title, build ID badge, reasoning profile, and stats, plus loading and error card fallback states.
- **Created ClassTree Navigation (`navigation/ClassTree.tsx`, `ClassTree.css`):** Hierarchical tree using `direct_parents`/`direct_children` with cycle prevention, expandable/collapsible nodes, instance count badges, text filter, and namespace selector.
- **Created PropertyBrowser Navigation (`navigation/PropertyBrowser.tsx`, `PropertyBrowser.css`):** Filterable list showing property kinds (Object, Datatype, Annotation), domain/range signatures, characteristics badges, and usage counts.
- **Created SearchPanel Navigation (`navigation/SearchPanel.tsx`, `SearchPanel.css`):** Advanced search with semantic kind filter pills, namespace selection, description toggle, paginated results, and entity cards.
- **Created CommandPalette (`navigation/CommandPalette.tsx`, `CommandPalette.css`):** Keyboard accessible (`Ctrl+K` / `Cmd+K`) modal dialog with live search and quick actions.
- **Created SemanticLegend & LanguageSelector (`navigation/SemanticLegend.tsx`, `navigation/LanguageSelector.tsx`):** Profile-driven dynamic category legend and multilingual display selector.
- **Decomposed `App.tsx`:** Refactored into three-panel shell layout with tabbed navigation (`Search`, `Classes`, `Properties`), center canvas, and right inspector panel, preserving 100% of Cytoscape state, limits, and traversal operations.
- **Created Comprehensive Unit Tests:** Added 18 new automated tests across `graph.test.ts`, `AppShell.test.tsx`, and `navigation.test.tsx` (bringing frontend test suite to 24 tests).

### Test Counts After Batch 2A
- **Frontend:** **24 passed** (vitest, 5 test files)
- **Frontend build:** Clean (`tsc -b && vite build` passed)
- **Backend:** **142 passed** (pytest), 9 deprecation warnings
- **Git whitespace check:** Clean (`git diff --check` passed)

---

## 17. Batch 2B Completion Summary
*(Implemented on `batch-2b/semantic-inspector`, merged into `sprint-2/cytoscape`)*

### What Changed
- **Backend Build Status Query (`api/graphql_schema.py`):** Implemented `BuildStatusType`, `ValidationFindingType`, and the `get_build_status` query resolver reading active store manifest metadata and validation findings.
- **Frontend Models & Query Client (`interfaces/models.ts`, `api/graph.ts`):** Added `BuildStatus` and `ValidationFinding` interfaces, and implemented typed `getBuildStatus()` client function.
- **Resource Inspector (`inspector/ResourceInspector.tsx`, `ResourceInspector.css`):** Displays canonical IRI, compact prefix IRI with copy button, semantic kind badge, multilingual labels and descriptions, asserted vs. inferred types with redundant non-color cues, annotations table, and source graphs (`SM-005`, `GE-009`, `AC-104`, `AC-106`).
- **Class Inspector (`inspector/ClassInspector.tsx`, `ClassInspector.css`):** Displays class hierarchy with navigable parent and child class chips, equivalent classes, disjoint classes, instance count with canvas selection, OWL class expressions / restrictions, and annotations (`SM-006`, `GE-010`).
- **Property Inspector (`inspector/PropertyInspector.tsx`, `PropertyInspector.css`):** Displays property kind (Object / Datatype / Annotation), domain and range signatures (clickable and navigable), inverse property, logical characteristics badges, usage count, sub/super properties, and annotations (`SM-007`).
- **Consistency Panel (`inspector/ConsistencyPanel.tsx`, `ConsistencyPanel.css`):** Displays build status card, reasoning profile, build ID, total vs. inferred triple volume metrics, unsatisfiable classes warning banner, and validation findings with severity chips (`GE-012`).
- **Provenance Panel (`inspector/ProvenancePanel.tsx`, `ProvenancePanel.css`):** Displays relationship triple statements, asserted vs. inferred badges with non-color cues (icons, border styling, text tags), named source graph chip, build ID, reasoner identity, and explanation handle placeholder (`GE-011`, `AC-106`).
- **Unified InspectorPanel Container (`inspector/InspectorPanel.tsx`, `InspectorPanel.css`):** Composite panel housing all 5 tabs with intelligent auto-switching based on selection type (entity, class, property, relationship), empty states with quick-action shortcuts, loading indicators, error handling, and integrated graph traversal controls.
- **AppShell Right Panel Integration (`App.tsx`):** Connected `InspectorPanel` to the workspace, seamlessly synchronizing canvas node/edge selections with the semantic inspector.
- **Unit Testing Suite (`inspector/inspector.test.tsx`):** Added 10 comprehensive unit tests covering all 5 inspector components, AC-106 non-color cues, empty/loading/error states, and tab navigation.
- **End-to-End Browser Subagent Verification:** Verified the live application in the browser: initial empty state, build consistency metrics (3,648 total triples, 791 inferred), class tree navigation to `food:Wine`, entity search and selection (`Chateau Margaux`), resource metadata, and relationship provenance lineage.

### Test Counts After Batch 2B
- **Frontend:** **35 passed** (vitest, 6 test files)
- **Frontend build:** Clean (`tsc -b && vite build` passed)
- **Backend:** **143 passed** (pytest), 9 deprecation warnings
- **Git whitespace check:** Clean (`git diff --check` passed)
