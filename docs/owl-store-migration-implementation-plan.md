# OWL Store Migration Implementation Plan

- **Status:** Ready for execution
- **Branch:** `feat/owl-store-migration`
- **Related documents:**

- [Migration analysis](owl-store-migration-analysis.md)
- [Specification and requirements](owl-store-migration-requirements.md)

## 1. How to Use This Plan

Execute phases in order. Do not remove the GraphDB adapter until the parity,
GraphDB-free end-to-end, and rollback gates pass. Each phase has:

- Preconditions.
- Implementation tasks.
- Required tests.
- Deliverables.
- An exit gate.

Keep commits small and conventional. Core implementation files should normally
be committed separately from tests and generated fixtures.

## 2. Target Project Structure

The migration should converge on this structure without forcing an immediate
large rename:

```text
api/
  graphql_schema.py
domain/
  models.py
  ports.py
  traversal.py
services/
  graph_service.py
  exceptions.py
adapters/
  graphdb/
    repository.py
  oxigraph/
    repository.py
    queries.py
    terms.py
ingestion/
  build_store.py
  manifest.py
  reasoning.py
  validation.py
config/
  rdf-sources.example.yaml
scripts/
  generate_wine_labels.py
tests/
  contract/
  fixtures/
  integration/
  e2e/
benchmarks/
  store_queries.py
  generate_graph_fixture.py
  frontend/
frontend/
  src/
    graph/
      renderer.ts
      cytoscape-renderer.tsx
      graph-state.ts
docs/
```

Package movement should be incremental. Avoid changing import paths and backend
behavior in the same commit when possible.

## 3. Phase Overview

| Phase | Outcome | GraphDB still available? |
| --- | --- | --- |
| 0 | Baseline frozen and measurable | Required |
| 1 | Repository port introduced | Required |
| 2 | Reproducible embedded store ingestion | Required for parity |
| 3 | Semantic profile materialized | Required for parity |
| 4 | Oxigraph repository feature complete | Required for parity |
| 5 | Service and GraphQL bounded contracts | Optional runtime switch |
| 6 | Contract and parity verification | Required as reference |
| 7 | Runtime defaults to Oxigraph | Rollback adapter retained |
| 8 | Graph Explorer scale safeguards | Not required |
| 9 | Renderer benchmark and decision | Not required |
| 10 | GraphDB runtime removal and cleanup | Removed after gate |
| 11 | Operational hardening and release | Removed |

## 4. Phase 0: Freeze the Baseline

### Preconditions

- `main` is green and the Wine explorer works against `wine-v2`.
- The migration branch is current with `main`.
- GraphDB and its Wine endpoint are available for fixture capture.

### Tasks

1. Record Python, Node, GraphDB, and endpoint schema versions.
2. Add test dependencies:
   - `pytest`
   - `pytest-asyncio`
   - `pytest-cov`
   - `respx` or HTTPX mock equivalent
3. Add backend smoke tests for:
   - Health endpoint.
   - Strawberry schema creation.
   - `get_entity`.
   - Search.
   - Incoming and outgoing relationships.
   - Expansion.
   - Path discovery.
4. Capture normalized GraphDB golden fixtures for representative entities:
   - `ChateauDYchemSauterne`.
   - `ChateauDYchem`.
   - `SauvignonBlancGrape`.
   - `SauterneRegion`.
   - A disconnected or missing IRI.
5. Record current frontend build, browser workflow, and bundle size.
6. Add a script that normalizes fixture ordering and removes transport-only
   fields before comparison.

### Required tests

```powershell
.\.venv\Scripts\python.exe -m pytest
Set-Location frontend
npm run lint
npm run build
```

### Deliverables

- Baseline test suite.
- Frozen GraphDB golden fixtures.
- Version manifest.
- Baseline latency and bundle-size report.

### Exit gate

Existing behavior is executable without manual GraphQL Playground steps, and
fixtures are stable across two consecutive runs.

### Suggested commits

```text
test(api): add GraphQL baseline coverage
test(retrieval): capture GraphDB parity fixtures
chore(repo): add test dependencies
```

