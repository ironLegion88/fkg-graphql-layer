# Sprint 3 Implementation Plan: Ontodia Prototype

**Status:** Planned (not yet started)  
**Prerequisite:** Sprint 2 complete and merged  
**Estimated Start:** After Sprint 2 delivery  
**Branch Strategy:** `sprint-3/ontodia-prototype` (created from Sprint 2 merge point)

---

## 1. Sprint Goal

Produce an evidence-based Ontodia accept/reject decision and, only if safe,
demonstrate a separately deployed, bounded, GraphQL-backed ontology diagramming
prototype.

## 2. Key Decision: Sequential After Sprint 2

Sprint 3 will run **sequentially after Sprint 2** (not in parallel). This allows:

1. **Reuse of Sprint 2's shared packages** — selection state, session format, conformance tests, design tokens, accessibility utilities, and GraphQL client can be imported directly rather than reimplemented.
2. **Stable GraphQL API** — All semantic repository queries, overview endpoints, and session APIs from Sprint 2 will be finalized and tested before Sprint 3 builds its DataProvider.
3. **LGPL review timing** — The LGPL-2.1 license review for Ontodia will be conducted when Sprint 3 actually begins, not prematurely.

## 3. Requirement Coverage

- Renderer separation: `AR-105`, `AR-106`
- Ontodia: `RO-001` through `RO-010`
- Prototype disclosure: `AX-008`
- Shared session mapping where feasible: `SE-002`
- Shared/frontend feasibility tests: `TC-007`, `TC-009`
- Acceptance: `AC-112`

## 4. Entry Criteria

- Sprint 2 merged and all exit gates passed
- Sprint 2 shared packages (selection, session, conformance, GraphQL client) stable
- LGPL review owner identified
- Fixed timebox and explicit rejection criteria approved
- Representative small and medium ontology fixtures available (Wine + Pizza + Food)

## 5. Batch Sequencing

| Batch | Name | Depends On | Focus |
|-------|------|-----------|-------|
| **3A** | Mandatory Feasibility Gate | — | Upstream audit, build spike, go/no-go ADR |
| **3B** | Isolated Prototype Build | 3A (positive) | Separate app, prototype disclosure |
| **3C** | DataProvider — Schema Ops | 3B | classTree, classInfo, propertyInfo, linkTypes |
| **3D** | DataProvider — Element/Nav Ops | 3C | elementInfo, linksInfo, linkElements, filter |
| **3E** | Prototype Features & Verification | 3D | Templates, persistence, selection sync, testing |

> **Note:** If Batch 3A produces a negative feasibility decision, Sprint 3 closes with a rejection ADR and the DataProvider mapping documentation. Batches 3B–3E are skipped.

---

## 6. Batch 3A: Mandatory Feasibility Gate

**Stories:** S3-EP1-ST1, S3-EP1-ST2, S3-EP1-ST3  
**Requirements:** `RO-001`–`RO-003`, `TC-009`

> **No feature code proceeds until this gate completes with a positive ADR.**

### 3A-1: Upstream Audit (S3-EP1-ST1)

Record:
- Upstream archive state (metaphacts/ontodia archived September 2024)
- npm/source installation reproducibility
- Node, TypeScript, bundler, CSS, and browser compatibility
- React version requirements (legacy lifecycle APIs, class components)
- Dependency vulnerability scan (npm audit, Snyk)
- Transitive license inventory (LGPL-2.1-or-later propagation)
- Known browser/security policy limitations (CSP, iframe)

### 3A-2: Build Compatibility Spike (S3-EP1-ST2)

- Create isolated workspace: `frontend-ontodia/` or `packages/ontodia/`
- Attempt production build without modifying supported app
- Evaluate React compatibility: isolation options (separate root, iframe, compatibility shim)
- Run minimal static DataProvider example
- Measure: bundle size, initialization time, navigation performance, memory on Wine + Pizza fixtures
- Record required forks or patches
- **Reuse Sprint 2 shared packages** where possible (GraphQL client, models, session types)

### 3A-3: Go/No-Go ADR (S3-EP1-ST3)

Published ADR with one of three outcomes:
1. **Continue** with unmodified package
2. **Continue** with explicitly owned compatibility fork
3. **Reject** with documented evidence

**Output:**
- `docs/ontodia-feasibility-report.md`
- `docs/ontodia-adr.md`

---

## 7. Batch 3B: Isolated Prototype Build

**Stories:** S3-EP2-ST1, S3-EP2-ST2  
**Requirements:** `RO-004`, `NF-008`, `AX-008`

