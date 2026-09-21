# Sprint 2 Batch 0B Implementation Report: Expose Relationship Provenance in GraphQL & SPARQL Projection Fix

## 1. Summary

Batch 0B resolves Gap 2 by exposing provenance metadata (`predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`) on the GraphQL `GraphRelationship` type and mapping them through from the domain layer. Additionally, Batch 0B resolves defect DEF-0A-1 by ensuring `?needle` is included in the SPARQL `SELECT` projection in `OxigraphGraphRepository._search`, enabling native PyOxigraph variable substitution without test workarounds.

## 2. Completed Work

### 2.1 Fix DEF-0A-1: SPARQL Projection in `_search` (Step 1)
- Updated `OxigraphGraphRepository._search` in `adapters/oxigraph/repository.py` from `SELECT DISTINCT ?entity` to `SELECT DISTINCT ?entity ?needle`.
- PyOxigraph requires all variables passed in `substitutions` to be present in the query's `SELECT` projection.
- Removed the temporary monkeypatch workaround (`patch_oxigraph_search_projection`) previously present in `tests/test_semantic_graphql.py`.

### 2.2 GraphQL `GraphRelationship` Type Enrichment (Step 2)
- Added 5 provenance fields with sensible defaults to Strawberry `GraphRelationship` type in `api/graphql_schema.py`:
  - `predicate_iri: str | None = None`
  - `predicate_label: str | None = None`
  - `is_inferred: bool = False`
  - `source_graph: str | None = None`
  - `explanation_handle: str | None = None`

### 2.3 `_to_api_relationship()` Mapper Update (Step 3)
- Updated `_to_api_relationship` in `api/graphql_schema.py` to pass through all domain provenance attributes (`predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle`) from `domain.models.GraphRelationship`.
- Cleanly converts empty strings to `None` for optional IRI fields (`predicate_iri=relationship.predicate_iri or None`).

### 2.4 Tests (Step 4)
- Created dedicated test module `tests/test_relationship_provenance.py` covering:
  - Provenance field presence in GraphQL response
  - Inferred vs asserted distinction (using symmetric property reasoning)
  - Sensible defaults on relationships without provenance data
  - Graph expansion relationship provenance passthrough
  - End-to-end search query verifying the DEF-0A-1 SPARQL projection fix
- All existing 117 tests continue to pass without regression.

## 3. Files Created / Modified

| File | Status | Line Count | Changes |
|---|---|---|---|
| `adapters/oxigraph/repository.py` | Modified | 600 lines | +1 / -1 lines: Added `?needle` to `SELECT DISTINCT` projection in `_search` (DEF-0A-1 fix) |
| `api/graphql_schema.py` | Modified | 853 lines | +11 lines: Added 5 provenance fields to `GraphRelationship` and mapped them in `_to_api_relationship` |
| `tests/test_relationship_provenance.py` | Created | 264 lines | +264 lines: 5 new tests for provenance fields, inferred edges, defaults, expansion, and search fix |
| `tests/test_semantic_graphql.py` | Modified | 460 lines | -70 lines: Removed temporary monkeypatch workaround for DEF-0A-1 |
| `docs/batch-reports/batch-0b-report.md` | Created | ~80 lines | Batch completion documentation |

## 4. Tests Added

A new test module `tests/test_relationship_provenance.py` was created containing 5 tests:
1. `test_relationship_provenance_fields_in_graphql_response` — verifies `predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, `explanation_handle` fields appear in GraphQL responses for `get_relationships`.
2. `test_relationship_inferred_vs_asserted_distinction` — verifies `is_inferred` is `True` with `urn:fkg:graph:inferred` for symmetric inferences and `False` with `urn:test:asserted` for asserted edges.
3. `test_relationship_default_values_when_provenance_missing` — verifies relationships without provenance data return sensible defaults (`is_inferred: False`, `source_graph: None`, `predicate_iri: None`, `predicate_label: None`, `explanation_handle: None`).
4. `test_expand_graph_includes_relationship_provenance` — verifies that `expand_graph` includes all provenance fields on expanded relationships.
5. `test_search_end_to_end_without_sparql_projection_error` — verifies `GraphService.search()` executes end-to-end via GraphQL without SPARQL projection errors.

## 5. Defects & Gaps Resolved

- **Gap 2**: Resolved. `GraphRelationship` in GraphQL schema now exposes `predicate_iri`, `predicate_label`, `is_inferred`, `source_graph`, and `explanation_handle`.
- **DEF-0A-1**: Resolved. In `adapters/oxigraph/repository.py:254`, `_search` now projects `SELECT DISTINCT ?entity ?needle`.

## 6. Verification & Test Counts

- **Backend tests:** 122 passed (117 baseline + 5 new)
- **Frontend tests:** 6 passed (Vitest)
- **Frontend build:** Clean (`tsc -b && vite build` passed)
- **Whitespace check:** `git diff --check` clean
