# OWL Store Migration Analysis

**Status:** Proposed  
**Branch:** `feat/owl-store-migration`  
**Last updated:** 2026-07-24

## 1. Executive Decision

The prototype should migrate from the GraphDB-specific retrieval adapter to an
embedded RDF store backed by **PyOxigraph**. RDF/OWL source files remain the
canonical input, but they must be loaded into an indexed store during an explicit
ingestion step rather than parsed for every API request.

Use **Owlready2 only as an optional offline reasoning and validation tool**. It
should not be the primary concurrent runtime store. Keep the GraphDB adapter
temporarily as a parity reference until the embedded implementation passes the
same contract tests.

For visualization, keep **Cytoscape.js for bounded exploratory subgraphs**. The
underlying knowledge graph may contain millions of nodes, but the browser must
never receive or render the complete graph. Introduce hard expansion limits,
pagination, aggregation, and level-of-detail behavior. Benchmark **cosmos.gl**
as the preferred open-source GPU alternative only if a validated use case
requires tens or hundreds of thousands of simultaneously visible elements.

## 2. Scope

This migration covers:

- Replacing GraphDB-generated GraphQL queries with an embedded RDF query
  implementation.
- Preserving the public Strawberry GraphQL schema and `GraphService` behavior.
- Loading RDF/XML, Turtle, and imported ontologies into a persistent local
  store.
- Defining the reasoning profile needed to preserve current graph semantics.
- Removing runtime dependence on GraphDB endpoint management and generated
  schema YAML.
- Hardening graph expansion and visualization for a large underlying dataset.
- Establishing benchmarks and parity tests before GraphDB removal.

This migration does not cover:

- Replacing Typesense or integrating the existing Search Interface.
- Designing the complete Food Knowledge Graph ontology.
- Building a general-purpose OWL editor.
- Rendering every entity in a million-node graph simultaneously.

## 3. Current Prototype

The current request path is:

```text
Graph Explorer
    -> Public Strawberry GraphQL
    -> GraphService
    -> GraphRetrievalService
    -> HTTPX
    -> GraphDB generated GraphQL endpoint
```

The public and service boundaries are directionally correct. The replacement
should happen below `GraphService`, but the current service directly references
the concrete `GraphRetrievalService`; a repository protocol is required first.

### 3.1 GraphDB Features Currently Used

The prototype uses more than HTTP transport:

| GraphDB capability | Current dependency | Replacement obligation |
| --- | --- | --- |
| RDF persistence and indexes | Entity and relation retrieval | Persistent indexed embedded store |
| RDF/XML parsing | `wine.rdf` ingestion | PyOxigraph bulk RDF/XML loading |
| Generated GraphQL schema | Roots such as `wine`, `winery`, and `wineGrape` | Internal SPARQL or indexed quad patterns |
| Language literal mapping | `displayName { value }` | Native RDF literal mapping |
| Ontology hierarchy behavior | Subclass individuals exposed as Wines | Explicit inference/materialization profile |
| Named graph support | Supplemental labels graph | Separate named graphs in embedded store |
| Query execution and isolation | Concurrent GraphQL reads | Store-level read isolation and lifecycle |

Features not currently used include GraphDB clustering, RBAC, SHACL validation,
connectors, federation, and advanced full-text indexing.

### 3.2 Current Scalability Constraints

The adapter currently fetches collections with `limit: 250` and filters them in
Python. This was acceptable for the sample graph but is not a scalable retrieval
strategy. The path implementation also performs repeated per-node retrievals.

The frontend sends all currently visible nodes and edges back through React into
Cytoscape and applies labels, arrows, and layouts. Those choices are appropriate
for small neighborhoods, not unbounded graphs.

## 4. RDF/OWL Source Characteristics

The file extension is not the semantic format. `wine.rdf` is an OWL ontology
serialized as RDF/XML; a file named `.owl` may use RDF/XML, OWL/XML, Turtle, or
another RDF serialization.

