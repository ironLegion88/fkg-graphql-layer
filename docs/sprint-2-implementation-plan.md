# Sprint 2 Implementation Plan: Gap Remediation + Supported Application

**Status:** Ready for implementation  
**Created:** 2026-09-19  
**Baseline:** Sprint 1 complete (`sprint-1/core-platform`, commit `b16b2c7`)  
**Tests at baseline:** 104 backend (pytest), 6 frontend (vitest)

---

## 1. Sprint Overview

Sprint 2 is divided into two sequential phases:

1. **Phase 0 — Sprint 1 Gap Remediation** (Batches 0A–0D): Fix remaining gaps from Sprint 1 that block frontend development. All backend-only work.
2. **Phase 1 — Supported Application** (Batches 2A–2H): Build the production-ready ontology explorer with Cytoscape detail, cosmos.gl overview, semantic inspector, accessible views, and E2E testing.

### Branch Strategy

| Phase | Branch | Created From | Merge Target |
|---|---|---|---|
| Phase 0 | `sprint-2/gap-remediation` | `sprint-1/core-platform` | Merge into `sprint-2/supported-app` when complete |
| Phase 1 | `sprint-2/supported-app` | Phase 0 merge point | `main` when Sprint 2 exits |

### Commit Standards

- **Conventional Commits:** `feat(scope):`, `fix(scope):`, `refactor(scope):`, `docs(scope):`, `test(scope):`
- **Small, focused commits** — one logical change per commit
- **Commit message format:**
  ```
  <type>(<scope>): short description (≤72 chars)

  Longer description of what changed and why.
  Reference requirement IDs where applicable.
  ```
- **NO bulk commits** — each file change or logical unit gets its own commit
- **Clean worktree:** `git diff --check` must pass before each commit

---

## 2. Requirement Coverage

### Phase 0 (Gap Remediation)
- `GQ-104`–`GQ-106` (Schema browsing/resource inspection/dynamic predicates — GraphQL wiring)
- `GQ-108` (Expansion preview — GraphQL wiring)
- `GQ-115` (Complete stable error codes)
- `SM-005`–`SM-007` (Resource/class/property metadata — GraphQL wiring)
- `RS-009` (Provenance — GraphQL field exposure)

### Phase 1 (Supported Application)
- User workflows: `UW-001` through `UW-008`
- Session API: `GQ-114`
- Discovery UI: `SD-005`, `SD-006`
- Exploration: `GE-001` through `GE-013`
- Save/restore core: `SE-001`, `SE-002`
- Renderer: `RC-001` through `RC-010`
- Accessibility: `AX-001` through `AX-007`
- Performance: `NF-001`, `NF-003`–`NF-005`, `NF-008`
- Tests: `TC-008`, `TC-010`, `TC-011`
- Acceptance: `AC-104` through `AC-111`, `AC-113`

---

## 3. Phase 0 — Sprint 1 Gap Remediation

> **All batches on branch `sprint-2/gap-remediation`**

### Batch 0A: Wire SemanticRepository into GraphQL

**Priority:** CRITICAL — Blocks all Sprint 2 frontend panels (class tree, property browser, inspector, expansion previews)

#### 0A-1: Instantiate SemanticRepository in application lifespan

**Files:** `main.py`, `api/graphql_schema.py`

- Create `OxigraphSemanticRepository` in `lifespan()` using the same store path as `OxigraphGraphRepository`.
- Add `semantic_repository: SemanticRepository` to `GraphQLContext` TypedDict.
- Inject it in `get_graphql_context()`.

#### 0A-2: Define GraphQL types for semantic models

**File:** `api/graphql_schema.py`

New Strawberry types:

