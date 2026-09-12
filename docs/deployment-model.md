# Deployment Model and Process

This document defines the supported deployment model for the Ontology Graph Explorer backend, ensuring data integrity and reliable operation of the embedded RDF store (PyOxigraph).

## Store Directory Ownership

The underlying PyOxigraph RDF store (`.data/oxigraph/store`) is embedded and accesses local files directly. To prevent corruption and ensure deterministic reads:

- **Single Writer Topology**: Only ONE process may ever open the PyOxigraph store in writer mode. In our architecture, **no runtime process opens the store in writer mode**. Writing happens strictly during the offline ingestion/build pipeline (`python -m ingestion.build_store`).
- **Read-Only Reader Topology**: The FastAPI application processes MUST open the store in strictly read-only mode.
- **Atomic Swap**: The active store pointer (`current.json`) and store directories (`builds/<build_id>/store`) are swapped atomically via the `lifecycle.py` CLI or `build_store.py` during promotion. Readers already connected to the old store continue reading it until they are gracefully restarted or they read `current.json` anew upon new instantiation.

## Supported Readers and Writers

- **Writers**: 
  - `ingestion.build_store` pipeline (creates immutable builds).
- **Readers**: 
  - FastAPI application workers (`uvicorn main:app`).
  - Offline reporting and export scripts.
  - Telemetry and audit processes.

All readers MUST ensure they mount the `.data/oxigraph` volume with appropriate permissions and never attempt concurrent write locks.

## FastAPI Deployment Topology

For the FastAPI entry point (`main.py`):

1. **Process Model**: The application is deployed via ASGI servers (e.g., Uvicorn/Gunicorn). Multi-process (worker) scaling is fully supported because the underlying PyOxigraph adapter opens the store in read-only mode.
2. **Stateless Middleware**: The `TelemetryMiddleware` logs JSON securely to standard output, which is then captured by an external aggregator (e.g., FluentBit, Datadog).
3. **Availability / Swaps**: Promoting a new ontology build updates `current.json`. To fully migrate existing connections, a rolling restart of the ASGI workers is recommended, though new worker spawns will automatically pick up the new build ID.

## Recovery Objectives

- **Recovery Point Objective (RPO)**: Controlled strictly by the ingestion and build cycle. Backups are point-in-time archives (zip/tar) of the immutable build directories. A rollback via `lifecycle.py rollback` takes milliseconds.
- **Recovery Time Objective (RTO)**: Sub-second recovery is achievable via atomic pointer swaps (modifying `current.json`). If the active build corrupts, an operator can immediately promote a known-good backup.

## Lifecycle Commands

The repository includes `ingestion/lifecycle.py` which must be used for safe administration:

```bash
# List builds
python -m ingestion.lifecycle list

# Backup a store build
python -m ingestion.lifecycle backup <build_id> <archive_path.zip>

# Restore a store build
python -m ingestion.lifecycle restore <archive_path.zip>

# Promote a store build
python -m ingestion.lifecycle promote <build_id>

# Rollback to the previous store build
python -m ingestion.lifecycle rollback
```