## 5. Phase 1: Introduce the Repository Port

### Preconditions

- Phase 0 passes.

### Tasks

1. Add `GraphRepository` to `domain/ports.py` using only domain types.
2. Add immutable option types:
   - `TraversalDirection`.
   - `TraversalOptions`.
   - `PathOptions`.
   - `GraphExpansion`.
   - `PageInfo` or cursor metadata.
3. Rename the current concrete implementation conceptually to
   `GraphDBGraphRepository` without changing behavior.
4. Make `GraphService` accept `GraphRepository` rather than the concrete
   GraphDB class.
5. Add a repository factory selected by `GRAPH_BACKEND`.
6. Keep `GRAPH_BACKEND=graphdb` as the temporary default.
7. Add repository contract tests backed by an in-memory fake adapter.

### Design constraints

- The protocol must not expose SPARQL, HTTPX, RDF terms, or GraphDB query
  documents.
- `GraphService` remains async.
- Canonical relationship direction remains a domain invariant.
- Existing GraphQL output must remain unchanged in this phase.

### Required tests

- Static type checking or editor diagnostics.
- Existing baseline suite against the GraphDB adapter.
- Contract suite against the fake adapter.
- Signature compatibility for current service callers.

### Deliverables

- Repository protocol.
- Traversal option/value objects.
- GraphDB adapter behind the port.
- Backend selection factory.

### Exit gate

No service or API file imports a concrete GraphDB repository class except the
composition root/factory.

### Suggested commits

```text
feat(domain): define graph repository port
refactor(retrieval): adapt GraphDB repository to port
refactor(service): inject graph repository protocol
feat(config): select graph backend adapter
```

## 6. Phase 2: Build Reproducible Oxigraph Ingestion

### Preconditions

- Repository protocol is stable.
- PyOxigraph version has been selected and pinned.

### Tasks

1. Add `pyoxigraph` as a backend dependency.
2. Add a typed source manifest format, for example:

   ```yaml
   version: 1
   sources:
     - path: wine.rdf
       format: rdf-xml
       graph: urn:fkg:graph:asserted
     - path: wine-labels.ttl
       format: turtle
       graph: urn:fkg:graph:labels
   imports:
     mode: vendored
     allowlist:
       - http://www.w3.org/TR/2003/PR-owl-guide-20031209/food
   reasoning_profile: rdfs-wine-parity
   ```

3. Vendor or explicitly map the imported Food ontology. Do not fetch imports
   from arbitrary URLs during API startup.
4. Implement SHA-256 source hashing.
5. Implement store building in a temporary versioned directory.
6. Use `bulk_load()` with explicit RDF format and destination named graph.
7. Validate parse success and expected minimum triple counts.
8. Flush and optimize the store.
9. Write `store-manifest.json` with source and build metadata.
10. Promote the build atomically through a pointer/current-build file or
    directory rename appropriate for Windows and deployment targets.
11. Add `--force`, `--dry-run`, and `--output` CLI options.
12. Add `.data/` or the chosen store-build directory to `.gitignore`.

### Required tests

- RDF/XML ingestion.
- Turtle ingestion with language literals.
- Malformed source rejection.
- Missing source rejection.
- Import allowlist rejection.
- Idempotent unchanged-source behavior.
- Forced rebuild.
- Failed build leaves active store unchanged.
- Store can be reopened after process exit.

### Deliverables

- Source manifest schema and example.
- Ingestion CLI.
- Persistent Oxigraph store build.
- Build manifest and active-build mechanism.
- Ingestion integration tests.

### Exit gate

Deleting the local store and running one documented command recreates a
validated, queryable store from committed sources without GraphDB.

### Suggested commits

```text
chore(backend): add PyOxigraph dependency
feat(ingestion): define RDF source manifest
feat(ingestion): build persistent Oxigraph store
feat(ingestion): promote validated store builds
test(ingestion): cover atomic RDF store builds
```

## 7. Phase 3: Define and Materialize Semantics

