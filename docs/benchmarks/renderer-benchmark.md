# Graph Renderer Benchmark

- **Date:** 2026-07-24
- **Renderers:** Cytoscape.js 3.34.0 and cosmos.gl 3.3.0
- **Decision:** Use Cytoscape for bounded detail and cosmos.gl for a future overview

## Purpose

Measure whether the current Cytoscape renderer can support large visible graphs
and establish when a GPU renderer is justified. This benchmark does not change
the product requirement that users should explore bounded, meaningful
neighborhoods rather than million-node hairballs.

## Fixture

- Deterministic grid positions; renderer layout/simulation disabled.
- Two edges per node.
- Minimal point and edge styles.
- No labels, icons, arrows, or rich detail styling.
- One browser run per renderer/size pair.
- Initialization includes renderer construction, element upload, preset layout,
  and two animation frames.
- Interaction dispatches one wheel zoom event and waits two frames.

The route is reproducible with:

```text
http://127.0.0.1:5173/?benchmark=1&renderer=cytoscape&nodes=10000&edges=20000
http://127.0.0.1:5173/?benchmark=1&renderer=cosmos&nodes=10000&edges=20000
```

Results are exposed at `window.__GRAPH_BENCHMARK__`.

## Environment

| Property | Value |
| --- | --- |
| Logical processors | 12 |
| Reported device memory | 16 GB |
| JavaScript heap limit | 4 GB |
| GPU | Intel Iris Xe Graphics |
| Browser | VS Code Electron 42.6 / Chrome 148 |

## Results

| Renderer | Nodes | Edges | Initialization (ms) | Interaction (ms) | Reported heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cytoscape | 1,000 | 2,000 | 216.9 | 39.4 | 96 MB |
| cosmos.gl | 1,000 | 2,000 | 91.1 | 33.2 | 91 MB |
| Cytoscape | 10,000 | 20,000 | 1,066.6 | 52.5 | 238 MB |
| cosmos.gl | 10,000 | 20,000 | 57.3 | 34.2 | 193 MB |
| Cytoscape | 50,000 | 100,000 | 4,769.4 | 1,266.7 | 961 MB |
| cosmos.gl | 50,000 | 100,000 | 62.0 | 33.6 | 652 MB |
| Cytoscape | 100,000 | 200,000 | 10,288.0 | 580.9 | 1.55 GB |
| cosmos.gl | 100,000 | 200,000 | 80.3 | 33.5 | 1.04 GB |

## Interpretation

### Cytoscape

- Appropriate for the current rich detail workflow capped at 500 nodes and
  1,000 edges.
- At 10k nodes, initialization exceeded one second even without labels or rich
  styles.
- At 50k, interaction exceeded one second and heap approached one gigabyte.
- At 100k, initialization exceeded ten seconds and heap exceeded 1.5 GB.
- Production labels, arrows, selection styles, and layout work would increase
  these costs.

### cosmos.gl

- Initialization remained below 100 ms for every measured fixture.
- Interaction remained near two animation frames at all tested sizes.
- Typed-array and WebGL architecture used less reported heap than Cytoscape,
  though the 100k fixture still exceeded one gigabyte in the shared browser
  process.
- It is a lower-level renderer: labels, accessibility, semantic selection,
  detail panels, and graph-state integration remain application work.

## Decision

Adopt a dual-renderer architecture:

1. **Cytoscape detail view** remains the default Graph Explorer renderer for
   bounded neighborhoods up to the current 500-node/1,000-edge hard cap.
2. **cosmos.gl overview view** may be added for aggregated or sampled graphs
   above the detail budget, after its renderer adapter and accessibility
   companion table are implemented.
3. The overview must not receive an unbounded database dump. Server-side
   sampling, clustering, aggregation, or explicit result limits still apply.
4. Switching from overview to detail should issue a new bounded GraphQL
   expansion centered on the selected cluster/entity.

## Caveats

- Results are single local observations, not statistically robust production
  capacity guarantees.
- Heap values come from one browser process and may include retained allocations
  from previous navigations.
- Preset positions exclude force-layout cost. This favors both renderers and is
  intentional: large production layouts should be precomputed or GPU-backed.
- Wheel interaction measures event-to-two-frames latency, not sustained FPS.
- No labels were rendered. Cytoscape's production detail styling is more
  expensive than this benchmark style.
- cosmos.gl requires WebGL 2 and compatible GPU features; a Cytoscape/list
  fallback remains necessary.

## Follow-Up

- Define a renderer interface shared by Cytoscape and cosmos.gl.
- Add server-side aggregate/sample GraphQL output for overview mode.
- Implement a time-boxed cosmos overview component.
- Add repeated benchmark runs and sustained FPS sampling.
- Validate integrated/discrete GPU, mobile, and accessibility fallbacks.
- Preserve the relationship table as the authoritative non-visual view.

Raw evidence is stored in
[`benchmarks/renderer-results-2026-07-24.json`](../../benchmarks/renderer-results-2026-07-24.json).