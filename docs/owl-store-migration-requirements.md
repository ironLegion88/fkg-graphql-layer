# OWL Store Migration Specification and Requirements

**Document type:** Normative specification  
**Status:** Draft for implementation  
**Version:** 0.1.0  
**Last updated:** 2026-07-24

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used
as normative requirement levels.

## 1. Purpose

This document specifies the behavior required to replace the GraphDB-specific
runtime with an embedded RDF/OWL retrieval implementation while preserving the
public GraphQL API and Graph Service abstraction. It also specifies bounded
large-graph exploration requirements for the standalone Graph Explorer.

## 2. Goals

- Treat RDF/OWL files as canonical graph inputs.
- Remove GraphDB as a runtime dependency after verified behavior parity.
- Preserve database-neutral public and service APIs.
- Support indexed entity, relationship, expansion, and path operations.
- Preserve a documented subset of ontology semantics.
- Support an underlying graph containing millions of nodes without transferring
  the complete graph to the browser.
- Keep the visualization renderer replaceable.

## 3. Non-Goals

- Full OWL 2 DL completeness in the request path.
- Public SPARQL access.
- Browser-side OWL parsing or reasoning.
- Simultaneous visualization of every node in a million-node dataset.
- Typesense integration during this migration.
- Editing source ontologies through the GraphQL API.

## 4. Glossary

| Term | Meaning |
| --- | --- |
| Asserted triple | A triple present directly in an input RDF source |
| Inferred triple | A triple materialized from ontology semantics |
| Source manifest | Checksums and metadata describing one store build |
| Store build | A complete immutable Oxigraph dataset version |
| Repository | Database-neutral graph retrieval port |
| Expansion | Bounded nodes and edges around a center entity |
| Visible graph | Elements currently transferred to and rendered by the browser |
| Total graph | All entities and relationships in the indexed store |

## 5. System Context

```text
Graph Explorer / other clients
             |
      Public GraphQL API
             |
         GraphService
             |
      GraphRepository port
             |
  OxigraphGraphRepository
             |
 Persistent indexed RDF store
             |
 Ingestion + optional reasoning
             |
 RDF/XML, Turtle, imports, labels
```

## 6. Architecture Requirements

### AR-001 Repository abstraction

`GraphService` MUST depend on a database-neutral `GraphRepository` protocol and
MUST NOT import PyOxigraph, RDFLib, Owlready2, or GraphDB transport types.

### AR-002 Adapter isolation

RDF terms, SPARQL documents, quad patterns, and store lifecycle behavior MUST be
contained within the retrieval/adapter layer.

### AR-003 Stable public contract

The migration MUST preserve existing public GraphQL field names and meanings.
Necessary pagination and bounded-expansion fields SHOULD be additive.

### AR-004 No direct client storage access

The Graph Explorer and all other clients MUST communicate only with the public
GraphQL API. They MUST NOT parse OWL files or query the embedded store directly.

### AR-005 Replaceable runtime

GraphDB and Oxigraph adapters MUST be testable against the same repository
contract during migration. Runtime selection MAY use dependency injection or
configuration until GraphDB removal.

## 7. Data Source and Ingestion Requirements

### DR-001 Supported formats

The ingestion pipeline MUST support RDF/XML and Turtle. It SHOULD support
N-Triples, N-Quads, TriG, and JSON-LD through PyOxigraph where practical. File
extensions MUST NOT be used as a substitute for explicit or detected RDF format.

### DR-002 Multiple sources

The pipeline MUST load the ontology source, supplemental labels, approved
imports, and inferred output into distinct named graphs.

### DR-003 Import policy

`owl:imports` MUST be resolved only through an allowlist. Production builds MUST
use pinned or vendored import artifacts. Arbitrary network retrieval MUST be
disabled during API startup.

### DR-004 Reproducibility

Each store build MUST record:

- Source path or canonical identifier.
- SHA-256 checksum.
- RDF format.
- Destination named graph.
- Asserted and inferred triple counts.
- Tool and dependency versions.
- Build timestamp and build identifier.

### DR-005 Atomic promotion

Ingestion MUST build a new store outside the active store directory. A store
MUST be promoted only after successful validation and optimization. Failed
builds MUST NOT modify the active store.

### DR-006 Rebuild behavior

The pipeline MUST detect source checksum changes. It MUST support an explicit
forced rebuild. API requests MUST NOT trigger ingestion or reasoning.

### DR-007 Labels