### Preconditions

- Asserted and label graphs load successfully.
- Baseline GraphDB fixtures are available.

### Tasks

1. Inventory semantic constructs used by application-visible Wine fixtures.
2. Define `rdfs-wine-parity` precisely:
   - Class hierarchy closure.
   - Supported `owl:intersectionOf` membership.
   - Inverse properties.
   - Symmetric properties.
   - Direct versus transitive `locatedIn` behavior.
   - Supported `owl:hasValue` implications.
3. Decide the first materializer:
   - A small deterministic RDFS/profile materializer, or
   - RDFLib + OWL-RL, if its supported profile matches requirements.
4. Use Owlready2/HermiT only for a separate optional full-reasoning experiment.
5. Write inferred triples into `urn:fkg:graph:inferred`.
6. Record reasoning tool/version/profile in the store manifest.
7. Add golden semantic fixtures for all supported entailments.
8. Verify that inferred triples are stable across repeated builds.

### Reasoning spike

Run a time-boxed comparison on the Wine ontology:

| Option | Measure |
| --- | --- |
| Deterministic profile materializer | Coverage, speed, maintenance cost |
| OWL-RL materialization | Coverage, speed, triple growth |
| Owlready2 + HermiT | Coverage, Java/runtime cost, determinism |
| Owlready2 + Pellet | Coverage, license implications, determinism |

Record the decision in an ADR before committing to full OWL reasoning.

### Required tests

- `Sauternes` individual maps to Wine.
- `madeIntoWine`/`madeFromGrape` inverse behavior.
- `producesWine`/`hasMaker` inverse behavior.
- Symmetric `adjacentRegion` behavior.
- Direct and optional transitive `locatedIn` behavior.
- Asserted and inferred provenance separation.

### Deliverables

- Semantic profile document/ADR.
- Materialization implementation.
- Inference named graph.
- Semantic golden tests.

### Exit gate

Every semantic difference from GraphDB baseline has either parity or a written,
approved behavior change.

### Suggested commits

```text
docs(architecture): define RDF reasoning profile
feat(ingestion): materialize Wine graph semantics
test(semantics): add OWL parity fixtures
```

## 8. Phase 4: Implement OxigraphGraphRepository

### Preconditions

- Promoted store contains asserted, imported, label, and inferred graphs.
- Repository protocol and semantic profile are stable.

### Tasks

1. Implement store lifecycle and term-mapping helpers.
2. Implement prepared/fixed query templates for:
   - Entity lookup by IRI.
   - Bounded label/identifier search.
   - Incoming relationships.
   - Outgoing relationships.
   - Predicate-filtered expansion.
   - Wine-by-Region and Wine-by-Grape compatibility helpers.
3. Use PyOxigraph substitutions for every user-supplied term.
4. Preserve labels and language preference.
5. Map entity kinds using asserted/inferred type closure.
6. Deduplicate canonical relationships.
7. Implement cursor encoding/decoding with opaque, versioned cursors.
8. Apply query limits in SPARQL or quad iteration, not after full collection.
9. Implement bounded path BFS using batched frontier queries.
10. Move blocking store calls off the asyncio event loop using the measured
    access strategy.
11. Translate all store errors into repository/service-neutral exceptions.

### Query implementation guidance

- Prefer direct `quads_for_pattern()` for simple subject/predicate lookups when
  it is clearer and benchmarked faster.
- Prefer SPARQL for joins, incoming/outgoing unions, hierarchy queries, and
  bounded search.
- Keep all SPARQL documents in the Oxigraph adapter package.
- Never construct predicate or IRI strings from raw client input.

### Required tests

- Full repository contract suite against Oxigraph.
- Language label selection.
- Missing label fallback.
- Typed literal mapping.
- Incoming/outgoing/both direction behavior.
- Predicate allowlist behavior.
- Pagination and cursor rejection.
- Path depth and visited-node budgets.
- Concurrent read smoke test.

### Deliverables

- Feature-complete Oxigraph adapter.
- Query templates and mappings.
- Contract and integration tests.

