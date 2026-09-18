# Project Status — 2026-09-14

**Branch:** `sprint-1/core-platform`  
**Head Commit:** `b16b2c7` — `docs: finalize sprint 1 context and mark 1F, 1G, 1H as complete`  
**Previous Status Document:** `project-status-2026-09-10.md` (commit `2e543f4`, branch `feat/owl-store-migration`)  
**Sprint Completed:** Sprint 1 — Core Platform and Semantic Foundation (Batches 1A–1H)

---

## 1. Verification State

| Gate | Result | Command | Details |
|---|---|---|---|
| Backend tests | ✅ **104 passed** | `pytest tests/ -v` | 7.34s, 9 expected deprecation warnings |
| Frontend tests | ✅ **6 passed** | `npm test` | 557ms, 2 test files (state.test.ts, generateFixture.test.ts) |
| Frontend build | ✅ **Passes** | `npm run build` | `tsc -b && vite build` in 6.88s. Non-failing advisory: benchmark chunk >500KB |
| TypeScript strict mode | ✅ **Zero errors** | `tsc -b` | `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` |
| CI definition | ✅ **Present** | — | `.github/workflows/ci.yml` (backend + frontend parallel jobs) |
| Editor diagnostics | ✅ **0 errors** | — | — |

### Test Distribution (104 Backend Tests)

| Module | Count | Coverage |
|---|---|---|
| `test_import_resolution` | 12 | Import BFS, checksums, cycles, allowlists, vendoring |
| `test_serialization` | 12 | RDF/XML, Turtle, JSON-LD, N-Triples, N-Quads, TriG, edge cases |
| `test_graph_service` | 8 | Facade validation, limits, deprecated Wine shims |
| `test_graphql_schema` | 8 | Resolver mapping, error masking, profile query |
| `test_ingestion` | 7 | Build pipeline, hashing, semantic profiles, missing sources |
| `test_parser_security` | 7 | Path traversal, file size, XXE, billion-laughs |
| `test_oxigraph_repository` | 6 | Entity lookup, search, directional relationships, cursors |
| `test_traversal` | 6 | Pagination, cursor fingerprinting, tamper rejection |
| `test_graphql_safety` | 5 | Depth/field limits, alias handling, auth, timeout |
| `test_ontology_profile` | 4 | Wine/Pizza loading, validation, missing fields |
| `test_repository_factory` | 4 | Backend selection, promoted store |
| `test_semantic_models` | 4 | CompactIRI parsing, TypedValue, ResourceMetadata |
| `test_main` | 4 | Health, readiness, CORS, GraphQL endpoint |
| `test_reasoning` | 3 | Wine parity closure, none profile, unknown rejection |
| `test_reasoning_providers` | 3 | HermiT consistency, inconsistency, materialization |
| `test_telemetry` | 3 | Success/error/client-error structured logs |
| `test_exceptions` | 3 | Error code enum, hierarchy |
| `test_additional_fixtures` | 3 | Dense axioms, unsupported datatypes, deep hierarchy |
| `test_oxigraph_semantic_repository` | 2 | Class info, property info introspection |
| `test_store_lifecycle` | 2 | Backup/restore, promote/rollback |
| `test_paths_comparisons` | 2 | Shortest path, entity comparison |
| `test_backend_comparison` | 1 | Oxigraph/GraphDB parity scaffold |
| `test_generate_wine_labels` | 1 | Label generation script |

---

## 2. Active Embedded PyOxigraph Store

| Property | Value |
|---|---|
| Build ID | Content-addressed (20-char hex from SHA-256 of sources + config + imports) |
| Asserted sources | `wine.rdf` (RDF/XML → `urn:fkg:graph:asserted`), `wine-labels.ttl` (Turtle → `urn:fkg:graph:labels`) |
| Vendored imports | `vendor/food.rdf` (W3C Food Ontology → `urn:fkg:graph:imports:<hash[:12]>`) |
| Reasoning profile | `rdfs-wine-parity` (transitive subClassOf, intersectionOf, inverse, symmetric closures) |
| Inferred graph | `urn:fkg:graph:inferred` (isolated provenance) |
| Storage engine | PyOxigraph (Rust-based, RocksDB-backed, embedded) |
| Store mode | Read-only at runtime (`Store.read_only(...)`) |
| Store location | `.data/oxigraph/builds/<build_id>/store/` |
| Active pointer | `.data/oxigraph/current.json` (atomic promotion via `os.replace()`) |
| Lifecycle CLI | `python -m ingestion.lifecycle {list,backup,restore,promote,rollback}` |

### Content-Addressed Build Pipeline

```
config/rdf-sources.yaml
    │
    ├── Sources: wine.rdf, wine-labels.ttl
    │     └── SHA-256 hashed per file
    ├── Imports: vendor/food.rdf (allowlisted, checksummed)
    │     └── SHA-256: 64af31d9...
    ├── Security: validate_source_path → validate_file_size → safe_parse_rdf
    │     └── XXE-resistant PyOxigraph Rust parser
    ├── Reasoning: materialize_semantics(profile="rdfs-wine-parity")
    │     └── Alternative: profile="hermit" → subprocess HermiT via owlready2
    ├── Build ID: SHA-256(version + profile + sources + imports)
    │     └── Deterministic, content-addressed, 20-char hex
    └── Atomic Promotion: temp dir → rename → current.json update
```

---

## 3. Ontology Package Architecture

The system is now fully ontology-neutral. All domain-specific behavior is driven by declarative YAML profiles.

