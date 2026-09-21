# Sprint 2 Batch 0D Implementation Report: CI Hardening, Tech Debt Remediation & Shared Conformance Fixtures

## 1. Summary

Batch 0D is the final batch of Phase 0 (Sprint 1 Gap Remediation) of Sprint 2. It hardens the CI pipeline, removes technical debt around runtime dependencies, and prepares shared conformance test fixtures for Sprint 2 (and Sprint 3) frontend development:

1. **Ruff Linting Strictness:** Resolved all 147 lint violations across the entire codebase (including duplicate and unused imports, un-sorted imports, redundant collection constructors, and broad exception handlers).
2. **CI Pipeline Hardening:** Removed `continue-on-error: true` from the `ruff check .` step in `.github/workflows/ci.yml` so linting errors block merges, and added `sprint-2/*` branch triggers to push and pull request CI workflows.
3. **Lazy-Import GraphDB in Repository Factory:** Guarded GraphDB imports (`httpx`, `GraphDBSettings`, `GraphRetrievalService`) within `create_graph_repository` in `services/repository_factory.py` so that `httpx` is no longer a hard runtime dependency when using the default Oxigraph backend, and enforced client type checking.
4. **Shared Conformance Test Fixtures:** Created `tests/shared/` containing `graphql_fixtures.py` (canonical entity shapes, all 16 GQ-115 error codes, provenance-enabled relationships, class/property metadata, search results, expansion previews, active profiles) and `test_conformance.py` validating all fixtures against the live GraphQL API schema.
5. **Phase 0 Completion:** With Batch 0D finished, all five Sprint 1 gaps, known defects, and CI/tech-debt items in Phase 0 are fully resolved.

## 2. Completed Work

### 2.1 Fix Ruff Lint Violations (Step 1)
- Resolved all lint violations across 46 codebase files:
  - Eliminated duplicate `from typing import TypedDict` in `api/graphql_schema.py`.
  - Cleaned up unused imports across domain, services, adapters, ingestion, and tests.
  - Organized imports into standard order (stdlib -> third-party -> project).
  - Replaced redundant collection calls and simplified nested context managers / conditionals.
  - Handled broad exception clauses with targeted `# noqa` annotations where error interception is required by design (e.g. benchmarks and parser resilience).
- Verified `ruff check .` passes with zero errors.

### 2.2 Strict CI Pipeline & Sprint 2 Triggers (Step 2)
- Updated `.github/workflows/ci.yml`:
  - Removed `continue-on-error: true` from `Run Ruff Lint` step.
  - Added `sprint-2/*` to `on.push.branches` and `on.pull_request.branches`.

### 2.3 Guard GraphDB Adapter in Repository Factory (Step 3)
- Refactored `create_graph_repository` in `services/repository_factory.py`:
  - Moved `httpx`, `GraphDBSettings`, and `GraphRetrievalService` imports inside `if backend == "graphdb":`.
  - Added validation `if not isinstance(client, httpx.AsyncClient): raise GraphBackendError(...)`.
  - Verified `httpx` and `GraphRetrievalService` are not exposed at module level.
  - Updated `tests/test_repository_factory.py` with client injection and validation tests.

### 2.4 Shared Conformance Test Fixtures (Step 4)
- Created `tests/shared/` package:
  - `tests/shared/__init__.py`: Package marker.
  - `tests/shared/graphql_fixtures.py`: Canonical shapes for `WINE_ENTITY`, `WINERY_ENTITY`, `REGION_ENTITY`, `ERROR_RESPONSES` (all 16 codes), `PROVENANCE_RELATIONSHIP`, `INFERRED_RELATIONSHIP`, `CLASS_INFO`, `PROPERTY_INFO`, `SEARCH_RESULT`, `EXPANSION_PREVIEW`, and `ACTIVE_PROFILE`.
  - `tests/shared/test_conformance.py`: 9 conformance tests validating fixture structure and field parity against Strawberry GraphQL schema execution.

## 3. Files Created / Modified

| File | Status | Line Count | Changes |
|---|---|---|---|
| `.github/workflows/ci.yml` | Modified | 64 lines | Strict ruff lint, `sprint-2/*` triggers |
| `services/repository_factory.py` | Modified | 28 lines | Lazy-import GraphDB & `httpx`, client validation |
| `tests/test_repository_factory.py` | Modified | 98 lines | Test client requirement and module cleanliness |
| `tests/shared/__init__.py` | Created | 1 line | Shared package marker |
| `tests/shared/graphql_fixtures.py` | Created | 197 lines | Canonical GraphQL response fixtures |
| `tests/shared/test_conformance.py` | Created | 402 lines | 9 conformance tests against GraphQL schema |
| `api/graphql_schema.py` | Modified | 865 lines | Removed duplicate `TypedDict` import, organized imports |
| `docs/batch-reports/batch-0d-report.md` | Created | ~130 lines | Batch 0D report & Phase 0 completion summary |

## 4. Tests Added

11 new backend tests added in Batch 0D:

