# Food Knowledge Graph Prototype: Current Project Status

- **Snapshot date:** 2026-09-10
- **Migration branch:** `feat/owl-store-migration`
- **Snapshot commit:** `2e543f4 docs(architecture): adopt dual graph renderers`
- **Default graph backend:** PyOxigraph
- **Migration status:** Functional prototype; production hardening remains

## 1. Executive Summary

The prototype now implements the intended three-layer graph architecture and a
standalone Graph Explorer:

```text
Standalone Graph Explorer
          |
Public Strawberry GraphQL API
          |
      GraphService
          |
   GraphRepository port
      /           \
 PyOxigraph     GraphDB
  (default)     (parity/rollback)
```

The original GraphDB-specific runtime has been replaced as the default by a
persistent embedded PyOxigraph store built from RDF/OWL source files. GraphDB is
still present as a temporary parity and rollback adapter.

The application can ingest the Wine RDF/XML ontology and supplemental Turtle
labels, materialize the configured Wine semantic profile, serve the existing
GraphQL API without GraphDB, and support bounded graph exploration in the React
frontend.

The migration is not complete. The largest remaining areas are ontology import
handling, broader OWL semantics, GraphQL abuse protection, repository-native
bounded path traversal, operational store lifecycle tooling, production GPU
overview implementation, CI/deployment, and final GraphDB removal.

## 2. Current Verification State

The following checks passed on this snapshot:

```text
Backend tests:         46 passed
Frontend tests:         6 passed
Frontend lint:          passed
Frontend build:         passed
Editor diagnostics:     none
```

The frontend build still reports a non-failing large-chunk advisory. The normal
application bundle and the dynamically loaded renderer benchmark dependencies
should be optimized in a later performance pass.

## 3. Active Embedded Store

The currently promoted PyOxigraph store has the following metadata:

```text
Build ID:               6bb84d8fa462e70b2e8b
Total triples:          2,384
Inferred triples:         397
Reasoning profile:      rdfs-wine-parity
```

Source inputs:

| Source | Format | Named graph |
| --- | --- | --- |
| `wine.rdf` | RDF/XML | `urn:fkg:graph:asserted` |
| `wine-labels.ttl` | Turtle | `urn:fkg:graph:labels` |

Generated stores are content-addressed under `.data/oxigraph/builds/` and are
excluded from Git. The active build is selected through
`.data/oxigraph/current.json`.

## 4. Completed Architecture Work

### 4.1 Database-neutral repository boundary

Completed:

- Added a `GraphRepository` protocol.
- Removed the direct GraphDB dependency from `GraphService`.
- Added repository construction through a backend factory.
- Kept storage-specific RDF, SPARQL, HTTP, and term handling below the service
  boundary.
- Preserved canonical relationship direction.
- Preserved asynchronous service APIs.

The UI, Strawberry schema, and Graph Service do not access GraphDB, PyOxigraph,
RDF files, or internal SPARQL directly.

### 4.2 Domain contracts

Implemented domain models include:

- `GraphEntity`
- `GraphRelationship`
- `GraphPath`
- `GraphExpansion`
- `PageInfo`
- `TraversalOptions`
- `PathOptions`
- `TraversalDirection`

These contracts are independent of the storage backend.

### 4.3 Backend selection

Current behavior:

```text
GRAPH_BACKEND=oxigraph    default embedded runtime
GRAPH_BACKEND=graphdb     explicit parity/rollback runtime
```

The backend factory is the only normal composition point that chooses a storage
adapter.

## 5. Completed RDF Ingestion Work

The project includes a reproducible ingestion pipeline with:

- Typed YAML source manifests.
- Explicit RDF format selection.
- Relative source path resolution.
- SHA-256 source checksums.
- Content-addressed build identifiers.
- Persistent RocksDB-backed PyOxigraph stores.
- Named graph loading.
- Bulk RDF loading.
- Store optimization and flushing.
- Build metadata generation.
- Temporary build directories.
- Atomic active-build promotion.
- Failed-build cleanup.
- Dry-run mode.
- Forced rebuild support.
- Reuse of unchanged builds.

Test coverage includes:

