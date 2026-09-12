# Architecture Decision Record: OWL 2 DL Reasoner Selection

## Status
Accepted

## Context
The Ontology Explorer requires an offline OWL 2 DL reasoning pipeline to:
1. Classify the ontology (infer class hierarchy).
2. Perform realization (infer individual types).
3. Check consistency.
4. Export materialized facts to be stored alongside the asserted graph.
5. Provide justification/explanations for inferences when supported.

We need to select a reasoning engine to fulfill the `ReasoningProvider` interface as part of the ingestion build.

Candidates evaluated:
1. **HermiT via `owlready2`**: HermiT is a standard, robust OWL 2 DL reasoner. `owlready2` is a Python package that natively wraps HermiT and Pellet, abstracting away the Java `.jar` execution and providing a Pythonic API to interact with the reasoner and its results.
2. **ELK**: A very fast reasoner, but it only supports the OWL 2 EL profile. It does not support full OWL 2 DL (e.g., value restrictions, inverse properties), which our requirements mandate.
3. **External Subprocess (ROBOT / standalone Java command)**: Wrapping the `robot` CLI tool or a standalone Java process for a reasoner. While effective, parsing the output and extracting fine-grained explanations and granular materialization mappings requires complex text scraping and intermediate file handling.

## Decision
We will use **HermiT via the `owlready2` package** as the default `ReasoningProvider`.

### Rationale
- **Full OWL 2 DL Support**: HermiT handles full OWL 2 DL, meeting requirements for inverse properties, class equivalence, and disjointness.
- **Python Integration**: `owlready2` allows us to load the ontology, run the reasoner, and inspect inferred classes, individuals, and properties directly in Python without manual RDF parsing of intermediate stdout.
- **Explanation Support**: HermiT provides justifications/explanations (inconsistent class explanations, entailment justifications) which are required for `EXPLANATION_UNAVAILABLE` or actual explanations. `owlready2` can access these.
- **Execution Control**: We can run the reasoning process in a constrained Python thread/subprocess, enforcing timeouts and memory limits securely.

### Trade-offs & Limitations
- **JVM Requirement**: HermiT requires a Java Virtual Machine (JVM) to be installed on the operator's environment to execute. This is acceptable for an offline ingestion pipeline.
- **Performance**: Full OWL 2 DL reasoning is computationally expensive (NEXPTIME). We will mitigate this by enforcing strict limits (timeouts, memory bounds) during the offline store build.
- **owlready2 Memory Profile**: Loading large RDF graphs into `owlready2` duplicates memory (since we also load it into Oxigraph). For massive ontologies, this might require batching or externalizing the reasoner process completely, but for our supported bounded sizes (like Wine and Pizza), it is well within reasonable bounds.

## Consequences
- Operator environments running the build pipeline must have Java installed.
- We will add `owlready2` to the project's dependencies.
- We will implement a `HermitProvider` conforming to `ReasoningProvider` which delegates to `owlready2.sync_reasoner`.
- For Explanation artifacts, we will explore `owlready2`'s capabilities or fallback to `EXPLANATION_UNAVAILABLE` gracefully.
