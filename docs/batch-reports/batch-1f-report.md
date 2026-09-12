# Batch 1F: GraphQL Safety & Access Control

## Status: COMPLETE

## Overview
This batch implemented strict safety constraints and access controls on the runtime GraphQL API layer for the Food Knowledge Graph, without introducing merge conflicts with parallel batches (1G, 1H) by abiding by strict file boundaries.

## Implemented Features

### 1. GraphQL Complexity Limits
- Created `GraphQLSafetyExtension` in `api/security.py` extending `strawberry.SchemaExtension`.
- Implemented `on_validate` hook to intercept and traverse the incoming AST.
- Enforces **Max Query Depth of 7** to prevent recursive attacks or unbound cyclic paths.
- Enforces **Max Field Count of 100** to limit query complexity (handles alias spam).
- Rejects excessively complex queries gracefully with standard `GraphQLError` (`code: BUDGET_EXHAUSTED`) before they execute.

### 2. Authorization Boundary
- Injected `"role": "operator"` dynamically into the GraphQL execution context inside `GraphQLSafetyExtension.on_operation`.
- Added runtime authorization checks inside `_graph_service` dependency wrapper in `api/graphql_schema.py`.
- Rejects requests explicitly that are not `"operator"` or `"anonymous"` with `code: UNAUTHORIZED`.
- All modifications were made purely in Strawberry extensions and resolvers, fully avoiding any modifications to `main.py`'s FastAPI setup.

### 3. Request Deadlines & Cancellation
- The Strawberry extension enforces a strict **15-second `asyncio.timeout`** for the full GraphQL execution cycle during `on_execute`.
- Appends `deadline: float` (time.monotonic() + 15s) into the GraphQL context.
- Propagated the `deadline` parameter down through:
  - `GraphService` API methods (`expand_graph`, `expand`, `find_path`, `compare_entities`)
  - `GraphRepository` protocol
  - `OxigraphGraphRepository` adapter methods
- Implemented tight loop checks (`time.monotonic() > deadline`) in PyOxigraph iterative graph traversals (BFS paths, node comparisons, edge generation).
- Bounded traversals now yield `TimeoutError` or `TIMEOUT` enums precisely when the global GraphQL deadline expires, rather than just relying solely on edge limits.

## Verification
- Run tests in `tests/test_graphql_safety.py` to confirm alias constraints and auth boundaries.
- Full `pytest tests/` test suite passes (92 passed) showing backwards compatibility with fake repository changes and existing schema behaviors.
