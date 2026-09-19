# Sprint 2 Agent Context: Architecture, Inventory & Implementation Guide

- **Document type:** Supplementary implementation context for LLM agent delegation
- **Status:** Active
- **Created:** 2026-09-19
- **Current Sprint:** Sprint 2 (Gap Remediation + Supported Application)
- **Baseline Branch:** `sprint-1/core-platform` (commit `b16b2c7`)
- **Phase 0 Branch:** `sprint-2/gap-remediation` (created from `sprint-1/core-platform`)
- **Phase 1 Branch:** `sprint-2/supported-app` (created from Phase 0 merge point)
- **Prerequisite reading:** Before beginning any batch, read these documents in order:
  1. [Project Status 2026-09-14](project-status-2026-09-14.md) — what exists now
  2. [Sprint 1 Completion Report](sprint-1-completion-report.md) — what Sprint 1 delivered and its gaps
  3. [Sprint 2 Implementation Plan](sprint-2-implementation-plan.md) — what to build and how
  4. [Requirements](ontology-graph-explorer-requirements.md) — full requirements specification
  5. [Implementation Plan](ontology-graph-explorer-implementation-plan.md) — Sprint 2 = Section 7

This document provides the **architecture map, file inventory, interface details,
gap inventory, coding conventions, and batch-specific guidance** needed to
implement Sprint 2 without reverse-engineering the repository.

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

### Gap 1: SemanticRepository Not Wired into GraphQL

**What exists:**
- `domain/ports.py` defines `SemanticRepository` protocol with 5 methods
- `adapters/oxigraph/semantic_repository.py` fully implements all 5 methods
- `services/graph_service.py` exposes `search()` and `get_expansion_preview()` but they're not in GraphQL

**What's missing:**
- `SemanticRepository` is NEVER instantiated in `main.py` lifespan
- `GraphQLContext` in `api/graphql_schema.py` (line 31) does NOT include `semantic_repository`
- No GraphQL query resolvers exist for: `get_resource_metadata`, `get_class_info`, `get_property_info`, `list_classes`, `list_properties`, `get_expansion_preview`, or advanced `search`
- No Strawberry types exist for: `ResourceMetadata`, `ClassInfo`, `PropertyInfo`, `ExpansionPreview`, `SearchResult`

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
| `get_relationships(id)` | ✅ Active | Missing provenance fields |
| `expand_graph(id, options)` | ✅ Active | Bounded with cursors |
| `find_path(source_id, target_id)` | ✅ Active | BFS shortest path |
| `compare(id_a, id_b)` | ✅ Active | Entity comparison |
| `get_active_profile()` | ✅ Active | build_id always None |
| `expand(id, relation)` | ⚠️ Deprecated | Legacy |
| `get_wine(id)` | ⚠️ Deprecated | Legacy |
| `get_resource_metadata(iri)` | ❌ Missing | Backend ready |
| `get_class_info(iri)` | ❌ Missing | Backend ready |
| `get_property_info(iri)` | ❌ Missing | Backend ready |
| `list_classes(limit, offset)` | ❌ Missing | Backend ready |
| `list_properties(limit, offset)` | ❌ Missing | Backend ready |
| `get_expansion_preview(id)` | ❌ Missing | Backend ready |
| `search(options)` | ❌ Missing | Backend ready |

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
- **All 104 backend + 6 frontend tests must pass at baseline**

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

| Batch | Name | Depends On | Focus |
|---|---|---|---|
| **0A** | Wire SemanticRepository into GraphQL | — | 7 new resolvers, ~10 new types |
| **0B** | Expose Relationship Provenance | 0A | Enrich GraphQL `GraphRelationship` |
| **0C** | Error Codes + build_id + Readiness | 0A | Complete enum, fix hardcoded values |
| **0D** | CI Hardening | 0A | Strict lint, guard imports, shared fixtures |

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

| Batch | Name | Depends On | Focus |
|---|---|---|---|
| **2A** | App Shell & Navigation | Phase 0 | Three-panel layout, class tree, search, command palette |
| **2B** | Semantic Inspector | 2A | Resource, class, property, consistency, provenance panels |
| **2C** | Cytoscape Detail | 2A | Preview, undo/redo, multi-hop, layouts |
| **2D** | Accessible Views | 2A | Table, trees, ARIA, responsive, reduced motion |
| **2E** | Paths/Comparison/Explanation UI | 2B | Path builder, comparison, "Why?" panel |
| **2F** | Sessions | 2B, 2C | Save/restore, compatibility, deep links |
| **2G** | cosmos.gl Overview | 2A | Class-based clusters, GPU fallback, drill-down |
| **2H** | E2E Testing | 2A–2G | Playwright, accessibility, performance, memory |

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
*(Implemented on `sprint-2/gap-remediation`)*
- What changed:
  - Instantiated `OxigraphSemanticRepository` during application lifespan in `main.py` using the shared store.
  - Injected `semantic_repository` into `get_graphql_context()` and `GraphQLContext` TypedDict.
  - Added 10 new Strawberry GraphQL types: `CompactIRIType`, `MultilingualLabelType`, `AnnotationType`, `ResourceMetadataType`, `ClassInfoType`, `PropertyInfoType`, `PreviewGroupType`, `ExpansionPreviewType`, `SearchResultType`, `SearchInput`.
  - Added 7 query resolvers to `Query`: `get_resource_metadata`, `get_class_info`, `get_property_info`, `list_classes`, `list_properties`, `get_expansion_preview`, `search`.
  - Added comprehensive test suite in `tests/test_semantic_graphql.py` (13 tests).
- New test count: 117 backend tests (104 baseline + 13 new), 6 frontend tests (all passing).
- Any issues discovered:
  - Found latent defect in `adapters/oxigraph/repository.py:254`: SPARQL projection was missing `?needle` in `SELECT DISTINCT ?entity` while supplying variable substitutions, triggering PyOxigraph `RuntimeError`. Patched in test scope in `tests/test_semantic_graphql.py` without modifying adapter code to preserve batch constraints.