### Exit gate

All repository contract tests pass without GraphDB running.

### Suggested commits

```text
feat(oxigraph): add RDF term mappings
feat(oxigraph): implement entity retrieval
feat(oxigraph): implement relationship traversal
feat(oxigraph): add bounded graph expansion
feat(oxigraph): add bounded path discovery
test(oxigraph): satisfy repository contract
```

## 9. Phase 5: Harden GraphService and GraphQL

### Preconditions

- Both GraphDB and Oxigraph satisfy the base repository contract.

### Tasks

1. Add stable service error codes required by the specification.
2. Add service-level default and maximum traversal budgets.
3. Add `GraphExpansion`, `TraversalInput`, direction, truncation, and cursor
   GraphQL types.
4. Keep existing fields backward compatible.
5. Route legacy `get_neighbors` and `expand` through the bounded expansion
   implementation.
6. Distinguish "no path" from "search budget exhausted."
7. Add GraphQL query depth/complexity controls.
8. Add operation timeouts and cancellation behavior.
9. Add readiness endpoint metadata for active store build.

### Required tests

- Service clamps overlarge client limits.
- Invalid relation filters return stable errors.
- Cursor format is opaque and invalid cursors are rejected.
- GraphQL aliases/nesting cannot bypass budgets.
- Old GraphQL documents still execute.
- Public errors contain no storage implementation details.

### Deliverables

- Bounded service contracts.
- Additive GraphQL expansion API.
- Stable errors and readiness metadata.

### Exit gate

The public API is backend-neutral, backward compatible, and cannot issue an
unbounded repository operation.

### Suggested commits

```text
feat(service): enforce traversal budgets
feat(graphql): expose bounded graph expansion
feat(api): limit GraphQL query complexity
feat(api): report RDF store readiness
```

## 10. Phase 6: Parity and Performance Verification

### Preconditions

- Oxigraph adapter and bounded API are feature complete.

### Tasks

1. Run every golden query against GraphDB and Oxigraph.
2. Normalize ordering and compare entities, labels, kinds, and canonical edges.
3. Classify differences:
   - Defect.
   - Intentional semantic profile difference.
   - GraphDB-generated schema artifact to discard.
4. Benchmark entity, search, expansion, and path operations.
5. Benchmark cold store open and warm startup.
6. Measure store size and inferred triple growth.
7. Run repeated and concurrent read tests.
8. Record results under `docs/benchmarks/`.

### Required test matrix

| Dimension | Values |
| --- | --- |
| Backend | GraphDB, Oxigraph |
| Data | Wine fixture, generated medium fixture, generated large fixture |
| Query | Entity, search, incoming, outgoing, expansion, path |
| State | Cold, warm |
| Concurrency | 1, 10, agreed service target |

### Deliverables

- Parity report.
- Performance report.
- Approved difference list.
- Updated limits based on measurements.

### Exit gate

All acceptance scenarios pass and performance targets are met or formally
revised with evidence.

### Suggested commits

```text
test(migration): compare GraphDB and Oxigraph results
perf(oxigraph): add retrieval benchmarks
docs(benchmarks): record backend parity results
```

## 11. Phase 7: Switch Runtime Default

### Preconditions

- Phase 6 exit gate passes.
- A validated promoted store is available.

### Tasks

1. Change development and test default to `GRAPH_BACKEND=oxigraph`.
2. Keep GraphDB adapter selectable for rollback.
3. Remove GraphDB requirements from the normal startup path.
4. Update `.env.example`, README, setup docs, and tasks.
5. Run the full backend and frontend workflow with GraphDB stopped.
6. Exercise store rollback to the previous build.
7. Deploy to a non-production environment and observe metrics.

### Required tests

- Fresh clone setup from RDF sources.
- GraphDB-free backend startup.
- Public GraphQL regression suite.
- Graph Explorer search and expansion.
- Rollback to previous store build.

### Deliverables

- Oxigraph default runtime.
- GraphDB rollback flag.
- Updated operational documentation.

### Exit gate