Language-tagged `rdfs:label` values MUST preserve text and language. Entity
mapping SHOULD prefer configured languages in order and MUST fall back to a
stable IRI-derived label when none exists.

### DR-008 Store optimization

The pipeline MUST flush and optimize the Oxigraph store after bulk loading and
before promotion.

## 8. Semantic and Reasoning Requirements

### SR-001 Explicit semantic profile

The project MUST document which RDFS/OWL entailments are materialized. It MUST
NOT advertise unrestricted OWL support.

### SR-002 Class membership

Entity classification MUST account for asserted types and the configured class
hierarchy. Wine subclass instances used by the current fixture MUST be returned
as `EntityKind.WINE`.

### SR-003 Inverse properties

Configured `owl:inverseOf` properties MUST be available for incoming and
outgoing traversal without requiring duplicate asserted triples.

### SR-004 Symmetric properties

Configured symmetric properties, including `adjacentRegion`, MUST be traversable
from either endpoint while preserving a canonical relationship representation.

### SR-005 Transitive properties

Transitive relations MUST have an explicit API behavior. Direct expansion MUST
return asserted/direct edges unless a traversal option requests transitive
closure.

### SR-006 Restrictions

The implementation MUST define whether facts implied by `owl:hasValue`,
`owl:intersectionOf`, and cardinality restrictions are materialized. Parity
tests MUST cover every restriction relied upon by application behavior.

### SR-007 Offline reasoning

When HermiT, Pellet, OWL-RL, or another reasoner is enabled, it MUST run during
store build. Reasoning MUST NOT execute in an API request or worker startup path.

### SR-008 Inference provenance

Inferred triples MUST be stored in a separate named graph or otherwise retain
provenance sufficient to distinguish them from asserted data.

## 9. Repository Functional Requirements

### FR-001 Get entity

The repository MUST retrieve one canonical entity by IRI without scanning all
entities. A missing entity MUST produce `None`, not a backend-specific exception.

### FR-002 Search entities

The repository MUST support bounded, case-insensitive label and identifier
search for prototype parity. It MUST accept a result limit and MUST apply that
limit in the store query.

Future Typesense integration MAY replace ranking, but returned IDs MUST remain
canonical graph IDs.

### FR-003 Get relationships

The repository MUST return canonical labelled relationships touching an entity.
It MUST support outgoing, incoming, and both directions. Duplicate canonical
edges MUST be removed.

### FR-004 Filter relationships

Relationship retrieval MUST support an allowlist of predicates and MUST NOT
permit arbitrary query text from clients.

### FR-005 Expand graph

Expansion MUST return center entity, nodes, edges, truncation state, and a
continuation cursor or equivalent continuation mechanism.

### FR-006 Traversal limits

Expansion MUST enforce configurable limits for depth, nodes, edges, and per-node
fan-out. Service limits MUST override more permissive client values.

### FR-007 Find path

Path discovery MUST be bounded by depth and visited-node budget. It MUST return
ordered entities and canonical predicate names. It MUST report truncation or
budget exhaustion separately from "no path exists."

### FR-008 Domain helpers

Existing Wine helpers such as Wines by Region and Wines by Grape MUST retain
behavior until replaced by generic relationship operations.

### FR-009 Literal mapping

RDF IRIs, blank nodes, typed literals, and language literals MUST be mapped
explicitly. Backend object string representations MUST NOT leak into public
properties.

### FR-010 Query safety

Store query templates MUST be fixed in source. User values MUST use PyOxigraph
substitutions or safe term APIs. Raw user text MUST NOT be interpolated into
SPARQL.

## 10. Graph Service Requirements

### GS-001 Validation

`GraphService` MUST validate IDs, empty search input, relation filters, and
traversal budgets before invoking the repository.

### GS-002 Error translation

The service MUST translate adapter failures into database-neutral errors with
stable error codes: `NOT_FOUND`, `INVALID_ARGUMENT`, `INVALID_RELATION`,
`TRAVERSAL_LIMIT`, `BACKEND_UNAVAILABLE`, and `STORE_NOT_READY`.

### GS-003 Business semantics

Entity-kind conversion, canonical edge direction, domain helper behavior, and
authorization hooks MUST live in the service/domain boundary, not the frontend.

### GS-004 Async API

Public service methods MUST remain asynchronous. Blocking embedded store work
MUST not block the event loop; it MUST use an appropriate thread/executor or a
measured safe access strategy.

## 11. GraphQL Requirements

### GQ-001 Existing fields

`get_entity`, `get_wine`, `search_entities`, `get_neighbors`,
`get_relationships`, and `expand` MUST remain backward compatible during the
migration.