| GraphQL Type | Maps From | Key Fields |
|---|---|---|
| `CompactIRIType` | `domain.semantic_models.CompactIRI` | `full_iri`, `prefix`, `local_name` |
| `MultilingualLabelType` | `domain.semantic_models.MultilingualLabel` | `value`, `language`, `predicate_iri` |
| `AnnotationType` | `domain.semantic_models.Annotation` | `predicate_iri`, `value`, `language` |
| `ResourceMetadataType` | `domain.semantic_models.ResourceMetadata` | `iri`, `compact_iri`, `semantic_kind`, `asserted_types`, `inferred_types`, `labels`, `preferred_label`, `descriptions`, `annotations`, `source_graphs` |
| `ClassInfoType` | `domain.semantic_models.ClassInfo` | `iri`, `compact_iri`, `label`, `direct_parents`, `all_ancestors`, `direct_children`, `all_descendants`, `equivalent_classes`, `disjoint_classes`, `instance_count`, `restrictions` |
| `PropertyInfoType` | `domain.semantic_models.PropertyInfo` | `iri`, `compact_iri`, `label`, `property_kind`, `domains`, `ranges`, `inverse_of`, `characteristics`, `usage_count` |
| `ExpansionPreviewType` | `domain.models.ExpansionPreview` | `entity_id`, `total_count`, `groups: [PreviewGroupType]` |
| `PreviewGroupType` | `domain.models.PreviewGroup` | `relation`, `direction`, `count` |
| `SearchResultType` | `domain.models.SearchResult` | `entities: [Entity]`, `total_matches: Int` |
| `SearchInput` | Input type | `query`, `limit`, `offset`, `kinds`, `require_description` |

#### 0A-3: Add GraphQL query resolvers

| New Query | Signature | Backend |
|---|---|---|
| `get_resource_metadata` | `(iri: String!) → ResourceMetadataType` | `SemanticRepository.get_resource_metadata()` |
| `get_class_info` | `(iri: String!) → ClassInfoType` | `SemanticRepository.get_class_info()` |
| `get_property_info` | `(iri: String!) → PropertyInfoType` | `SemanticRepository.get_property_info()` |
| `list_classes` | `(limit: Int = 100, offset: Int = 0) → [ClassInfoType!]!` | `SemanticRepository.list_classes()` |
| `list_properties` | `(limit: Int = 100, offset: Int = 0) → [PropertyInfoType!]!` | `SemanticRepository.list_properties()` |
| `get_expansion_preview` | `(id: ID!) → ExpansionPreviewType` | `GraphService.get_expansion_preview()` |
| `search` | `(options: SearchInput!) → SearchResultType` | `GraphService.search()` |

#### 0A-4: Tests (~12–15 new)

- Each resolver: 1 happy path + 1 not-found/empty
- Context injection test
- SemanticRepository integration test with Wine store

---

### Batch 0B: Expose Relationship Provenance in GraphQL

**Priority:** CRITICAL — Sprint 2 needs `is_inferred` for inference styling (`GE-010`)

#### 0B-1: Enrich GraphQL `GraphRelationship` type

Add to `api/graphql_schema.py`:
```python
predicate_iri: str | None = None
predicate_label: str | None = None
is_inferred: bool = False
source_graph: str | None = None
explanation_handle: str | None = None
```

#### 0B-2: Update `_to_api_relationship()` mapper

Pass through domain provenance values from `domain.models.GraphRelationship`.

#### 0B-3: Tests (~3 new)

- Verify provenance fields in GraphQL response
- Test inferred vs asserted distinction

---

### Batch 0C: Complete Error Codes + Fix build_id + Readiness

**Priority:** HIGH

#### 0C-1: Expand `GraphQLErrorCode` enum in `services/exceptions.py`

Add: `TIMEOUT`, `CANCELLED`, `FORBIDDEN`, `STORE_NOT_READY`, `ONTOLOGY_INCONSISTENT`, `REASONER_UNAVAILABLE`, `EXPLANATION_UNAVAILABLE`, `UNSUPPORTED_SEMANTIC_CONSTRUCT`, `BACKEND_UNAVAILABLE`, `INVALID_PREDICATE`, `QUERY_TOO_COMPLEX`

#### 0C-2: Update `api/security.py` to use enum codes

- `TIMEOUT` in `on_execute` → `GraphQLErrorCode.TIMEOUT.value`
- Auth rejection → `GraphQLErrorCode.FORBIDDEN.value`

#### 0C-3: Wire `build_id` into `ActiveProfile`

In `get_active_profile` resolver: `build_id=info.context.get("active_build_id")`.
In `get_graphql_context()`: pass `active_build_id` from `app.state`.

#### 0C-4: Fix readiness endpoint

Read `consistency` from `store-manifest.json` instead of hardcoding `"consistent"`.

#### 0C-5: Tests (~5 new)

---

### Batch 0D: CI Hardening & Technical Debt

#### 0D-1: Strict ruff in CI (`ci.yml`)
#### 0D-2: Guard GraphDB import in `repository_factory.py`
#### 0D-3: Shared conformance test fixtures (`tests/shared/`)

