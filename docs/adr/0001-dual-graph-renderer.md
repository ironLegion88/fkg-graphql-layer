# ADR 0001: Use Separate Detail and Overview Graph Renderers

- **Status:** Accepted
- **Date:** 2026-07-24
- **Decision owners:** Food Knowledge Graph prototype team

## Context

The Graph Explorer currently uses Cytoscape.js for richly styled, interactive
knowledge graph neighborhoods. The underlying Food Knowledge Graph may contain
millions of nodes, raising concern that one browser renderer cannot satisfy both
high-detail exploration and very-large-network overview requirements.

Benchmarks using 1k, 10k, 50k, and 100k nodes showed that Cytoscape remains
appropriate for bounded detail but becomes too slow and memory-heavy for large
visible graphs. cosmos.gl's typed-array/WebGL design remained responsive at the
tested scales but does not provide the same rich semantic UX and accessibility
features without additional engineering.

## Decision

Use two renderer roles behind a renderer-neutral application model:

- **Cytoscape.js** for bounded detail neighborhoods, currently capped at 500
  visible nodes and 1,000 visible edges.
- **cosmos.gl** for a future aggregate/sample overview mode above the detail
  budget.
- **Relationship table/list** as the accessible, renderer-independent source of
  graph relationship detail.

The GraphQL API remains the only data source for both modes. Neither renderer
may parse OWL files or receive an unbounded graph dump.

## Consequences

### Positive

- Retains mature Cytoscape detail interaction and styling.
- Provides a measured path to large-network overview rendering.
- Prevents GPU rendering capability from weakening server-side graph limits.
- Renderer-neutral state reduces future vendor lock-in.
- Accessibility remains independent of canvas/WebGL rendering.

### Negative

- Two renderer adapters require additional integration and testing.
- Overview/detail transitions need explicit UX and GraphQL operations.
- cosmos.gl adds approximately 4.3 MB unpacked dependency size and benchmark
  chunks for WebGL support.
- GPU capability detection and fallback behavior are required.
- Labels and rich semantics in overview mode require separate overlays or
  sampled labeling.

## Rejected Alternatives

### Cytoscape for every scale

Rejected because the 50k and 100k fixtures produced multi-second initialization,
poor interaction latency, and high heap usage even with minimal styling.

### Replace Cytoscape entirely with cosmos.gl

Rejected because current user workflows prioritize labelled edges, typed node
styles, detailed selection, and accessible synchronization at small bounded
scales. Rebuilding all detail UX on the lower-level renderer is not justified.

### Render the complete knowledge graph

Rejected regardless of renderer. Million-node node-link diagrams are not a
usable research interface without filtering, aggregation, sampling, and
progressive exploration.

### OWL-specific visualizer as the instance explorer

Rejected because tools such as WebVOWL visualize ontology schema, not large
instance-level graph neighborhoods.

## Validation

See [Graph Renderer Benchmark](../benchmarks/renderer-benchmark.md) and raw
[benchmark results](../../benchmarks/renderer-results-2026-07-24.json).

This decision should be revisited after the cosmos overview component is tested
with representative Food Knowledge Graph clusters and on target deployment
hardware.