### GQ-002 Expansion contract

An additive bounded expansion field SHOULD use the following conceptual shape:

```graphql
input TraversalInput {
  direction: TraversalDirection = BOTH
  relations: [String!]
  max_depth: Int = 1
  node_limit: Int = 200
  edge_limit: Int = 400
  cursor: String
  include_inferred: Boolean = true
}

type GraphExpansion {
  center: Entity!
  nodes: [Entity!]!
  edges: [GraphRelationship!]!
  truncated: Boolean!
  next_cursor: String
}
```

### GQ-003 Complexity control

The API MUST enforce GraphQL depth/complexity limits and request timeouts. An
LLM or UI MUST NOT be able to bypass traversal budgets through aliases or nested
field repetition.

### GQ-004 Backend neutrality

No GraphQL field, type, error, or extension MUST contain `GraphDB`, `Oxigraph`,
`SPARQL`, Owlready2, RocksDB, or storage paths.

## 12. Store Lifecycle Requirements

### ST-001 Startup

The application MUST open and validate the configured store once during
lifespan startup. Startup MUST fail readiness with a clear error if the store is
missing or incompatible.

### ST-002 Read access

API workers SHOULD use a documented read-only store mode. Unsupported
multi-process access patterns MUST be prevented by deployment configuration.

### ST-003 Updates

The first migration release MAY require restart after atomic store promotion.
Hot store swapping is optional and MUST NOT be implemented without concurrency
tests.

### ST-004 Health

Readiness metadata MUST include active store build ID, source manifest hash,
triple count, semantic profile, and store open status. Liveness MUST not perform
an expensive graph query.

### ST-005 Recovery

Operators MUST be able to restore the previous promoted store without rebuilding
from source.

## 13. Visualization Requirements

### VZ-001 Bounded payload

The Graph Explorer MUST NOT request or receive the complete graph. Every graph
response MUST be bounded and report truncation.

### VZ-002 Initial visible budget

The default visible budget MUST be no greater than 500 nodes and 1,000 edges.
The hard initial cap MUST be no greater than 2,000 nodes and 4,000 edges until
benchmark results approve a change.

### VZ-003 Progressive exploration

Users MUST expand one bounded neighborhood at a time and MUST be able to cancel
or undo an expansion.

### VZ-004 High-degree protection

When an entity exceeds the expansion fan-out budget, the UI MUST show relation
counts and require filtering, pagination, or aggregation before adding nodes.

### VZ-005 Level of detail

The renderer SHOULD hide labels below a zoom threshold, show edge labels only on
hover/selection at larger sizes, and disable expensive animations above a
configured threshold.

### VZ-006 Non-visual access

Every visible graph MUST have an equivalent accessible relationship list or
table. Core exploration MUST remain possible without the canvas.

### VZ-007 Renderer isolation

Graph state and GraphQL mapping MUST not expose Cytoscape-specific element
objects. A renderer adapter MUST allow Cytoscape to be replaced by Sigma,
cosmos.gl, or a commercial SDK.

### VZ-008 Renderer benchmark

Cytoscape and cosmos.gl MUST be benchmarked with representative 1k, 10k, 50k,
and 100k element fixtures before selecting a renderer for high-volume views.

### VZ-009 OWL schema view

A future WebVOWL-based ontology schema view MAY be provided separately. It MUST
not be treated as an instance graph renderer or receive protected instance data
without GraphQL authorization.

## 14. Non-Functional Requirements

### NFR-001 Compatibility

The backend MUST support Python 3.10 or newer and the frontend MUST build with
the repository-pinned Node/npm toolchain.

### NFR-002 Request latency

On the agreed reference machine with a warm store and representative dataset:

- Direct entity lookup SHOULD have p95 adapter latency below 100 ms.
- One-hop expansion up to 200 nodes SHOULD have p95 adapter latency below 300
  ms.
- Public GraphQL one-hop expansion SHOULD have p95 latency below 500 ms.
- A bounded four-hop path request SHOULD complete or report budget exhaustion
  within 2 seconds.

Targets MUST be measured rather than assumed and MAY be revised through an
architecture decision record with benchmark evidence.

### NFR-003 Startup

Normal API startup against an existing store SHOULD complete within 5 seconds
and MUST NOT parse the full RDF source.

### NFR-004 Memory

API memory MUST scale with the query result and store cache, not by building a
Python object for every triple. Browser memory MUST remain bounded by the visible
graph budget.

### NFR-005 Reliability