- RDF source loading.
- Missing-source rejection.
- Malformed RDF rejection.
- Source-change build IDs.
- Build reuse.
- Dry runs.
- Failed-build rollback.
- Reopening a promoted store.
- Inferred-triple metadata.

## 6. Completed Semantic Materialization

The `rdfs-wine-parity` ingestion-time profile currently materializes:

- Named `rdfs:subClassOf` transitive closure.
- Named class members from `owl:intersectionOf` lists.
- Superclass types for individuals.
- Declared `owl:inverseOf` relationships.
- Symmetric-property reverse relationships.
- Inference provenance in `urn:fkg:graph:inferred`.

This allows an individual directly typed as `Sauternes`, for example, to be
returned through the application as a Wine.

Reasoning runs during store construction, never during an API request.

## 7. Completed Oxigraph Repository

The embedded repository currently supports:

- Indexed entity lookup by IRI.
- Language-aware label selection.
- Stable IRI-derived label fallback.
- Bounded case-insensitive label/identifier search.
- Incoming relationship retrieval.
- Outgoing relationship retrieval.
- Bidirectional relationship retrieval.
- Predicate filtering.
- Asserted/inferred filtering.
- Canonical relationship deduplication.
- Bounded cursor-based graph expansion.
- Wine-by-Region compatibility helper.
- Wine-by-Grape compatibility helper.
- Offloading blocking store work from the asyncio event loop.

The public API can run end to end with GraphDB stopped, provided a promoted
Oxigraph store exists.

## 8. Completed GraphQL And Service Work

Public GraphQL currently exposes:

- `get_wine`
- `get_entity`
- `search_entities`
- `get_neighbors`
- `get_relationships`
- Legacy `expand`
- Bounded `expand_graph`

Bounded expansion includes:

- Incoming, outgoing, or both directions.
- Predicate filters.
- Include/exclude inferred data.
- Node limits.
- Edge limits.
- Opaque continuation cursors.
- Truncation state.
- Next-cursor metadata.

Current service limits:

```text
Maximum expansion depth:    1 hop
Maximum requested nodes:    2,000
Maximum requested edges:    4,000
```

Cursor protections include:

- Versioning.
- Traversal fingerprints.
- Entity binding.
- Direction/filter binding.
- Tamper and malformed-cursor rejection.

Stable errors currently cover missing entities, invalid traversal input, and
backend failures.

## 9. Backend Parity Status

GraphDB and PyOxigraph were compared using normalized domain results rather than
transport-specific JSON.

Current result:

```text
Exact matches:             12 of 14
Accepted differences:       2
Unresolved differences:     0
```

Accepted differences:

1. PyOxigraph exposes an explicitly asserted `Region locatedIn` edge that the
   generated GraphDB Region type omitted.
2. PyOxigraph search includes valid Wine subclass instances through configured
   type closure that the generated GraphDB `wine` root omitted.

These are documented completeness improvements, not unresolved regressions.

Representative warm local medians:

| Operation | GraphDB | PyOxigraph |
| --- | ---: | ---: |
| Entity lookup | 31.7 ms | 0.5 ms |
| Relationship lookup | 33.4 ms | 1.1 ms |
| Search | 13.7 ms | 2.3 ms |
| Expansion | 67.1 ms | 0.6 ms |
| Path | 183.6 ms | 1.3 ms |

See [GraphDB and Oxigraph parity](benchmarks/owl-store-parity.md).

## 10. Completed Graph Explorer Work

The standalone React Graph Explorer currently provides:

- Entity search through the public GraphQL API.
- Cytoscape graph rendering.
- Node type colors.
- Directed, labelled edges.
- Node selection and detail inspection.
- Incoming/outgoing/both traversal controls.
- Relationship-type filters.
- Asserted/inferred relationship control.
- Cursor continuation.
- Truncation notices.
- Undo-last-expansion.
- Reset and fit controls.
- An accessible relationship table synchronized with graph selection.
- Desktop and mobile layouts.

The frontend does not query RDF files, PyOxigraph, GraphDB, or Typesense
directly.

## 11. Explorer Scale Safeguards

Renderer-neutral graph state enforces:

```text
Maximum visible nodes:       500
Maximum visible edges:     1,000
```

Additional rendering safeguards:

- Prevent dangling edges when a node is rejected by the budget.
- Deduplicate nodes and edges.
- Retain nodes still referenced by later expansions during undo.
- Hide labels below zoom thresholds.
- Disable edge labels above 200 visible edges.
- Disable layout animation above 200 visible nodes.
- Hide edges during viewport interaction above 500 visible edges.
- Use pixel ratio `1` for predictable large-view cost.

## 12. Renderer Decision

Cytoscape.js and cosmos.gl were benchmarked at:

- 1,000 nodes / 2,000 edges.
- 10,000 nodes / 20,000 edges.
- 50,000 nodes / 100,000 edges.
- 100,000 nodes / 200,000 edges.

At 100,000 nodes and 200,000 edges:

```text
Cytoscape initialization:  10,288 ms
cosmos.gl initialization:      80 ms
```

Accepted decision:

- Use Cytoscape for rich bounded detail views.
- Use cosmos.gl for a future aggregated or sampled overview.
- Keep the relationship table as the renderer-independent accessible view.
- Never send either renderer an unbounded graph dump.

cosmos.gl currently exists only in the benchmark route. It is dynamically
loaded and does not run in the normal Graph Explorer.

See [renderer benchmark](benchmarks/renderer-benchmark.md) and
[ADR 0001](adr/0001-dual-graph-renderer.md).

## 13. Partially Completed Work

### 13.1 Ontology imports

The Wine ontology declares an `owl:imports` dependency on the Food ontology.
The source manifest currently disables import resolution.

Remaining:

- Vendor the exact imported Food ontology.
- Pin its checksum/version.
- Implement allowlisted import resolution.
- Load imports into a dedicated named graph.
- Test missing, changed, and forbidden imports.

### 13.2 Semantic profile

The current profile is an intentional Wine parity subset, not a full OWL
reasoner.

Remaining semantic decisions and implementations:

- `owl:hasValue` fact materialization.
- Anonymous restriction handling.
- Optional transitive `locatedIn` closure.
- Cardinality semantics or validation.
- Functional-property validation.
- Disjointness validation.
- Broader equivalent-class reasoning.
- OWL-RL/HermiT/Pellet evaluation if required.
- A dedicated semantic-profile ADR.

### 13.3 Path discovery

Current path finding uses bounded breadth-first search in `GraphService`.

Remaining:

- Repository-native batched frontier traversal.
- `visited_node_limit` enforcement.
- Distinguish no path from budget exhaustion.
- Direction and predicate filters.
- Public `find_path` GraphQL field.
- Path trace/provenance metadata.

### 13.4 GraphQL and API protection

Traversal budgets exist, but general API protection is incomplete.

Remaining:

- Query depth limits.
- Query complexity/cost analysis.
- Alias repetition protection.
- Resolver/request timeouts.
- Cancellation propagation.
- Rate limiting.
- Authentication.
- Authorization hooks.

### 13.5 Backend performance validation

Completed measurements are prototype-level warm local observations.

Remaining:

- Cold store-open measurements.
- Cold API startup measurements.
- Concurrency at 1, 10, and target service load.
- Medium and large RDF fixture benchmarks.
- Store growth measurements.
- Repeated statistical runs.

### 13.6 Explorer hardening

Remaining:

- Expansion preview/relation counts.
- High-degree aggregation and grouping.
- Collapse of arbitrary earlier expansions.
- Saved graph sessions.
- Keyboard navigation tests.
- Reduced-motion behavior and tests.
- Repeated expand/collapse memory tests.
- Automated browser end-to-end tests.
- Search pagination.

## 14. Not Yet Implemented

### 14.1 Production GPU overview

The production cosmos.gl overview requires:

- Server-side aggregate/sample GraphQL output.
- Cluster/community summaries.
- A bounded overview contract.
- A production cosmos.gl renderer adapter.
- GPU capability detection.
- Cytoscape/list fallback.
- Overview-to-detail transitions.
- Sampled labels and hover details.
- Accessible overview summaries.
- Mobile and low-power GPU validation.