The sample ontology uses constructs that affect migration behavior:

- `rdfs:subClassOf` hierarchies.
- `owl:intersectionOf` class definitions.
- `owl:Restriction`, `owl:hasValue`, cardinality, and value restrictions.
- `owl:inverseOf` for `madeIntoWine` and `producesWine`.
- Transitive `locatedIn`.
- Symmetric `adjacentRegion`.
- Functional properties.
- Language-tagged labels in the supplemental Turtle graph.
- `owl:imports` for the Food ontology.

An RDF parser alone preserves these triples but does not automatically apply
their OWL semantics. Import resolution and inference therefore need an explicit
policy.

## 5. Technology Evaluation

### 5.1 Direct RDF/XML Parsing

Parsing XML and building Python dictionaries is rejected as the runtime design.
It would require custom indexes, import handling, literal semantics, class
closure, inverse indexes, transactions, and query optimization. It would also
rebuild state on every process start.

### 5.2 RDFLib

RDFLib is the simplest standards-based Python option. It parses common RDF
formats and implements SPARQL 1.1 with pluggable stores. It is well suited to
tests, transformations, and small datasets, but its pure-Python default path is
not the preferred runtime for a graph expected to grow substantially.

### 5.3 Owlready2

Owlready2 offers Pythonic OWL objects, a SQLite-backed quadstore, a native SPARQL
subset, and HermiT/Pellet integration. It is valuable for offline reasoning,
consistency checks, and ontology-focused tooling.

It is not selected as the primary runtime because:

- The persistent SQLite store opens in exclusive mode by default.
- Its native query engine implements only a subset of SPARQL.
- `.search()` examines asserted facts and does not reason.
- HermiT and Pellet require Java and are unsuitable for per-request execution.
- Concurrent API worker behavior is less suitable than a native embedded RDF
  store.

### 5.4 PyOxigraph

PyOxigraph is selected for the runtime adapter because it provides:

- A Rust implementation exposed to Python.
- In-memory and persistent RocksDB-backed stores.
- Transactional loading and repeatable-read isolation.
- SPARQL 1.1 query and update support.
- Indexed quad-pattern iteration.
- Bulk loading for RDF/XML, Turtle, N-Triples, N-Quads, TriG, N3, and JSON-LD.
- Read-only store access and backups.

PyOxigraph is not an OWL reasoner. Required entailments must be materialized
during ingestion or expressed explicitly in bounded queries.

### 5.5 Decision Matrix

| Criterion | RDFLib | Owlready2 | PyOxigraph | GraphDB |
| --- | --- | --- | --- | --- |
| Embedded Python use | Strong | Strong | Strong | No |
| RDF/XML ingestion | Yes | Yes | Yes | Yes |
| Full SPARQL 1.1 | Yes | Partial native engine | Yes | Yes |
| Persistent indexing | Plugin-dependent | SQLite | RocksDB | Native server |
| OWL reasoning | External packages | HermiT/Pellet | No | Yes |
| Concurrent service runtime | Limited by store | Caution required | Best embedded option | Strong |
| Operational overhead | Low | Low/medium | Low | Medium/high |
| Selected role | Tests/tools | Offline reasoning | Runtime retrieval | Parity reference |

## 6. Target Architecture

```text
Standalone Graph Explorer
            |
Public Strawberry GraphQL
            |
       GraphService
            |
    GraphRepository protocol
       /                 \
OxigraphGraphRepository  GraphDBGraphRepository (temporary parity adapter)
       |
Persistent Oxigraph store
       |
Ingestion and materialization pipeline
       |
OWL/RDF sources + supplemental labels + vendored imports
```

The public GraphQL schema, frontend GraphQL documents, and domain dataclasses
must not depend on PyOxigraph, SPARQL, RDFLib, or Owlready2 types.

## 7. Repository Boundary

Introduce a protocol with database-neutral return values:

```python
class GraphRepository(Protocol):
    async def get_entity(self, entity_id: str) -> GraphEntity | None: ...
    async def search_entities(self, query: str, limit: int) -> list[GraphEntity]: ...
    async def get_relationships(
        self,
        entity_id: str,
        options: TraversalOptions,
    ) -> GraphExpansion: ...
    async def find_path(
        self,
        source_id: str,
        target_id: str,
        options: PathOptions,
    ) -> GraphPath | None: ...
```

`GraphService` owns validation, limits, authorization hooks, and orchestration.
The repository owns RDF terms, query language, store access, and result mapping.

## 8. Ingestion and Store Lifecycle

The API must not parse OWL files on each request. Use a separate ingestion path:

1. Resolve configured source files and approved `owl:imports`.
2. Validate RDF syntax and source checksums.
3. Load asserted triples into named graphs.
4. Apply the selected reasoning/materialization profile.
5. Load inferred triples into a distinct named graph.
6. Optimize and flush the Oxigraph store.
7. Write a manifest containing source hashes, graph names, triple counts, and
   build timestamp.
8. Atomically promote the completed store for API readers.

Suggested graphs:

```text
urn:fkg:graph:asserted
urn:fkg:graph:labels
urn:fkg:graph:imports
urn:fkg:graph:inferred
```

The API should open the promoted store once during application startup and
reuse it for the application lifetime.

## 9. Reasoning Profile

A semantic profile must be chosen instead of promising unspecified "OWL
support."

### Minimum parity profile

- Resolve class membership through `rdfs:subClassOf` and supported
  `owl:intersectionOf` paths.
- Preserve language-tagged `rdfs:label` values.
- Support incoming and outgoing relation lookup.
- Materialize or query `owl:inverseOf` relationships.
- Materialize symmetric `adjacentRegion` edges.
- Decide whether transitive `locatedIn` results are returned by default or only
  when requested.

### Optional full reasoning profile

Run Owlready2 with HermiT or Pellet offline, persist inferred class and property
facts, and load the output into Oxigraph. This requires Java, reasoner license
review, deterministic build tests, and ingestion time budgets.

Reasoners must never run in the request path.

## 10. Query Strategy

Internal SPARQL is recommended because it is standard, parameterizable through
PyOxigraph substitutions, and replaceable with another RDF store later.

Rules:

- Never interpolate user input into SPARQL text.
- Bind IDs and text through substitutions.
- Select only required predicates.
- Apply limits at the store query, not after collecting all results.
- Fetch incoming and outgoing edges in bounded queries.
- Batch frontier expansion with `VALUES`-style semantics.
- Return truncation and cursor metadata to `GraphService`.
- Do not expose SPARQL through the public API.

## 11. Visualization Analysis

### 11.1 Total graph size is not viewport size

A store may contain millions of entities while an effective browser view shows
only hundreds or a few thousand. Rendering every entity produces an unusable
hairball even if the GPU can draw it.

GraphDB-like user experience comes primarily from query-backed progressive
exploration, not from sending the full database to a visualization library.

### 11.2 Cytoscape.js

Cytoscape.js remains appropriate for rich bounded subgraphs. Its official
performance guidance notes that labels, arrows, curved edges, animations, high
pixel ratios, and large element counts are expensive. The current prototype uses
several of those features.

Production limits should initially be:

- 50 to 200 new nodes per expansion.
- 500 to 2,000 visible nodes, subject to benchmark results.
- Labels hidden below a zoom threshold.
- Edge labels shown on hover/selection for larger views.
- No animated layout above a configured threshold.
- Aggregation or refusal before exceeding the visible-element budget.

### 11.3 Alternative renderers

| Renderer | Evidence-based target | Tradeoff |
| --- | --- | --- |
| Cytoscape.js | Rich small/medium exploratory views | Canvas and rich style overhead |
| Sigma.js | WebGL graphs of thousands of elements | Rendering-focused; less built-in graph UX |
| cosmos.gl | GPU simulation/rendering of hundreds of thousands | Lower-level integration and GPU requirements |
| Cosmograph | Claims multi-million-node rendering and analytics | Commercial licensing for many uses |
| Ogma | Commercial; advertises 25,000-node layouts under one second | License cost and vendor dependency |
| KeyLines | Commercial high-scale exploration and clustering | License cost and vendor dependency |