The prototype operates normally for an agreed soak period without GraphDB.

### Suggested commits

```text
feat(config): default to Oxigraph backend
docs(setup): document embedded RDF runtime
test(e2e): run explorer without GraphDB
```

## 12. Phase 8: Harden the Graph Explorer

### Preconditions

- Bounded `GraphExpansion` API is available.

### Tasks

1. Introduce renderer-neutral frontend graph models.
2. Move Cytoscape conversion into `cytoscape-renderer.tsx`.
3. Track visible node/edge budgets in graph state.
4. Block, paginate, or aggregate expansions that exceed the hard budget.
5. Add relation, direction, and inferred/asserted filters.
6. Add expansion preview counts.
7. Add undo/collapse for each expansion.
8. Hide labels below zoom thresholds.
9. Disable edge labels and animations above configured thresholds.
10. Add an accessible relationship table synchronized with selection.
11. Add keyboard navigation and reduced-motion handling.
12. Add truncation and continuation UI.

### Required tests

- UI cannot exceed hard visible budget.
- High-degree expansion requires refinement.
- Collapse removes only elements introduced by that expansion when safe.
- Relationship table matches visible edges.
- Keyboard and reduced-motion checks.
- Browser memory remains stable over repeated expand/collapse cycles.

### Deliverables

- Renderer abstraction.
- Bounded progressive explorer.
- Accessible table view.
- Frontend interaction tests.

### Exit gate

The explorer remains usable and responsive at the approved Cytoscape visible
budget and handles truncated results explicitly.

### Suggested commits

```text
refactor(explorer): isolate graph renderer
feat(explorer): enforce visible graph budgets
feat(explorer): filter relationship expansion
feat(explorer): add relationship table view
test(explorer): cover bounded exploration
```

## 13. Phase 9: Renderer Benchmark and Decision

### Preconditions

- Renderer-neutral state and component boundary exist.
- Representative synthetic fixtures can be generated.

### Tasks

1. Generate fixtures at 1k, 10k, 50k, and 100k total elements with:
   - Sparse graph.
   - High-degree hubs.
   - Dense clusters.
   - Multiple disconnected components.
2. Benchmark Cytoscape with production styles at approved visible budgets.
3. Implement a time-boxed cosmos.gl renderer spike.
4. Measure:
   - Data conversion time.
   - First render time.
   - Layout time.
   - Pan/zoom frame rate.
   - Selection latency.
   - Browser memory.
   - Accessibility and labeling effort.
5. Evaluate Cosmograph, Ogma, or KeyLines only if commercial licensing is
   acceptable.
6. Record an ADR selecting:
   - Cytoscape only.
   - Cytoscape for detail plus cosmos.gl for overview.
   - A replacement renderer.

### Decision guidance

- Do not select a renderer solely because it can draw more points.
- Prefer bounded, understandable views over million-node hairballs.
- A dual-mode design MAY use GPU overview for clusters and Cytoscape detail for
  rich neighborhoods.
- WebVOWL MAY be evaluated separately for ontology schema visualization.

### Deliverables

- Reproducible renderer benchmark.
- Renderer ADR.
- Migration estimate if replacement is selected.

### Exit gate

The renderer decision is supported by measurements and user workflow tests.

### Suggested commits

```text
perf(explorer): add renderer benchmark fixtures
experiment(explorer): prototype cosmos renderer
docs(architecture): select graph renderer strategy
```

If the repository's Conventional Commit tooling rejects `experiment`, use
`chore(explorer)` for the spike commit.

## 14. Phase 10: Remove GraphDB Runtime

### Preconditions

- Oxigraph has completed the soak period.
- Rollback uses store versions rather than GraphDB.
- Parity fixtures are archived.

### Tasks

1. Remove the GraphDB adapter from runtime composition.
2. Remove HTTPX usage if no other service needs it.
3. Remove GraphDB environment variables.
4. Archive or remove GraphDB endpoint schema artifacts after confirming they are
   not needed as migration fixtures.
