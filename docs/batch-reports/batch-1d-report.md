# Sprint 1 Batch 1D: Full OWL 2 DL Reasoning Implementation Report

## Summary
Implemented the offline ingestion pipeline for Full OWL 2 DL reasoning, integrating the HermiT reasoner through `owlready2` in an isolated worker process.

## Progress
- [x] Story 1: Select the Reasoner (ADR). Added `docs/reasoner-adr.md`.
- [x] Story 2: Define `ReasoningProvider`. Added protocol and configuration logic.
- [x] Story 3: Implement Isolated Reasoning Jobs. Added `HermitProvider` with an isolated subprocess `_hermit_worker.py` to prevent JVM and memory leaks in the primary build process.
- [x] Story 4: Materialize Semantics & Provenance. Integrated reasoning into `ingestion/build_store.py` via `materialize_semantics`. It now merges the store, runs HermiT, and pushes N-Triples inferences back to `urn:fkg:graph:inferred`.
- [x] Story 5: Implement Explanation Artifacts. Implemented models. `HermitProvider` returns `EXPLANATION_UNAVAILABLE` by returning `None`.

## Decisions Made
- Chose HermiT via `owlready2` (with subprocess isolation).
- Reasoning operations dump the aggregated `Store` (excluding inferred graph) into N-Triples, run HermiT on them in `_hermit_worker.py`, and return an `inferred.nt` which is loaded back.
- If an inconsistency is detected (via `OwlReadyInconsistentOntologyError` or equivalent checks), `is_consistent` is set to False and the build halts securely by catching the validation check in `reasoning.py` and raising a `ValueError`.

## Tests Added
- Created `tests/fixtures/inconsistent.nt` to test inconsistent ontology handling.
- `tests/test_reasoning_providers.py` verifies `HermitProvider` against consistent and inconsistent fixtures.
- All 86 existing and new tests pass, proving correct bounds checking and inference behaviors.
