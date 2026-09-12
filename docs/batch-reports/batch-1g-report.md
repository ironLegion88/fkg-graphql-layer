# Sprint 1 Batch 1G Report: Store Operations & Observability

**Status:** Completed
**Branch:** `feat/store-operations`

## Telemetry Structure

A new `TelemetryMiddleware` was introduced in `core/telemetry.py` to fulfill the structured telemetry and audit requirement (OR-004). This middleware sits in the ASGI pipeline and emits JSON-formatted logs for every request.

The JSON structure captures:
- `operation`: The HTTP method and path (e.g., `POST /graphql`).
- `build_id`: The active ontology build ID serving the request, extracted from the application state.
- `duration_ms`: The total time taken to handle the request.
- `status_code`: The HTTP status code returned.
- `error`: If an exception was raised, the exception class name.
- `stable_error_code`: Translated standard error codes (e.g., `INTERNAL_SERVER_ERROR`, `BAD_REQUEST`).

**Note on Privacy/Security**: No sensitive data, request bodies, literals, or graph query results are logged. GraphQL errors are bounded and handled at the service layer; telemetry relies on HTTP-level metadata to provide high-level observability.

## CLI Commands Added

The store lifecycle management CLI (`ingestion/lifecycle.py`) was introduced to satisfy OR-001 (Build Lifecycle Commands).

It provides the following commands:
- `python -m ingestion.lifecycle list`: Lists all store builds found in `.data/oxigraph/builds/` and indicates the active build (determined by `current.json`).
- `python -m ingestion.lifecycle backup <build_id> <archive_path>`: Creates a compressed archive (zip/tar) of the specified immutable build directory.
- `python -m ingestion.lifecycle restore <archive_path>`: Extracts a store backup into the local builds directory.
- `python -m ingestion.lifecycle promote <build_id>`: Updates the active `current.json` pointer to an available build atomically.
- `python -m ingestion.lifecycle rollback`: Reverts `current.json` to the previous active build, allowing fast sub-second disaster recovery.

## Testing Strategy

Tests were implemented to verify all added capabilities:
1. **`tests/test_store_lifecycle.py`**:
   - `test_backup_and_restore`: Verifies that `backup` creates valid zip archives containing the build's manifest and store data, and that `restore` correctly unpackages it into the local directory.
   - `test_promote_and_rollback`: Tests the atomic pointer update of `current.json` and ensures `rollback` correctly restores the `previous_build_id` state.

2. **`tests/test_telemetry.py`**:
   - `test_telemetry_success`: Verifies that a successful request logs the correct `operation`, `status_code`, and `duration_ms`.
   - `test_telemetry_server_error`: Ensures that unhandled exceptions are caught, logged with `error` and `stable_error_code: INTERNAL_SERVER_ERROR`, and then re-raised.
   - `test_telemetry_client_error`: Verifies that client errors appropriately log `BAD_REQUEST`.

3. **`tests/test_main.py`**:
   - Unchanged, but used to verify that the inclusion of the `TelemetryMiddleware` and `/health/readiness` endpoint in `main.py` does not break existing integration tests.

## Readiness Endpoint

A new `/health/readiness` endpoint was added to `main.py` (satisfying OR-002). It performs a fast check of `current.json` and `store-manifest.json` and dynamically queries the `GraphService` profile to return:
- `status`: `ok` or `not ready`
- `store_open`: Boolean indication of the backend graph repository state.
- `active_build_id` and `manifest_hash`: Pulled from `current.json`.
- `triple_count` and `inferred_count`: Read from the build metadata cache without triggering expensive store queries.
- `semantic_profile`: Extracted from the currently active ontology profile.
- `reasoner_status`: Derived from the presence of `inferred_triple_count` metadata.
- `consistency` and `validation_summary`: Confirmed through the atomic build process.

## Deployment Model

The deployment process was documented in `docs/deployment-model.md` to satisfy OR-006, outlining the read-only FastAPI architecture and the isolated store writer pipeline.