5. Retain normalized parity fixtures and migration reports.
6. Rewrite GraphDB setup documentation for historical/migration reference.
7. Remove GraphDB-only tests from the default suite or mark them archival.
8. Verify a clean machine setup without GraphDB installed.

### Required tests

- Dependency audit contains no GraphDB runtime reference.
- Fresh clone ingestion and startup.
- Full API/frontend suite.
- Store backup and rollback.

### Deliverables

- GraphDB-free runtime and setup.
- Archived migration evidence.
- Clean dependency/configuration surface.

### Exit gate

No normal build, test, startup, or user workflow requires GraphDB.

### Suggested commits

```text
refactor(retrieval): remove GraphDB runtime adapter
chore(config): remove GraphDB settings
docs(migration): archive GraphDB setup guidance
```

## 15. Phase 11: Operational Hardening and Release

### Tasks

1. Add store backup, restore, and verification commands.
2. Add structured logging and metrics for repository operations.
3. Add readiness metadata and alerts for missing/corrupt store builds.
4. Document worker/process access constraints.
5. Add CI jobs for ingestion, contract tests, frontend build, and benchmarks
   appropriate for pull requests or scheduled runs.
6. Add dependency and license review for PyOxigraph and optional reasoners.
7. Perform security review for RDF parsing, imports, paths, and query limits.
8. Tag the migration release and preserve the final parity report.

### Exit gate

The release satisfies every MUST requirement or documents an approved exception,
and operational recovery has been demonstrated.

## 16. Cross-Phase Verification Checklist

Run after every phase that changes runtime behavior:

```powershell
# Backend
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m py_compile main.py api\graphql_schema.py domain\models.py services\graph_service.py

# Frontend
Set-Location frontend
npm run lint
npm run build
```

Also verify:

- `git diff --check` is clean.
- No generated store data is staged.
- No public schema contains backend-specific terminology.
- No traversal lacks a server-side limit.
- Documentation and `.env.example` match runtime behavior.

## 17. Rollback Strategy

| Migration stage | Rollback |
| --- | --- |
| Before runtime switch | Set `GRAPH_BACKEND=graphdb` |
| After Oxigraph default | Select GraphDB adapter and restart |
| After GraphDB removal | Promote previous Oxigraph store build and restart |
| Failed ingestion | Keep active build; discard temporary build |
| Semantic regression | Restore previous store/profile version |
| Frontend renderer regression | Select previous renderer adapter/build |

Never make source ontology edits the rollback mechanism. Store builds must be
derived artifacts that can be rebuilt or switched independently.

## 18. Pull Request Strategy

Prefer multiple reviewable pull requests on the migration branch or child
branches rather than one final oversized change:

1. Repository port and baseline tests.
2. Ingestion pipeline.
3. Semantic profile/materialization.
4. Oxigraph repository.
5. Bounded GraphQL/service contract.
6. Runtime switch and GraphDB-free E2E.
7. Explorer safeguards.
8. Renderer benchmark/ADR.
9. GraphDB removal and operational hardening.

Each pull request should include:

- Requirement IDs implemented.
- Tests and benchmark evidence.
- Public schema impact.
- Data/store migration impact.
- Rollback procedure.
- Documentation updates.

## 19. Final Migration Completion Checklist

- [ ] Baseline fixtures are frozen.
- [ ] `GraphRepository` protocol is in use.
- [ ] RDF source manifest is committed.
- [ ] Imported ontologies are pinned or vendored.
- [ ] Oxigraph store builds are reproducible and atomic.
- [ ] Semantic profile is approved and tested.
- [ ] Oxigraph adapter passes contract tests.
- [ ] GraphDB parity differences are resolved or approved.
- [ ] Bounded expansion API is live.
- [ ] GraphDB-free E2E passes.
- [ ] Graph Explorer enforces visible budgets.
- [ ] Renderer benchmark and ADR are complete.
- [ ] Store rollback has been demonstrated.
- [ ] GraphDB runtime configuration is removed.
- [ ] Security and license reviews are complete.
- [ ] Final documentation matches the released system.