A malformed source, failed reasoner, or interrupted build MUST leave the active
store usable. Reads MUST never observe a partially loaded store.

### NFR-006 Observability

Logs and metrics MUST include operation name, duration, result counts,
truncation, store build ID, and stable error code. Logs MUST NOT include entire
query results or sensitive literals by default.

### NFR-007 Security

- RDF imports MUST be allowlisted.
- Public SPARQL MUST not be exposed.
- Traversal and GraphQL complexity limits MUST be enforced server-side.
- Source paths and store paths MUST not appear in public errors.
- Authorization hooks MUST be applied before returning graph data.

### NFR-008 Accessibility

Graph controls MUST be keyboard operable, maintain visible focus, support
reduced motion, and provide a textual/table alternative for relationships.

### NFR-009 Determinism

Given identical sources, versions, configuration, and reasoning profile, store
build manifests and semantic query fixtures MUST be reproducible.

## 15. Configuration Requirements

The replacement SHOULD use typed settings with at least:

```text
GRAPH_BACKEND=oxigraph|graphdb
RDF_STORE_PATH=<path>
RDF_SOURCE_MANIFEST=<path>
RDF_ACTIVE_BUILD=<build-id-or-path>
RDF_LABEL_LANGUAGES=en,ANY
RDF_REASONING_PROFILE=none|rdfs|owlrl|owl-dl-materialized
GRAPH_DEFAULT_NODE_LIMIT=200
GRAPH_MAX_NODE_LIMIT=2000
GRAPH_DEFAULT_EDGE_LIMIT=400
GRAPH_MAX_EDGE_LIMIT=4000
GRAPH_MAX_DEPTH=4
```

Production defaults MUST be safe when optional settings are omitted.

## 16. Testing Requirements

### TR-001 Unit tests

Tests MUST cover RDF term mapping, language selection, ID fallback labels,
relationship deduplication, direction handling, limits, and error translation.

### TR-002 Repository contract tests

Every repository adapter MUST run the same behavior suite for:

- Existing and missing entity lookup.
- Search limits.
- Outgoing and incoming relationships.
- Relation filtering.
- Expansion truncation.
- Path success, no path, and budget exhaustion.
- Asserted versus inferred behavior.

### TR-003 Golden parity tests

During migration, frozen GraphDB results for representative Wine entities MUST
be compared with Oxigraph results. Differences require an explicit semantic
decision, not silent fixture updates.

### TR-004 Ingestion tests

Tests MUST cover valid RDF/XML, Turtle labels, malformed input, import
allowlisting, checksum changes, atomic failure, rebuild, and rollback.

### TR-005 End-to-end tests

The complete FastAPI GraphQL and Graph Explorer search/expand workflow MUST pass
with GraphDB stopped.

### TR-006 Performance tests

Automated or repeatable benchmark scripts MUST report store size, query latency,
visible element count, render time, interaction frame rate, and browser memory.

## 17. Acceptance Scenarios

### AC-001 GraphDB-free startup

Given a promoted Oxigraph store, when GraphDB is unavailable and the API starts,
then readiness succeeds and entity queries return data.

### AC-002 Wine classification

Given `ChateauDYchemSauterne` is asserted as `Sauternes`, when it is retrieved,
then it is exposed as a Wine according to the configured semantic profile.

### AC-003 Language label

Given an English `rdfs:label`, when the entity is retrieved, then its public
label is the literal text and not an RDF/Python object representation.

### AC-004 Inverse traversal

Given a Wine `hasMaker` Winery edge, when relationships are requested from the
Winery, then the canonical Wine-to-Winery edge is returned as an incoming edge.

### AC-005 Bounded expansion

Given a high-degree entity, when expansion exceeds the configured limit, then
the response is bounded, marked truncated, and provides a continuation method.

### AC-006 Browser safety

Given repeated expansions, when the hard visible-element budget would be
exceeded, then the UI blocks or aggregates the expansion instead of rendering
the excess elements.

### AC-007 Store rollback

Given a promoted build and a failed new build, when the API restarts, then it
continues using the previous valid build.

## 18. Definition of Done

The migration is complete when:

- All MUST requirements are implemented or explicitly superseded by an approved
  decision record.
- GraphDB is not required for runtime or tests other than archived parity tests.
- Repository contract, parity, ingestion, and end-to-end suites pass.
- The active store is reproducible and rollback has been demonstrated.
- Public GraphQL compatibility is verified.
- The Graph Explorer enforces visible budgets and works without GraphDB.
- Benchmarks and final renderer decision are recorded.