### 14.2 Final GraphDB removal

GraphDB is no longer the default, but remains for parity and rollback.

Removal still requires:

- An agreed Oxigraph soak period.
- Store-version rollback replacing GraphDB rollback.
- Archived parity evidence.
- Removal of GraphDB adapter construction.
- Removal of GraphDB environment variables.
- Removal of HTTPX if no other service needs it.
- Archival/removal of GraphDB endpoint schemas.
- Clean-machine verification without GraphDB installed.

### 14.3 Operational hardening

Remaining production operations include:

- List store builds.
- Verify store integrity.
- Backup a store build.
- Restore a store build.
- Promote and roll back builds.
- Readiness metadata with build and semantic information.
- Structured logging.
- Metrics and tracing.
- Multi-process access validation.
- Corruption recovery.
- CI workflows.
- Deployment configuration.
- Dependency and license review.
- Security review.
- Release and rollback runbooks.

### 14.4 Larger platform integration

Not yet part of this prototype:

- Typesense search adapter and `EntitySearchPort`.
- Existing Search Interface component extraction.
- Entity linking.
- Intent parsing integration.
- Food-domain entity types such as Recipe, Ingredient, Nutrient, and Compound.
- Shared frontend component package.
- Cross-application authentication and authorization.

## 15. Migration Phase Status

| Phase | Status |
| --- | --- |
| 0. Baseline | Mostly complete |
| 1. Repository port | Complete |
| 2. Oxigraph ingestion | Mostly complete; imports missing |
| 3. Semantic profile | Partial Wine parity profile implemented |
| 4. Oxigraph repository | Mostly complete; repository-native paths missing |
| 5. Bounded service/GraphQL | Partial; complexity and timeouts missing |
| 6. Parity and performance | Prototype gate passed; broader load tests missing |
| 7. Oxigraph default | Implemented; soak and rollback exercise pending |
| 8. Explorer hardening | Mostly complete |
| 9. Renderer decision | Complete |
| 10. Remove GraphDB | Not started |
| 11. Operational release | Not started |

## 16. Current Risks

1. The semantic profile is Wine-specific rather than general OWL support.
2. `owl:imports` is disabled, so imported ontology semantics may be incomplete.
3. GraphQL complexity, timeout, rate-limit, and authorization controls are
   absent.
4. Store restore and rollback commands are not implemented.
5. The GPU overview is benchmark-only.
6. Path BFS may create many repository calls on a larger graph.
7. The frontend build reports a large-chunk warning.
8. Performance evidence comes from local prototype measurements.
9. Multi-process embedded-store behavior has not been production-tested.
10. CI does not enforce current test and build gates.

## 17. Recommended Next Sequence

1. Implement store lifecycle operations: list, verify, backup, promote, and
   rollback.
2. Add readiness metadata for active build ID, manifest hashes, triple counts,
   and reasoning profile.
3. Add GraphQL complexity, timeout, and complete stable error controls.
4. Vendor and allowlist the Food ontology import.
5. Define the broader semantic profile in an ADR.
6. Implement repository-native bounded path traversal and budget exhaustion.
7. Add automated browser end-to-end coverage.
8. Add server-side aggregate/sample contracts for GPU overview mode.
9. Implement the production cosmos.gl overview with capability fallback.
10. Complete soak, rollback, security, CI, and deployment validation.
11. Remove the GraphDB runtime only after those gates pass.

## 18. Important Project Documents

- [Migration analysis](owl-store-migration-analysis.md)
- [Migration requirements](owl-store-migration-requirements.md)
- [Implementation plan](owl-store-migration-implementation-plan.md)
- [Backend parity report](benchmarks/owl-store-parity.md)
- [Renderer benchmark](benchmarks/renderer-benchmark.md)
- [Dual-renderer ADR](adr/0001-dual-graph-renderer.md)

## 19. Repository Snapshot Notes

At the time this document was created, the tracked worktree was clean before
adding this file. The following unrelated files were untracked and were not
included or modified as part of this status documentation:

```text
FKG.in_User_Interface_Platform_Expansion_Updated.md
api.ps1
pizza.owl
```