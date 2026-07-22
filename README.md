# Wine GraphQL Facade

A three-layer FastAPI and Strawberry facade for Ontotext GraphDB's Sample Wines
knowledge graph. Public GraphQL clients never depend on GraphDB's generated
GraphQL schema.

## Layers

- `api/graphql_schema.py`: Stable public Strawberry types and resolvers.
- `services/graph_service.py`: Database-neutral domain orchestration.
- `services/graph_retrieval.py`: The sole GraphDB-specific adapter, including
  endpoint access and native GraphQL documents.
- `domain/models.py`: Shared, database-neutral objects between layers.
- `frontend/`: React graph explorer with Cytoscape visualization.

## Configure and run

Copy `.env.example` values into the process environment, then install and run:

```powershell
python -m pip install -e .
uvicorn main:app --reload
```

The GraphQL explorer is available at `http://127.0.0.1:8000/graphql`.

Before starting the backend against GraphDB, follow [GRAPHDB_SETUP.md](GRAPHDB_SETUP.md).
It imports the generated label data and creates the `wine-v2` endpoint expected
by the retrieval adapter.

## Graph explorer

Start the backend in one PowerShell terminal:

```powershell
$env:GRAPHDB_BASE_URL = "http://localhost:7200"
$env:GRAPHDB_REPOSITORY = "wine"
$env:GRAPHDB_ENDPOINT_ID = "wine-v2"
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

The public API also provides `get_entity` and `get_relationships`. A graph
relationship preserves its canonical RDF direction and predicate:

```graphql
query($id: ID!) {
  get_relationships(id: $id) {
    relation
    source { id label }
    target { id label }
  }
}
```

## GraphDB schema note

GraphDB's GraphQL API is addressed by both repository and endpoint ID. The
labeled Sample Wines setup uses:

```text
http://localhost:7200/rest/repositories/wine/graphql/wine-v2
```

Its generated root fields are lowercase (`wine`, `winery`, `region`, and
`wineGrape`). The `wine-v2` schema exposes `displayName` as a language-tagged
RDF literal; the retrieval service maps its `value` to the public API's stable
`label`. The Sample Wines generated endpoint does not reliably filter inferred
`Wine` instances by ID; for this bounded sample dataset, the adapter fetches up
to 250 entities per core collection and applies exact IRI matching locally.

For another GraphDB endpoint, update only `GraphDBSettings` and the GraphQL
documents in `GraphRetrievalService`; the service and public schema remain
unchanged.