---

### Phase 0 Summary

| Batch | Effort | New Tests |
|---|---|---|
| 0A | Large | ~12–15 |
| 0B | Small | ~3 |
| 0C | Medium | ~5 |
| 0D | Small | ~2 |
| **Total** | | **~22–25** |

**Expected test count after Phase 0:** ~126–129 backend tests.

---

## 4. Phase 1 — Supported Application

> **All batches on branch `sprint-2/supported-app`**

### Batch 2A: Application Shell & Metadata Navigation

**Workstream 1 — S2-EP1-ST1, S2-EP1-ST2, S2-EP1-ST3**  
**Requirements:** `UW-001`, `UW-003`, `SD-001`–`SD-006`, `GE-001`, `SM-003`, `AX-007`

**Deliverables:**
- Three-panel responsive layout (Navigation / Canvas / Inspector)
- Ontology/build selector with `ActiveProfile` metadata
- Class tree tab (consuming `list_classes`)
- Property browser tab (consuming `list_properties`)
- Individual/search tab (consuming `search`)
- Filters: semantic kind, class, namespace, language, provenance
- Dynamic semantic legend + predicate filters from profile
- Language selector with fallback order
- Namespace/IRI display toggle
- Command palette (Ctrl+K / Cmd+K)
- Loading, empty, truncated, unauthorized, and error states

**New Files:**
- `frontend/src/shell/AppShell.tsx`
- `frontend/src/navigation/ClassTree.tsx`
- `frontend/src/navigation/PropertyBrowser.tsx`
- `frontend/src/navigation/SearchPanel.tsx`
- `frontend/src/navigation/CommandPalette.tsx`
- `frontend/src/navigation/SemanticLegend.tsx`
- `frontend/src/navigation/LanguageSelector.tsx`

---

### Batch 2B: Semantic Inspector & Provenance

**Workstream 2 — S2-EP2-ST1 through S2-EP2-ST4**  
**Requirements:** `UW-003`, `UW-007`, `SM-005`–`SM-007`, `GE-009`–`GE-012`, `AC-104`, `AC-106`

**Deliverables:**
- Resource Inspector: IRI, kinds, labels, types, annotations, provenance
- Class Inspector: hierarchy, equivalents, disjoints, instances, restrictions
- Property Inspector: kind, domain/range, inverse, characteristics, usage
- Consistency Panel: build status, unsatisfiable classes, validation findings
- Provenance Panel: per-fact source graph, `is_inferred` marker (icon + text, not just color)

**Backend Addition:**
- `get_build_status` GraphQL query returning consistency and validation data from `store-manifest.json`

**New Files:**
- `frontend/src/inspector/ResourceInspector.tsx`
- `frontend/src/inspector/ClassInspector.tsx`
- `frontend/src/inspector/PropertyInspector.tsx`
- `frontend/src/inspector/ConsistencyPanel.tsx`
- `frontend/src/inspector/ProvenancePanel.tsx`

---

### Batch 2C: Cytoscape Detail Exploration

**Workstream 3 — S2-EP3-ST1 through S2-EP3-ST4**  
**Requirements:** `UW-002`, `GE-002`–`GE-006`, `RC-001`, `RC-002`, `RC-007`, `RC-008`, `GQ-108`, `AC-105`

**Deliverables:**
- Profile-driven styling (shapes, labels, icons from categories)
- Asserted edges solid, inferred edges dashed
- Expansion preview dialog (`get_expansion_preview`)
- Full undo/redo stack for expansions
- Collapse selected expansion / remove node / reset / fit
- Multi-hop traversal with depth slider (1–3) and semantic filters
- Layout controls (breadthfirst, cose, dagre), fit/focus, pin/unpin
- `prefers-reduced-motion` support

---

### Batch 2D: Textual & Accessible Views

**Workstream 4 — S2-EP4-ST1 through S2-EP4-ST3**  
**Requirements:** `GE-008`, `AX-001`–`AX-007`, `AC-113`

**Deliverables:**
- Whole-visible-graph table (sortable, filterable, paginated)
- Hierarchy tree views (class hierarchy, paths, comparison, proof steps)
- Focus management and ARIA live regions
- Screen-reader graph summaries
- Non-color semantic cues throughout
- Reduced motion support
- Responsive design (mobile/tablet/desktop)

---

### Batch 2E: Paths, Comparison & Explanation UI

