# Food Knowledge Graph Prototype

A three-layer FastAPI and Strawberry facade over RDF/OWL knowledge graphs. The
default runtime loads committed RDF sources into an embedded PyOxigraph store;
public GraphQL clients remain independent of the store and internal SPARQL.

## Layers

- `api/graphql_schema.py`: Stable public Strawberry types and resolvers.
- `services/graph_service.py`: Database-neutral domain orchestration.
- `adapters/oxigraph/`: Default embedded RDF retrieval implementation.
- `services/graph_retrieval.py`: Temporary GraphDB parity and rollback adapter.
- `ingestion/`: Reproducible RDF loading and semantic materialization.
- `domain/models.py`: Shared, database-neutral objects between layers.
- `frontend/`: React graph explorer with Cytoscape visualization.

## Configure and run

Install the project, build the embedded store, and run the API:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m ingestion.build_store `
  --manifest config\rdf-sources.yaml `
  --output .data\oxigraph
$env:GRAPH_BACKEND = "oxigraph"
$env:RDF_STORE_PATH = ".data/oxigraph"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

The GraphQL explorer is available at `http://127.0.0.1:8000/graphql`.

The store builder creates content-addressed builds, materializes the configured
`rdfs-wine-parity` profile, and atomically updates `.data/oxigraph/current.json`.
Generated store data is ignored by Git.

## Graph explorer

Start the backend in one PowerShell terminal:

```powershell
$env:GRAPH_BACKEND = "oxigraph"
$env:RDF_STORE_PATH = ".data/oxigraph"
$env:FRONTEND_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Then start the frontend in a second terminal:

```powershell
Set-Location frontend
npm install
npx vite --host=127.0.0.1 --port=5173
```

Open `http://127.0.0.1:5173` to search entities, inspect labelled graph edges,
and expand relationships. The frontend expects the API at
`http://localhost:8000/graphql`; override it with `VITE_GRAPHQL_URL` when
needed. See [frontend/.env.example](frontend/.env.example).

The public API provides bounded cursor expansion. A graph relationship preserves
its canonical RDF direction and predicate:

```graphql
query Explore($id: ID!, $cursor: String) {
  expand_graph(
    id: $id
    options: {node_limit: 50, edge_limit: 100, cursor: $cursor}
  ) {
    nodes { id label }
    relationships { relation source { id } target { id } }
    page_info { truncated next_cursor }
  }
}
```

## GraphDB parity and rollback

GraphDB is no longer the default runtime. It remains available during migration
for parity checks and emergency rollback:

```powershell
$env:GRAPH_BACKEND = "graphdb"
$env:GRAPHDB_BASE_URL = "http://localhost:7200"
$env:GRAPHDB_REPOSITORY = "wine"
$env:GRAPHDB_ENDPOINT_ID = "wine-v2"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

See [GRAPHDB_SETUP.md](GRAPHDB_SETUP.md) for the archived endpoint setup and
[docs/benchmarks/owl-store-parity.md](docs/benchmarks/owl-store-parity.md) for
the current semantic and latency comparison.

## Migration documentation

- [Analysis](docs/owl-store-migration-analysis.md)
- [Requirements](docs/owl-store-migration-requirements.md)
- [Implementation plan](docs/owl-store-migration-implementation-plan.md)