### Active Profiles

#### Wine Profile (`config/wine-profile.yaml`)
| Field | Value |
|---|---|
| `package_id` | `fkg-wine` |
| `version` | `1.0.0` |
| `title` | Wine Graph Explorer |
| `ontology_iris` | `http://www.w3.org/TR/2003/CR-owl-guide-20030818/wine` |
| `prefixes` | `vin:`, `food:`, `owl:`, `rdfs:`, `rdf:` |
| `searchable_classes` | `vin:Wine`, `vin:Winery`, `vin:Region`, `vin:WineGrape` |
| `traversable_predicates` | `hasMaker`, `locatedIn`, `madeFromGrape`, `adjacentRegion` |
| `categories` | Wine (#b83c50), Winery (#d7972f), Region (#287b73), Grape (#6c5ca4) |
| `reasoning` | `rdfs-wine-parity` |
| `limits` | depth=1, nodes=2000, edges=4000 |

#### Pizza Profile (`config/pizza-profile.yaml`)
| Field | Value |
|---|---|
| `package_id` | `fkg-pizza` |
| `version` | `1.0.0` |
| `title` | Pizza Graph Explorer |
| `ontology_iris` | Manchester Pizza OWL |
| `prefixes` | `pizza:`, `owl:`, `rdfs:`, `rdf:` |
| `searchable_classes` | `pizza:Pizza`, `pizza:PizzaTopping`, `pizza:PizzaBase`, `pizza:Country` |
| `traversable_predicates` | `hasTopping`, `hasBase`, `hasCountryOfOrigin`, `isIngredientOf`, `isToppingOf` |
| `categories` | Pizza, PizzaTopping, PizzaBase, Country (each with distinct hex color) |
| `reasoning` | `none` |
| `limits` | depth=1, nodes=2000, edges=4000 |

### Profile Schema (`domain/ontology_profile.py`)

The `OntologyPackage` Pydantic model contains 12 frozen configuration sections:

1. **`SourceConfig`** — RDF source file, format, target graph, optional SHA-256
2. **`ImportConfig`** — Mode (`disabled`/`vendored`), allowlist, vendor_dir, local_mappings, checksums
3. **`PrefixConfig`** — `base_iri`, `prefixes` dictionary
4. **`LanguageConfig`** — `preferred_languages` tuple (default `("en", "ANY")`)
5. **`LabelConfig`** — Label, alternate-label, description, image, identifier predicates
6. **`SearchConfig`** — `searchable_classes` tuple
7. **`PredicateConfig`** — Traversable, hidden, sensitive, display-only predicates
8. **`SemanticCategoryConfig`** — Class IRIs → label, color, icon
9. **`ReasoningConfig`** — Profile name, provider, version, timeout, memory
10. **`LimitsConfig`** — Max depth, max nodes, max edges
11. **`ValidationConfig`** — SHACL shapes, validation policies
12. **Root `OntologyPackage`** — Package ID, version, title, description, ontology IRIs, minimum app version

Loaded via `load_ontology_profile()` with `ONTOLOGY_PROFILE` env var override.

---

## 4. Domain Layer (`domain/`)

### 4.1 Core Models (`domain/models.py`)

| Type | Kind | Key Fields | Sprint 1 Additions |
|---|---|---|---|
| `SemanticResourceKind` | Type alias (`str`) | — | Replaced hardcoded `EntityKind` enum (1A) |
| `UNKNOWN_KIND` | Constant | `"Unknown"` | Fallback for unclassified entities (1A) |
| `TraversalDirection` | Enum | `OUTGOING`, `INCOMING`, `BOTH` | Pre-existing |
| `PathStatus` | Enum | `SUCCESS`, `NO_PATH`, `TIMEOUT`, `BUDGET_EXHAUSTED` | New (1E) |
| `GraphEntity` | Frozen dataclass | `id`, `label`, `kind`, `description`, `properties` | `kind` now `SemanticResourceKind` (1A) |
| `GraphRelationship` | Frozen dataclass | `source`, `target`, `relation`, `relationship_id`, `predicate_iri`, `predicate_compact_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle` | Provenance fields added (1B) |
| `TraversalOptions` | Frozen dataclass | `direction`, `relations`, `max_depth`, `node_limit`, `edge_limit`, `cursor`, `include_inferred`, `timeout_ms` | Pre-existing, refined |
| `SearchOptions` | Frozen dataclass | `query`, `limit`, `offset`, `kinds`, `require_description` | New (1B) |
| `SearchResult` | Frozen dataclass | `entities`, `total_matches` | New (1B) |
| `PathOptions` | Frozen dataclass | `direction`, `relations`, `max_depth`, `visited_node_limit`, `include_inferred`, `timeout_ms` | New (1E) |
| `PathRequest` | Frozen dataclass | `source_id`, `target_id`, `options` | New (1E) |
| `PathResult` | Frozen dataclass | `status`, `path`, `visited_nodes` | New (1E) |
| `GraphPath` | Frozen dataclass | `entities`, `relations` | New (1E) |
| `ComparisonResult` | Frozen dataclass | `common_types`, `unique_types_a/b`, `common_properties`, `unique_properties_a/b`, `shared_neighbors` | New (1E) |
| `PageInfo` | Frozen dataclass | `truncated`, `next_cursor` | Pre-existing |
| `GraphExpansion` | Frozen dataclass | `center`, `nodes`, `relationships`, `page_info` | Pre-existing |
| `PreviewGroup` | Frozen dataclass | `relation`, `direction`, `count` | New (1B) |
| `ExpansionPreview` | Frozen dataclass | `entity_id`, `total_count`, `groups` | New (1B) |

### 4.2 Semantic Models (`domain/semantic_models.py`) — NEW in Sprint 1

| Type | Kind | Key Fields |
|---|---|---|
| `SemanticKind` | Literal type | 12 values: `OWL_CLASS`, `NAMED_INDIVIDUAL`, `OBJECT_PROPERTY`, `DATATYPE_PROPERTY`, `ANNOTATION_PROPERTY`, `RDF_PROPERTY`, `LITERAL`, `ANONYMOUS_EXPRESSION`, `AXIOM`, `ONTOLOGY`, `DATATYPE`, `UNKNOWN` |
| `CompactIRI` | Frozen dataclass | `full_iri`, `prefix`, `local_name`, `namespace` + `parse()` classmethod |
| `TypedValue` | Frozen dataclass | `lexical_form`, `datatype_iri`, `language`, `normalized_value` |
| `MultilingualLabel` | Frozen dataclass | `value`, `language`, `datatype`, `predicate_iri` |
| `Annotation` | Frozen dataclass | `predicate_iri`, `value`, `language` |
| `SourceProvenance` | Frozen dataclass | `source_graph`, `build_id`, `is_inferred` |
| `ResourceMetadata` | Frozen dataclass | `iri`, `compact_iri`, `semantic_kind`, `asserted_types`, `inferred_types`, `labels`, `preferred_label`, `descriptions`, `aliases`, `annotations`, `source_graphs`, `build_id` |
| `ClassInfo` | Frozen dataclass | `iri`, `compact_iri`, `label`, `direct_parents`, `all_ancestors`, `direct_children`, `all_descendants`, `equivalent_classes`, `disjoint_classes`, `instance_count`, `annotations`, `restrictions` |
| `PropertyInfo` | Frozen dataclass | `iri`, `compact_iri`, `label`, `property_kind`, `domains`, `ranges`, `inverse_of`, `equivalent_properties`, `sub_properties`, `super_properties`, `characteristics`, `usage_count`, `annotations` |

### 4.3 Ports (`domain/ports.py`)

#### `GraphRepository` (Protocol)
```python
async def get_entity(entity_id: str) -> GraphEntity | None
async def search_entities(query: str, limit: int = 250) -> list[GraphEntity]
async def search(options: SearchOptions) -> SearchResult                      # NEW (1B)
async def get_neighbors(entity_id: str) -> list[GraphEntity]
async def get_expansion_preview(entity_id: str) -> ExpansionPreview           # NEW (1B)
async def get_relationships(entity_id, options, ...) -> list[GraphRelationship]
async def expand_graph(entity_id, options, deadline=None) -> GraphExpansion    # deadline (1F)
async def expand(entity_id, relation, deadline=None) -> list[GraphEntity]     # deprecated
async def find_shortest_path(source_id, target_id, options, deadline) -> PathResult  # NEW (1E)
async def compare_entities(id_a, id_b, deadline=None) -> ComparisonResult     # NEW (1E)
```

#### `SemanticRepository` (Protocol) — NEW in Sprint 1
```python
async def get_resource_metadata(iri: str) -> ResourceMetadata | None
async def get_class_info(class_iri: str) -> ClassInfo | None
async def get_property_info(property_iri: str) -> PropertyInfo | None
async def list_classes(limit: int = 100, offset: int = 0) -> list[ClassInfo]
async def list_properties(limit: int = 100, offset: int = 0) -> list[PropertyInfo]
```

### 4.4 Traversal (`domain/traversal.py`) — NEW in Sprint 1

- `paginate_relationships()` — Deterministic sort, deduplication, bounded pagination
- `encode_cursor()` / `decode_cursor_offset()` — URL-safe Base64, version-tagged, SHA-256 fingerprint-validated
- `CURSOR_VERSION = 1` — Versioned for future migration

---

## 5. Service Layer (`services/`)

### 5.1 GraphService (`services/graph_service.py`)

The primary domain facade. Orchestrates repository calls, enforces profile-driven limits, validates entities, and provides backward-compatible deprecated Wine shims.

**Key Methods:**

| Method | Status | Notes |
|---|---|---|
| `get_active_profile()` | ✅ | Returns `OntologyPackage` |
| `get_entity(id)` | ✅ | Raises `EntityNotFoundError` |
| `search_entities(query)` | ✅ | Trims whitespace |
| `search(options)` | ✅ NEW | Clamped to profile limits |
| `get_neighbors(id)` | ✅ | Validates existence |
| `get_expansion_preview(id)` | ✅ NEW | Validates existence |
| `get_relationships(id)` | ✅ | Validates existence |
| `expand_graph(id, options, deadline)` | ✅ | Profile normalization, deadline |
| `find_path(a, b, options, deadline)` | ✅ NEW | Both entities validated |
| `compare_entities(a, b, deadline)` | ✅ NEW | Both entities validated |
| `expand(id, relation, deadline)` | ⚠️ Deprecated | — |
| `get_wine(id)` | ⚠️ Deprecated | Asserts `kind == "Wine"` |
| `get_wines_by_region(id)` | ⚠️ Deprecated | Shim over traversal |
| `get_wines_by_grape(id)` | ⚠️ Deprecated | Shim over traversal |

**`GraphServiceLimits`** — Frozen dataclass (`max_depth`, `max_nodes`, `max_edges`) loaded from profile via `from_profile()`.

**`_normalize_traversal()`** — Validates positive limits, clamps to profile maximums, validates relations against `traversable_predicates`.

### 5.2 Exceptions (`services/exceptions.py`)

| Type | Code | Introduced |
|---|---|---|
| `GraphServiceError` | `INTERNAL_ERROR` (default) | Base exception |
| `EntityNotFoundError` | `NOT_FOUND` | Entity lookup failures |
| `InvalidTraversalError` | `INVALID_ARGUMENT` | Bad traversal parameters |
| `GraphBackendError` | `INTERNAL_ERROR` | Backend initialization failures |

**`GraphQLErrorCode` Enum:** `NOT_FOUND`, `INVALID_CURSOR`, `BUDGET_EXHAUSTED`, `INTERNAL_ERROR`, `INVALID_ARGUMENT`

### 5.3 Repository Factory (`services/repository_factory.py`)

```python
create_graph_repository(profile, client=None) -> GraphRepository
```
- `GRAPH_BACKEND=oxigraph` (default) → `OxigraphGraphRepository(profile=profile)`
- `GRAPH_BACKEND=graphdb` → `GraphRetrievalService(...)` (legacy rollback)
- Unknown → `GraphBackendError`

---

## 6. Adapter Layer (`adapters/`)

### 6.1 OxigraphGraphRepository (`adapters/oxigraph/repository.py`)

Implements `GraphRepository` protocol backed by an embedded read-only PyOxigraph store.

**Key Implementation Details:**
- All blocking PyOxigraph I/O dispatched via `asyncio.to_thread()`
- Dynamic IRI resolution against profile prefixes (`_resolve_iri()`)
- Dynamic kind classification against profile categories (`_kind_for()`)
- Multilingual label resolution matching profile language preferences (`_label_for()`)
- Profile-driven description extraction (`_description_for()`)
- Bounded SPARQL search over `searchable_classes` with case-insensitive matching
- Expansion preview: Aggregates quad counts per traversable predicate without materializing entities
- Relationship provenance: SHA-256 relationship ID, predicate compact IRI, `is_inferred` flag (checks `INFERRED_GRAPH`), `source_graph` named graph
- BFS shortest-path: Python-side iterative BFS over `quads_for_pattern` with `max_depth`, `visited_node_limit`, and `deadline` enforcement
- Entity comparison: Python-side set intersections for types, properties, and shared neighbors with deadline checks
- Deadline enforcement: `time.monotonic() > deadline` checks in tight iteration loops

### 6.2 OxigraphSemanticRepository (`adapters/oxigraph/semantic_repository.py`) — NEW

Implements `SemanticRepository` protocol for ontology schema introspection.

**Methods:**
- `get_resource_metadata(iri)` — IRI existence, multilingual labels, types, compact IRIs
- `get_class_info(class_iri)` — Direct/all parents and children, equivalent/disjoint classes, instance count, annotations
- `get_property_info(property_iri)` — Domain, range, inverse, equivalent, sub/super properties, characteristics, usage count
- `list_classes(limit, offset)` — Discovers all `owl:Class` subjects, paginated
- `list_properties(limit, offset)` — Discovers `owl:ObjectProperty` and `owl:DatatypeProperty`, paginated

### 6.3 Legacy GraphDB Adapter (`services/graph_retrieval.py`)

- Still present for rollback/parity verification (`GRAPH_BACKEND=graphdb`)
- Uses `httpx.AsyncClient` to communicate with Ontotext GraphDB via SPARQL
- **NOT the default.** Oxigraph is the production backend.
- Scheduled for archival in Sprint 4 after soak criteria pass.

---

## 7. Ingestion Pipeline (`ingestion/`)

### 7.1 Build Pipeline (`ingestion/build_store.py`)

```
build_store(manifest_path, output_root, force=False, dry_run=False) -> StoreBuildResult
```

1. Loads YAML manifest → `RDFSourceManifest`
2. Resolves sources (relative paths, SHA-256 hashing) → `ResolvedRDFSource`
3. Resolves imports (vendored, allowlisted, checksummed) → `ResolvedImport`
4. Calculates deterministic `build_id` (20-char hex)
5. **Build reuse check:** If build directory exists and `not force`, reuses and promotes
6. **Staging:** Builds in temp directory (`.data/oxigraph/builds/.<build_id>.<uuid>.tmp`)
7. **Security:** `validate_source_path()`, `validate_file_size()`, `safe_parse_rdf()` for each source and import
8. **Reasoning:** `materialize_semantics(store, profile)` → inferred triples in `urn:fkg:graph:inferred`
9. **Optimization:** `store.optimize()` + `store.flush()` + `gc.collect()`
10. **Metadata:** Writes `store-manifest.json` (timestamps, checksums, triple counts)
11. **Atomic swap:** `_replace_build_directory()` → `_promote()` via `_write_json_atomic()`
12. **Failure cleanup:** Temp directory removed, sensitive paths masked in errors

### 7.2 Manifest (`ingestion/manifest.py`)

- `RDFSource` — Path, format (7 supported), target graph
- `ImportPolicy` — Mode, allowlist, vendor_dir, local_mappings, checksums
- `RDFSourceManifest` — Version, sources (min 1), imports, reasoning_profile
- `ResolvedRDFSource` — Resolved path, SHA-256, manifest_path, format, graph
- `calculate_build_id()` — Deterministic SHA-256 over manifest + source hashes + import hashes

### 7.3 Security (`ingestion/security.py`)

| Function | Protection |
|---|---|
| `validate_source_path(path, allowed_roots)` | Path traversal, symlink escapes, unwhitelisted dirs |
| `validate_file_size(path, max_bytes=50MB)` | Memory exhaustion, billion-laughs |
| `safe_parse_rdf(path, format, store, graph)` | XXE, entity expansion (uses PyOxigraph Rust parser) |

Custom exceptions: `PathTraversalError`, `FileSizeLimitError`, `ParserSecurityError`

### 7.4 Import Resolution (`ingestion/imports.py`)

- `ImportResolver` — BFS recursive import discovery from source RDF files
- Extracts `owl:imports` statements and ontology IRIs from parsed triples
- Validates against `ImportPolicy.allowlist`
- Resolves local vendored files via `ImportPolicy.local_mappings`
- Verifies SHA-256 checksums against `ImportPolicy.checksums`
- Assigns import-specific named graphs (`urn:fkg:graph:imports:<hash[:12]>`)
- **Zero network access** — all imports must be vendored locally

### 7.5 Reasoning (`ingestion/reasoning.py`)

Dispatches reasoning by profile name:

| Profile | Engine | Description |
|---|---|---|
| `none` | — | Returns 0 inferred triples |
| `rdfs-wine-parity` | In-process Python | Transitive subClassOf, intersectionOf, inverse, symmetric closures |
| `hermit` | Subprocess (HermiT via owlready2) | Full OWL 2 DL classification + realization |

**HermiT Provider (`ingestion/reasoners/hermit_provider.py`):**
- Spawns isolated subprocess (`_hermit_worker.py`)
- Resource limits: configurable timeout (default 600s), memory (default 2048MB)
- Worker uses `owlready2.sync_reasoner()` with `infer_property_values=True`
- Detects unsatisfiable classes (subclasses of `owl:Nothing`)
- Inconsistency detection halts build with `ValueError`
- Explanation generation: returns `None` → `EXPLANATION_UNAVAILABLE`

**ReasoningProvider Protocol (`ingestion/reasoners/provider.py`):**
- `validate_compatibility(profile)` → `bool`
- `check_consistency(ontology_path)` → `ReasoningResult`
- `classify_and_materialize(ontology_path, output_path)` → `ReasoningResult`
- `explain_inference(handle)` → `ExplanationArtifact | None`

### 7.6 Store Lifecycle CLI (`ingestion/lifecycle.py`)

| Command | Action |
|---|---|
| `list` | Lists builds in `.data/oxigraph/builds/`, marks `ACTIVE` |
| `backup <build_id> <archive>` | Creates `.zip` or `.tar.gz` archive |
| `restore <archive>` | Unpacks into builds directory |
| `promote <build_id>` | Validates build, writes atomic `current.json` with `previous_build_id` |
| `rollback` | Reverts `current.json` to `previous_build_id` |

---

## 8. API Layer

### 8.1 GraphQL Schema (`api/graphql_schema.py`)

**Framework:** Strawberry GraphQL with `auto_camel_case=False`

#### Query Fields

| Field | Arguments | Returns | Status |
|---|---|---|---|
| `get_entity` | `id` | `Entity` | ✅ Generic |
| `search_entities` | `query` | `[Entity]` | ✅ Generic |
| `get_neighbors` | `id` | `[Entity]` | ✅ Generic |
| `get_relationships` | `id` | `[GraphRelationship]` | ✅ Generic |
| `expand_graph` | `id`, `options` | `GraphExpansion` | ✅ With cursors |
| `expand` | `id`, `relation` | `[Entity]` | ⚠️ Deprecated |
| `find_path` | `source_id`, `target_id` | `PathResult` | ✅ NEW (1E) |
| `compare` | `id_a`, `id_b` | `ComparisonResult` | ✅ NEW (1E) |
| `get_active_profile` | — | `ActiveProfile` | ✅ NEW (1A) |
| `get_wine` | `id` | `Wine` | ⚠️ Deprecated |

#### GraphQL Types

| Type | Status | Notes |
|---|---|---|
| `Entity` (interface) | ✅ | `id`, `label`, `description` |
| `OntologyEntity` | ✅ NEW | Extends `Entity` with `kind: str` |
| `Wine`, `Winery`, `Region`, `Grape` | ⚠️ Deprecated | Extend `Entity` |
| `GenericEntity` | ⚠️ Deprecated | For unknown kinds |
| `GraphRelationship` | 🔶 Partial | Has `source`, `target`, `relation` only — **missing provenance fields** |
| `ActiveProfile` | ✅ NEW | Metadata, prefixes, categories, predicates, limits, languages |
| `GraphExpansion` | ✅ | Center, nodes, relationships, page_info |
| `PathResult` | ✅ NEW | Status, path, visited_nodes |
| `ComparisonResult` | ✅ NEW | Common/unique types, properties, shared neighbors |
| `TraversalInput` | ✅ | Direction, relations, limits, cursor, include_inferred |

#### Entity Type Resolution (`_to_api_entity()`)

Maps domain `GraphEntity.kind` to GraphQL types:
- `"Wine"` → `Wine`, `"Winery"` → `Winery`, `"Region"` → `Region`, `"Grape"` → `Grape`
- `"Unknown"` → `GenericEntity`
- Any other kind → `OntologyEntity(kind=kind)`

### 8.2 GraphQL Safety (`api/security.py`)

**`GraphQLSafetyExtension`** (Strawberry `SchemaExtension`):

| Phase | Protection | Details |
|---|---|---|
| `on_operation` | Deadline + Role injection | Sets `deadline = monotonic() + 15s`, default `role = "operator"` |
| `on_validate` | Complexity limits | Max depth = 7, Max fields = 100. AST traversal handles aliases, fragments, inline fragments |
| `on_execute` | Execution timeout | 15-second `asyncio.timeout`. Raises `GraphQLError(code: TIMEOUT)` |

**Authorization:** `_graph_service(info)` rejects contexts where `role` is not `"operator"` or `"anonymous"`. Raises `GraphQLError(code: UNAUTHORIZED)`.

**Error Masking:** All resolvers catch `GraphServiceError` and emit safe messages. `INTERNAL_ERROR` is masked to `"The graph service is unavailable"`. Paths, stack traces, and SPARQL are never exposed.

### 8.3 REST Endpoints (`main.py`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness (no DB query) |
| `/health/readiness` | GET | Detailed readiness with build metadata, triple counts, consistency |
| `/graphql` | POST | Strawberry GraphQL (mounted via `GraphQLRouter`) |

### 8.4 CORS Configuration

```python
allow_origins = FRONTEND_ORIGINS env var (default: localhost:5173, 127.0.0.1:5173)
allow_methods = ["GET", "POST", "OPTIONS"]
allow_headers = ["Content-Type", "Authorization"]
allow_credentials = False
```

### 8.5 Telemetry (`core/telemetry.py`)

**`TelemetryMiddleware`** (Starlette `BaseHTTPMiddleware`):
- Structured JSON log per request: `operation`, `build_id`, `duration_ms`, `status_code`
- On error: adds `error` (exception type) and `stable_error_code`
- On 4xx: `BAD_REQUEST`; on 5xx: `INTERNAL_SERVER_ERROR`
- **Privacy-preserving:** No request bodies, response bodies, literals, or query text logged

---

## 9. Frontend Architecture

### 9.1 Technology Stack

| Component | Version |
|---|---|
| React | 19.2.7 |
| TypeScript | ~6.0.2 |
| Vite | 8.1.1 |
| Vitest | 4.1.10 |
| Cytoscape.js | 3.34.0 |
| @cosmos.gl/graph | 3.3.0 |
| graphql-request | 7.4.0 |
| @tanstack/react-query | 5.101.2 |
| ESLint | 10.6.0 |

### 9.2 Application Structure

```
frontend/src/
├── main.tsx              # Entry point (App mode vs Benchmark mode)
├── App.tsx               # Root workspace: search, expand, inspect, undo
├── App.css               # Styles
├── api/
│   └── graph.ts          # GraphQL client (OntologyDataProvider implementation)
├── graph/
│   ├── CytoscapeGraph.tsx  # DetailGraphRenderer (Cytoscape wrapper)
│   ├── state.ts            # Pure functional graph state engine
│   └── state.test.ts       # Graph state unit tests
├── interfaces/
│   ├── models.ts           # Shared TypeScript domain types
│   ├── renderers.ts        # DetailGraphRenderer, OverviewGraphRenderer, OntologyDataProvider
│   └── index.ts            # Re-exports
└── benchmark/
    ├── runRendererBenchmark.ts  # Headless benchmark runner
    ├── generateFixture.ts      # Deterministic fixture generator (typed arrays)
    ├── generateFixture.test.ts # Fixture tests
    └── glBenchShim.ts          # cosmos.gl gl-bench no-op shim
```

### 9.3 Graph State Engine (`frontend/src/graph/state.ts`)

**Pure functional, zero-dependency state management:**

- `ExplorerGraph` — `entities: Record<string, GraphEntity>`, `relationships: Record<string, GraphRelationship>`
- `DEFAULT_VISIBLE_LIMITS` — Hard client-side budget: **500 nodes, 1,000 edges**
- `mergeExpansion()` — Enforces node/edge limits, prevents dangling relationships, tracks additions in `ExpansionRecord`
- `collapseExpansion()` — Removes added edges, prunes orphan nodes while preserving shared multi-expansion neighbors
- `relationshipsForEntity()` — Incident edge lookup with deterministic sorting
- `relationshipKey()` — Canonical composite key: `source.id|relation|target.id`

### 9.4 CytoscapeGraph Component

**Props:** Implements `DetailGraphRenderer` interface with `graph`, `selectedId`, `categoryColors`, `onSelectEntity`

**Scale Safeguards:**
- Edge labels shown only when edges ≤ 200
- `hideEdgesOnViewport` when edges > 500
- `pixelRatio: 1` for stable rendering
- Layout animation only when nodes ≤ 200
- Dynamic category colors from profile (no hardcoded Wine colors)
- `breadthfirst` layout rooted on selected node

### 9.5 Renderer Contracts (`frontend/src/interfaces/renderers.ts`) — NEW

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

### 9.6 Benchmark Suite

- Headless benchmark via `?benchmark=1` URL parameter
- Tests Cytoscape vs cosmos.gl at configurable node/edge counts
- Measures generation, initialization, interaction, and heap memory
- Results exposed on `window.__GRAPH_BENCHMARK__`

---

## 10. CI/CD Pipeline (`.github/workflows/ci.yml`)

```yaml
Trigger: push/pull_request on main, sprint-1/*
Jobs:
  backend:
    runs-on: ubuntu-latest
    Python 3.12
    Steps: pip install → ruff check (continue-on-error) → pytest
  frontend:
    runs-on: ubuntu-latest
    Node 20
    Steps: npm ci → npm test → npm run build
```

---

## 11. Documentation Inventory

| Document | Path | Purpose |
|---|---|---|
| FKG Platform Expansion | `FKG.in_User_Interface_Platform_Expansion_Updated.md` | High-level system blueprint |
| LLM Brainstorming Spec | `docs/spec_LLM_brainstorming.md` | Ontology explorer feasibility & UX |
| Requirements | `docs/ontology-graph-explorer-requirements.md` | Formal specification (~55KB, 180+ requirements) |
| Implementation Plan | `docs/ontology-graph-explorer-implementation-plan.md` | 4-sprint delivery plan (~53KB) |
| Sprint 1 Agent Context | `docs/sprint-1-agent-context.md` | LLM agent implementation guide |
| Previous Status | `docs/project-status-2026-09-10.md` | Pre-Sprint 1 baseline |
| **Sprint 1 Report** | `docs/sprint-1-completion-report.md` | **NEW — Sprint 1 completion report** |
| **Current Status** | `docs/project-status-2026-09-14.md` | **NEW — This document** |
| Reasoner ADR | `docs/reasoner-adr.md` | HermiT selection decision record |
| Deployment Model | `docs/deployment-model.md` | Read-only API + offline writer topology |
| OWL Store Migration | `docs/owl-store-migration-*.md` | GraphDB → Oxigraph migration (3 docs) |
| Batch Reports | `docs/batch-reports/batch-1{a..h}-report.md` | 8 batch implementation reports |
| Renderer Benchmark | `benchmarks/` | Cytoscape vs cosmos.gl ADR |

---

## 12. Known Issues & Technical Debt

### 12.1 High Priority (Should Address Before/During Sprint 2)

| # | Issue | Impact | Recommendation |
|---|---|---|---|
| 1 | **Semantic Repository not wired into GraphQL.** `get_class_info`, `get_property_info`, `list_classes`, `list_properties`, `get_resource_metadata`, `search` (advanced), `get_expansion_preview` exist in backend but have no GraphQL resolvers. | **Sprint 2 blocker.** Frontend cannot build class/property inspector, schema browser, or expansion preview UI without these. | Add GraphQL resolvers before Sprint 2 UI work. |
| 2 | **GraphQL `GraphRelationship` lacks provenance fields.** Domain model has `predicate_iri`, `is_inferred`, `source_graph`, `explanation_handle` but GraphQL type only exposes `source`, `target`, `relation`. | Sprint 2 frontend cannot distinguish asserted vs. inferred, cannot show provenance. | Add fields to GraphQL type. |
| 3 | **`build_id` always `None` in `ActiveProfile`.** The GraphQL `get_active_profile` resolver hardcodes `build_id=None` instead of reading from `current.json`. | Frontend cannot display active build. Readiness endpoint has the data. | Wire `app.state.active_build_id` into the resolver context. |
| 4 | **5 of 16 required error codes implemented.** Missing: `TIMEOUT` (in extension but not enum), `FORBIDDEN`, `STORE_NOT_READY`, `CANCELLED`, `ONTOLOGY_INCONSISTENT`, `REASONER_UNAVAILABLE`, `EXPLANATION_UNAVAILABLE`, `UNSUPPORTED_SEMANTIC_CONSTRUCT`, `BACKEND_UNAVAILABLE`, `INVALID_PREDICATE`, `TRAVERSAL_LIMIT`, `PATH_BUDGET_EXHAUSTED`, `QUERY_TOO_COMPLEX`. | Frontend cannot handle all error states. Some are subsumed by existing codes. | Add remaining codes incrementally. |

### 12.2 Medium Priority

| # | Issue | Impact | Recommendation |
|---|---|---|---|
| 5 | **Readiness endpoint hardcodes `"consistency": "consistent"`.** Should read actual consistency status from build metadata. | Masks inconsistent ontology builds. | Read from `store-manifest.json`. |
| 6 | **Ruff lint `continue-on-error: true` in CI.** Linting failures do not block merges. | Code quality drift. | Make strict after cleanup. |
| 7 | **GraphDB adapter still imported in factory.** `httpx` dependency required even when using Oxigraph. | Unnecessary dependency. | Guard import, plan archival in Sprint 4. |
| 8 | **No `ONTOLOGY_PROFILE` env var test.** Profile loader supports env var override but it's untested. | Silent regression risk. | Add test. |
| 9 | **Profile loader uses relative path `config/wine-profile.yaml`.** Could break in containerized deployments. | Deployment fragility. | Resolve relative to project root or package. |

### 12.3 Low Priority / Sprint 4

| # | Issue | Impact | Recommendation |
|---|---|---|---|
| 10 | **Explanation generation stubbed.** Returns `EXPLANATION_UNAVAILABLE`. | "Why?" panel will show unavailable message. | Evaluate Openllet or custom justification in Sprint 4. |
| 11 | **No rate limiting.** GraphQL abuse protection has depth/field/timeout but no per-client rate limit. | DoS risk under load. | Add in Sprint 2 or 4. |
| 12 | **No response size limits.** Large expansions could produce oversized responses. | Memory risk. | Add response size cap. |
| 13 | **Validation model (SM-009) not formalized.** Build metadata has reasoning outcomes but no structured `ValidationFinding` objects. | Inspector cannot show structured findings. | Formalize in Sprint 2. |
| 14 | **Scale tier definitions not codified.** S/M/L/XL tiers documented in requirements but not in configuration or benchmarks. | No performance validation. | Formalize in Sprint 4. |
| 15 | **Frontend benchmark chunk >500KB.** `runRendererBenchmark` bundle triggers Vite advisory. | Non-blocking. | Code-split benchmark into dynamic import. |

---

## 13. Performance Reference

### Pre-Sprint 1 Benchmarks (from `project-status-2026-09-10.md`)

Warm local medians, Wine ontology (~2,384 triples):

| Operation | GraphDB | PyOxigraph | Speedup |
|---|---|---|---|
| Entity lookup | 31.7 ms | **0.5 ms** | 63× |
| Relationship lookup | 33.4 ms | **1.1 ms** | 30× |
| Search | 13.7 ms | **2.3 ms** | 6× |
| Expansion | 67.1 ms | **0.6 ms** | 112× |
| Path finding | 183.6 ms | **1.3 ms** | 141× |

> **Note:** These benchmarks predate Sprint 1 modifications. Sprint 1 added deadline checks in tight loops which may add marginal overhead. Re-benchmark recommended for Sprint 2.

---

## 14. Phase Completion Matrix

| Phase | Description | Status | Notes |
|---|---|---|---|
| Phase 0 | Baseline | ✅ Complete | — |
| Phase 1 | Repository port | ✅ Complete | `GraphRepository` protocol |
| Phase 2 | Oxigraph ingestion | ✅ Complete | Imports, security, vendoring |
| Phase 3 | Semantic profile | ✅ Complete | OntologyPackage, Wine + Pizza profiles |
| Phase 4 | Oxigraph repository | ✅ Complete | Native BFS paths, comparison, preview |
| Phase 5 | Bounded GraphQL | ✅ Complete | Depth/field limits, timeout, auth |
| Phase 6 | Parity & performance | ✅ Prototype gate | Heavy concurrency testing deferred |
| Phase 7 | Oxigraph default | ✅ Complete | Default backend, GraphDB rollback available |
| Phase 8 | Explorer hardening | ✅ Complete | Scale safeguards, budget limits |
| Phase 9 | Renderer decision | ✅ Complete | ADR 0001 (Cytoscape detail + cosmos.gl overview) |
| Phase 10 | Remove GraphDB | 🔲 Not started | Deferred to Sprint 4 |
| Phase 11 | Production release | 🔲 Not started | Requires Sprint 2 + 4 |

---

## 15. Sprint Roadmap

### Sprint 1: Core Platform ✅ COMPLETE (current)
All 8 batches delivered. 104 backend + 6 frontend tests passing. See `sprint-1-completion-report.md`.

### Sprint 2: Supported Cytoscape & cosmos.gl Application (NEXT)
**Goal:** Production-supported ontology explorer with complete semantic workflows, accessible alternatives, and GPU overview.

**Key Workstreams:**
1. Metadata-driven navigation shell (class tree, property browser, command palette)
2. Semantic inspector panels (resource, class, property, provenance)
3. Cytoscape detail improvements (profile-driven styling, supernode previews, undo/collapse)
4. Accessible textual views (visible-graph table, hierarchy trees, WCAG 2.1 AA)
5. Path finder, comparison, and explanation UI
6. Session save/restore with build compatibility
7. cosmos.gl production overview renderer with GPU fallback
8. Playwright E2E testing

**Prerequisites (from Sprint 1 gaps):**
- Wire SemanticRepository operations into GraphQL resolvers
- Expose relationship provenance in GraphQL schema
- Wire `build_id` into ActiveProfile
- Complete error code enum

### Sprint 3: Ontodia Prototype
**Goal:** Evidence-based accept/reject decision for Ontodia diagramming prototype. Separate, isolated build.

### Sprint 4: Nice-to-Have & Non-Functional
**Goal:** Research productivity (history, bookmarks, exports), caching, soak testing, GraphDB removal, SLO formalization.

---

## 16. Risk Register (Post-Sprint 1)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Semantic Repository GraphQL gap blocks Sprint 2.** Backend operations exist but are not exposed via GraphQL. | HIGH | Wire resolvers before Sprint 2 UI begins. |
| 2 | **Explanation permanently unavailable.** HermiT via owlready2 lacks justification support. | MEDIUM | Conformant via RS-011. Evaluate Openllet in Sprint 4. |
| 3 | **Single-process embedded RocksDB.** Multi-process write access not verified. | MEDIUM | Enforced single-writer topology; documented in deployment model. |
| 4 | **cosmos.gl production integration untested.** Only benchmark route exists. | MEDIUM | Sprint 2 workstream with GPU fallback. |
| 5 | **GraphDB dependency still in codebase.** `httpx` imported in factory. | LOW | Guard import; archival in Sprint 4. |
| 6 | **No Playwright/E2E browser tests.** Only unit tests exist for frontend. | MEDIUM | Sprint 2 delivers Playwright suite. |
| 7 | **Rate limiting absent.** No per-client request throttling. | LOW | Acceptable for single-user; add before multi-user deployment. |
| 8 | **CI does not enforce lint.** Ruff runs with `continue-on-error`. | LOW | Make strict after codebase cleanup. |
| 9 | **Benchmark numbers are warm single-user.** Production concurrency not measured. | MEDIUM | Sprint 4 soak and capacity testing. |
| 10 | **Frontend bundle size advisory.** Benchmark chunk exceeds 500KB. | LOW | Code-split benchmark via dynamic import. |