### Deliverables
- Separate deployable application with own `package.json`, Vite config, entry point
- **Import Sprint 2 shared packages:** GraphQL client, domain models, session types, design tokens
- Supported app bundle MUST NOT import Ontodia
- Prototype status disclosure banner

**Output:**
- `frontend-ontodia/package.json`
- `frontend-ontodia/vite.config.ts`
- `frontend-ontodia/src/main.tsx`
- `frontend-ontodia/src/PrototypeBanner.tsx`

---

## 8. Batch 3C: GraphQL DataProvider — Schema Operations

**Stories:** S3-EP3-ST1, S3-EP3-ST3  
**Requirements:** `RO-005`, `RO-006`

### DataProvider Operations
| Ontodia Operation | GraphQL Query | Notes |
|---|---|---|
| `classTree` | `list_classes` + hierarchy assembly | Bounded pagination |
| `classInfo` | `get_class_info` | Direct from Sprint 2 API |
| `propertyInfo` | `get_property_info` | Direct from Sprint 2 API |
| `linkTypes` | `list_properties` (object properties) | Filtered |
| `linkTypesInfo` | `get_property_info` per type | Batched |

- All requests bounded with page limits and cancellation
- No direct RDF/SPARQL providers (`RO-006`)
- Stable error codes mapped to Ontodia error handling

---

## 9. Batch 3D: GraphQL DataProvider — Element & Navigation Operations

**Stories:** S3-EP3-ST2

### DataProvider Operations
| Ontodia Operation | GraphQL Query | Notes |
|---|---|---|
| `elementInfo` | `get_resource_metadata` + `get_entity` | Merged result |
| `linksInfo` | `get_relationships` | With provenance fields |
| `linkTypesOf` | `get_expansion_preview` | Counts by predicate/direction |
| `linkElements` | `expand_graph` | Direction/predicate filters + cursors |
| `filter` | `search` | Paginated GraphQL search |

- Multilingual labels, types, provenance mapped to Ontodia models
- Canonical IRIs preserved (no lossy transformations)
- Truncation indicators on bounded results

---

## 10. Batch 3E: Prototype Features & Verification

**Stories:** S3-EP4-ST1–ST5, S3-EP5  
**Requirements:** `RO-007`, `TC-007`, `TC-009`, `AC-112`

### Features
- Class tree navigation and search
- Context-aware link navigation with bounded expansion
- Ontology-aware node templates (semantic kind, labels, inferred indicator)
- Diagram persistence (map to Sprint 2 shared session format)
- Selection synchronization via canonical IRIs (reuse Sprint 2 selection state)

### Verification
- Reproducible isolated build
- No Ontodia dependency in supported app bundle
- No direct RDF/SPARQL access
- All DataProvider requests bounded
- Wine + Pizza fixture behavior verified
- Sprint 2 shared conformance tests pass (`TC-007`)
- Known limitations documented

---

## 11. Sprint 3 Exit Gate

Sprint 3 closes when **either**:
1. **AC-112 passes** — Isolated bounded prototype builds separately, accesses data only through GraphQL, doesn't pollute supported app bundle. **OR**
2. **RO-009 satisfied** — Rejection ADR with reproducible evidence and DataProvider mapping.

---

## 12. Sprint 2 Packages Available for Reuse

The following Sprint 2 deliverables should be imported by Sprint 3:

| Package/Module | Sprint 2 Location | Sprint 3 Usage |
|---|---|---|
| GraphQL client | `frontend/src/api/graph.ts` | DataProvider backend calls |
| Domain models | `frontend/src/interfaces/models.ts` | Type definitions |
| Session format | `frontend/src/session/SessionSchema.ts` | Diagram persistence |
| Selection state | `frontend/src/interfaces/` | IRI-based selection sync |
| Conformance tests | `frontend/src/tests/shared/` | Shared test runner |
| Design tokens | `frontend/src/styles/tokens/` | Consistent styling |

---

## 13. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Archived upstream and legacy React | HIGH | Separate build, strict timebox, reject if isolation unsafe |
| Vulnerable abandoned dependencies | HIGH | Audit before feature work; no exceptions in supported app |
| LGPL obligations conflict with distribution | MEDIUM | Legal/license review before Batch 3A completes |
| DataProvider initialization is unbounded | MEDIUM | GraphQL metadata/count pages, instrument every call |
| Prototype mistaken for supported product | LOW | Persistent experimental labeling and supported-app link |
| Fork becomes accidental permanent burden | LOW | Require explicit ownership ADR before production claim |