**Workstream 5 — S2-EP5-ST1 through S2-EP5-ST3**  
**Requirements:** `UW-004`–`UW-006`, `GE-011`, `GE-013`, `GQ-109`–`GQ-112`, `AC-107`, `AC-108`

**Deliverables:**
- Path Builder (source/target selection, filters, all `PathStatus` outcomes)
- Entity Comparison (pin 2+ entities, diff view)
- "Why?" Explanation Panel (proof display or unavailable message)

**Backend Addition:**
- `get_explanation(handle: String!) → ExplanationResult` GraphQL query

---

### Batch 2F: Sessions & Restore

**Workstream 6 — S2-EP6-ST1, S2-EP6-ST2**  
**Requirements:** `UW-008`, `SE-001`, `SE-002`, `GQ-114`, `OP-009`

**Deliverables:**
- Renderer-neutral session JSON schema
- Save to file and localStorage
- Restore with compatibility checks (missing IRIs, profile changes, build mismatch)
- Deep link URL parameters

---

### Batch 2G: cosmos.gl Overview & GPU Fallback

**Workstream 7 — S2-EP7-ST1 through S2-EP7-ST4**  
**Requirements:** `RC-001`, `RC-003`–`RC-007`, `RC-009`, `NF-004`, `NF-008`, `AC-110`, `AC-111`

**Overview Data Strategy:** Class-based clustering for Sprint 2 (classes as clusters, instances as members, inter-class edge counts). Algorithmic community detection deferred to Sprint 4.

**Deliverables:**
- `get_overview` GraphQL query (class-based clusters)
- `CosmosOverviewRenderer` implementing `OverviewGraphRenderer`
- WebGL 2 capability detection with graceful fallback
- Overview-to-detail drill-down transition
- Bundle isolation via dynamic `import()`

---

### Batch 2H: E2E Testing & Performance Evidence

**Workstream 8 — TC-008, TC-010, TC-011**

**Deliverables:**
- Playwright E2E tests for all primary workflows
- Accessibility tests (keyboard, axe-core, screen reader, responsive)
- Performance benchmarks on synthetic Food ontology fixture
- Memory stability tests (repeated expand/collapse)

**Food Ontology Fixture:** Not yet available. Generate a synthetic ontology fixture based on the Indian Food Knowledge Graph design (classes: Recipe, Ingredient, Dish, Region, Diet, Cuisine, FoodProduct, NutritionalInfo; properties: hasIngredient, hasCuisine, hasRegion, etc.). Target: Tier M scale (~10K–50K triples for testing).

---

## 5. Sprint 2 Exit Gate Checklist

| Gate | Criteria | Verification |
|---|---|---|
| Ontology-aware inspection | AC-104 | Playwright: class/property/individual inspector |
| Bounded exploration | AC-105 | State engine limits + Playwright |
| Inference distinction | AC-106 | Visual + textual asserted/inferred markers |
| Why explanation | AC-107 | Explanation panel or unavailable message |
| Path outcomes | AC-108 | All 4 PathStatus outcomes |
| Large backend | AC-109 | Synthetic Food ontology bounded queries |
| Supported renderers | AC-110 | Cytoscape detail + cosmos overview |
| GPU fallback | AC-111 | Mock WebGL failure → table + Cytoscape |
| Accessibility | AC-113 | axe-core + keyboard + responsive |
| 500/1000 budget | — | Unit + Playwright |
| No unbounded memory | — | 20 expand/collapse cycles |

---

## 6. Documentation Requirements

Each batch MUST produce a batch report (`docs/batch-reports/batch-{id}-report.md`) following the Sprint 1 format:
- What was delivered
- Files created/modified
- Tests added
- Defects found (if any)
- Integration notes

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| cosmos overview not useful at class granularity | MEDIUM | User-test cluster semantics before polish; defer algorithmic clustering to Sprint 4 |
| Cytoscape layouts stall on main thread | MEDIUM | Hard budgets, precompute layouts, disable animation, cancellation |
| GPU variability across devices | MEDIUM | Capability detection, device testing, textual fallback |
| Session breaks after ontology swap | MEDIUM | Explicit compatibility checks, partial restore |
| Canvas excludes keyboard/screen readers | HIGH | Textual equivalence for all canvas content |
| Synthetic Food ontology not representative | LOW | Design fixture to match real ontology schema from reference design |