### In `tests/test_repository_factory.py`:
1. `test_factory_graphdb_requires_async_client` — validates `create_graph_repository` rejects missing or invalid client when `graphdb` backend is selected.
2. `test_repository_factory_does_not_expose_httpx_at_module_level` — validates `httpx` and `GraphRetrievalService` are not loaded into module scope at import time.

### In `tests/shared/test_conformance.py`:
3. `test_all_sixteen_error_codes_present_in_shared_fixtures` — verifies all 16 `GraphQLErrorCode` enum members are present in `ERROR_RESPONSES` with valid messages and code extensions.
4. `test_canonical_entity_shape_matches_graphql_response` — verifies `WINE_ENTITY` shape matches `get_entity` response.
5. `test_provenance_relationship_fixture_matches_graphql_response` — verifies `PROVENANCE_RELATIONSHIP` keys match `get_relationships` response with provenance fields.
6. `test_inferred_relationship_fixture_matches_graphql_structure` — verifies `INFERRED_RELATIONSHIP` matches inferred edge responses.
7. `test_canonical_class_info_shape_matches_graphql_response` — verifies `CLASS_INFO` matches `get_class_info` GraphQL type structure.
8. `test_canonical_property_info_shape_matches_graphql_response` — verifies `PROPERTY_INFO` matches `get_property_info` GraphQL type structure.
9. `test_canonical_search_result_shape_matches_graphql_response` — verifies `SEARCH_RESULT` matches `search` GraphQL resolver output.
10. `test_canonical_expansion_preview_shape_matches_graphql_response` — verifies `EXPANSION_PREVIEW` matches `get_expansion_preview` GraphQL resolver output.
11. `test_canonical_active_profile_shape_matches_graphql_response` — verifies `ACTIVE_PROFILE` matches `get_active_profile` GraphQL resolver output.

## 5. Defects & Gaps Resolved

- **CI Hardening**: Resolved. CI is now strict (`continue-on-error: true` removed) and triggers on `sprint-2/*` branches.
- **Tech Debt (Lazy Imports)**: Resolved. `services/repository_factory.py` no longer imports `httpx` at module level.
- **Shared Test Fixtures**: Resolved. `tests/shared/graphql_fixtures.py` and `test_conformance.py` provide canonical fixtures and verification.

## 6. Verification & Test Counts

- **Backend tests:** 142 passed (131 baseline + 11 new), 9 deprecation warnings
- **Ruff lint:** 0 errors across entire repository (`ruff check .` clean)
- **Frontend tests:** 6 passed (Vitest)
- **Frontend build:** Clean (`tsc -b && vite build` passed)
- **Git whitespace check:** Clean (`git diff --check` passed)

---

## 7. Phase 0 Completion Summary

Phase 0 (Sprint 1 Gap Remediation) is officially **COMPLETE**.

### 7.1 Gap Status Checklist
- [x] **Gap 1: SemanticRepository Not Wired into GraphQL** — RESOLVED (Batch 0A)
  - Instantiated `OxigraphSemanticRepository`, added 7 query resolvers, 10 Strawberry types, 13 tests.
- [x] **Gap 2: GraphQL Relationship Lacks Provenance** — RESOLVED (Batch 0B)
  - Exposed `predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle` on `GraphRelationship`.
- [x] **Gap 3: Error Codes Incomplete** — RESOLVED (Batch 0C)
  - Expanded `GraphQLErrorCode` enum to all 16 required stable codes; enum values used throughout security and auth layers.
- [x] **Gap 4: build_id Always None** — RESOLVED (Batch 0C)
  - Wired `active_build_id` from app state into `get_active_profile` resolver.
- [x] **Gap 5: Readiness Hardcodes Consistency** — RESOLVED (Batch 0C)
  - Updated `/health/readiness` to read `consistency` and `validation_summary` dynamically from `store-manifest.json`.
- [x] **DEF-0A-1: SPARQL Projection Bug** — RESOLVED (Batch 0B)
  - Added `?needle` to SPARQL SELECT projection in `_search`.
- [x] **CI Strictness & Branch Triggers** — RESOLVED (Batch 0D)
  - Strict ruff linting in CI with `sprint-2/*` push/PR triggers.
- [x] **Tech Debt (Hard httpx Dependency)** — RESOLVED (Batch 0D)
  - Lazy-imported GraphDB adapter in repository factory.
- [x] **Shared Test Fixtures** — RESOLVED (Batch 0D)
  - Canonical fixtures and conformance tests established in `tests/shared/`.

### 7.2 Cumulative Phase 0 Metrics
- **Baseline branch:** `sprint-1/core-platform` (commit `b16b2c7`)
- **Phase 0 branch:** `sprint-2/gap-remediation`
- **Total commits on branch:** 27 commits (including documentation)
- **Backend tests:** Started at 104 -> Ended at 142 (+38 new tests, +36.5% test growth)
- **Frontend tests:** 6 passed (Vitest), build clean
- **All Phase 0 exit criteria met.** Branch is ready for merge into `sprint-2/supported-app` for Phase 1.