The renderer should be isolated behind a frontend component boundary so a
benchmark-driven replacement does not affect GraphQL or graph state management.

### 11.4 OWL-specific visualization

WebVOWL and OWL2VOWL visualize ontology vocabulary: classes, properties,
restrictions, and subclass structure. They do not solve large instance-graph
exploration. They may be added later as a separate **Ontology Model** view, but
must not replace the Graph Explorer.

The frontend must never parse `.owl` directly. Doing so would move indexing,
reasoning, import resolution, and access control into the browser and violate the
GraphQL-only application boundary.

## 12. Operational Considerations

- Store builds must be reproducible from committed source manifests.
- Imported ontology URLs must be allowlisted and vendored for deterministic
  builds.
- Untrusted RDF parsing must not be allowed to fetch arbitrary local/network
  resources.
- One process should own store writes; API workers should use promoted read-only
  stores or a documented access model.
- Source updates require atomic store rebuild and swap, not partial live reload.
- Store version and source hashes should appear in health/readiness metadata.
- Backups and rollback store versions are required before production use.

## 13. Key Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Missing GraphDB inference | Entities or edges disappear | Semantic profile and parity fixtures |
| Unresolved `owl:imports` | Incomplete class hierarchy | Allowlisted vendored imports |
| Embedded store write contention | Startup/runtime failures | Offline build plus read-only serving |
| SPARQL injection | Data exposure or expensive queries | Substitutions and fixed query templates |
| Unbounded traversal | Resource exhaustion | Service-enforced node/edge/depth budgets |
| Million-node browser payload | Browser crash and unusable UI | Progressive expansion and aggregation |
| Renderer lock-in | Expensive UI rewrite | Renderer-neutral graph state adapter |
| Reasoner nondeterminism/cost | Slow or inconsistent builds | Pinned toolchain and golden inference tests |

## 14. Exit Criteria for GraphDB Removal

GraphDB can be removed from the runtime only when:

- All repository contract tests pass against Oxigraph.
- Golden GraphDB/Oxigraph parity fixtures pass for entity, search, relation,
  inverse relation, expansion, and path behavior.
- The Wine explorer succeeds end to end without GraphDB running.
- Ingestion resolves approved imports and reports deterministic counts.
- Reasoning-profile behavior is documented and tested.
- Bounded traversal and truncation behavior is implemented.
- Performance meets the requirements specification.
- Operational rebuild, rollback, and corruption-recovery procedures are tested.

## 15. Research Sources

- [PyOxigraph documentation](https://pyoxigraph.readthedocs.io/en/stable/)
- [PyOxigraph RDF store](https://pyoxigraph.readthedocs.io/en/stable/store.html)
- [Owlready2 ontology management](https://owlready2.readthedocs.io/en/v0.48/onto.html)
- [Owlready2 worlds and persistence](https://owlready2.readthedocs.io/en/v0.48/world.html)
- [Owlready2 SPARQL support](https://owlready2.readthedocs.io/en/v0.48/sparql.html)
- [Owlready2 reasoning](https://owlready2.readthedocs.io/en/v0.48/reasoning.html)
- [RDFLib documentation](https://rdflib.readthedocs.io/en/stable/)
- [Cytoscape.js performance guidance](https://js.cytoscape.org/#performance)
- [Sigma.js](https://www.sigmajs.org/)
- [cosmos.gl](https://github.com/cosmosgl/graph)
- [Cosmograph library](https://cosmograph.app/library)
- [WebVOWL](https://github.com/VisualDataWeb/WebVOWL)
- [Ogma](https://doc.linkurious.com/ogma/latest/)
- [KeyLines](https://cambridge-intelligence.com/keylines/)