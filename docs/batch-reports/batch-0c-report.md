# Sprint 2 Batch 0C Implementation Report: Error Codes Completeness, build_id Wiring & Readiness Manifest Integration

## 1. Summary

Batch 0C resolves Gaps 3, 4, and 5 from Sprint 1 by:
1. Completing the `GraphQLErrorCode` enum with all 16 required codes defined in GQ-115.
2. Replacing raw error code strings in `api/security.py` (`BUDGET_EXHAUSTED`, `TIMEOUT`) and `api/graphql_schema.py` (`FORBIDDEN`) with enum-based values.
3. Wiring `active_build_id` from FastAPI application state into GraphQL execution context and reading it in the `get_active_profile` query resolver instead of hardcoding `None`.
4. Updating the `/health/readiness` operational endpoint to read `consistency` and `validation_summary` dynamically from `store-manifest.json` with fallback to `"unknown"` instead of hardcoding static strings.

## 2. Completed Work

### 2.1 Complete `GraphQLErrorCode` Enum (Step 1)
- Added 11 new error codes to `GraphQLErrorCode` in `services/exceptions.py` to reach the full set of 16 stable codes required by GQ-115:
  - `TIMEOUT`, `CANCELLED`, `FORBIDDEN`, `STORE_NOT_READY`, `ONTOLOGY_INCONSISTENT`, `REASONER_UNAVAILABLE`, `EXPLANATION_UNAVAILABLE`, `UNSUPPORTED_SEMANTIC_CONSTRUCT`, `BACKEND_UNAVAILABLE`, `INVALID_PREDICATE`, `QUERY_TOO_COMPLEX`.

### 2.2 Enum-Based Codes in Safety Extension (Step 2)
- Updated `GraphQLSafetyExtension` in `api/security.py` to import and reference `GraphQLErrorCode`:
  - Query depth limit violation uses `GraphQLErrorCode.BUDGET_EXHAUSTED.value`.
  - Field complexity limit violation uses `GraphQLErrorCode.BUDGET_EXHAUSTED.value`.
  - Hard execution timeout uses `GraphQLErrorCode.TIMEOUT.value`.

### 2.3 Enum-Based Auth Rejection Codes (Step 3)
- Updated `_graph_service()` and `_semantic_repository()` helpers in `api/graphql_schema.py` to emit `GraphQLErrorCode.FORBIDDEN.value` instead of the legacy raw string `"UNAUTHORIZED"`.
- Updated test assertion in `tests/test_graphql_safety.py` (`test_unauthorized_if_invalid_role`) to expect `"FORBIDDEN"`.

### 2.4 Wire `build_id` into `get_active_profile` (Step 4)
- Added `active_build_id: NotRequired[str | None]` to `GraphQLContext` TypedDict in `api/graphql_schema.py`.
- Injected `"active_build_id": getattr(request.app.state, "active_build_id", None)` into `get_graphql_context()` in `main.py`.
- Updated `get_active_profile` resolver in `api/graphql_schema.py` to read `build_id=info.context.get("active_build_id")`.

### 2.5 Dynamic Readiness Consistency & Validation Summary (Step 5)
- Updated `/health/readiness` handler in `main.py` to read `consistency` and `validation_summary` directly from `metadata` loaded from `store-manifest.json`:
  - `"consistency": metadata.get("consistency", "unknown")`
  - `"validation_summary": metadata.get("validation_summary", "unknown")`

### 2.6 Tests (Step 6)
- Created dedicated test module `tests/test_error_codes.py` containing 9 tests covering all 16 enum codes, context and end-to-end `build_id` resolution, readiness manifest reading and fallback, auth rejection `FORBIDDEN` codes, and timeout `TIMEOUT` codes.

## 3. Files Created / Modified

| File | Status | Line Count | Changes |
|---|---|---|---|
| `services/exceptions.py` | Modified | 49 lines | Added 11 new error codes to `GraphQLErrorCode` enum |
| `api/security.py` | Modified | 105 lines | Use `GraphQLErrorCode.BUDGET_EXHAUSTED.value` and `TIMEOUT.value` |
| `api/graphql_schema.py` | Modified | 854 lines | Emit `FORBIDDEN` in auth rejection, type and wire `build_id` in context/resolver |
| `main.py` | Modified | 144 lines | Pass `active_build_id` to context, read `consistency` and `validation_summary` from manifest |
| `tests/test_graphql_safety.py` | Modified | 74 lines | Update auth rejection assertion to `FORBIDDEN` |
| `tests/test_error_codes.py` | Created | 318 lines | 9 new tests for error codes, build_id, readiness, and auth |
| `docs/batch-reports/batch-0c-report.md` | Created | ~90 lines | Batch completion documentation |

## 4. Tests Added

A new test module `tests/test_error_codes.py` was created containing 9 tests:
1. `test_all_sixteen_error_codes_are_valid_enum_members` — verifies that `GraphQLErrorCode` has exactly 16 members and each member corresponds to the expected string value.
2. `test_build_id_populated_in_get_active_profile` — verifies `get_active_profile` populates `build_id` when provided in GraphQL context.
3. `test_build_id_none_when_omitted_in_context` — verifies `get_active_profile` returns `None` for `build_id` when omitted from context.
4. `test_build_id_populated_end_to_end_from_active_store` — end-to-end test verifying `get_active_profile` resolves the active build ID from an active store build via `lifespan`.
5. `test_readiness_returns_consistency_from_manifest` — verifies `/health/readiness` reads `consistency` and `validation_summary` from `store-manifest.json`.
6. `test_readiness_falls_back_to_unknown_when_manifest_omits_fields` — verifies `/health/readiness` falls back to `"unknown"` when manifest omits consistency fields.
7. `test_auth_rejection_uses_forbidden_code_graph_service` — verifies `_graph_service()` auth rejection emits `FORBIDDEN`.
8. `test_auth_rejection_uses_forbidden_code_semantic_repository` — verifies `_semantic_repository()` auth rejection emits `FORBIDDEN`.
9. `test_safety_extension_timeout_emits_timeout_code` — verifies `GraphQLSafetyExtension` timeout handler emits `TIMEOUT`.

## 5. Defects & Gaps Resolved

- **Gap 3 (GQ-115)**: Resolved. `GraphQLErrorCode` now contains all 16 required stable codes, and safety/auth handlers emit enum-backed codes.
- **Gap 4**: Resolved. `get_active_profile` now returns `active_build_id` from context instead of hardcoding `None`.
- **Gap 5**: Resolved. `/health/readiness` now reads `consistency` and `validation_summary` dynamically from `store-manifest.json` instead of hardcoding `"consistent"` and `"Passed"`.

## 6. Verification & Test Counts

- **Backend tests:** 131 passed (122 baseline + 9 new)
- **Frontend tests:** 6 passed (Vitest)
- **Frontend build:** Clean (`tsc -b && vite build` passed)
- **Whitespace check:** `git diff --check` clean
