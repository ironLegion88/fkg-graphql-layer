# Sprint 1 Batch 1H: Frontend Contracts & CI Report

## Overview
This document records the work done for Sprint 1 Batch 1H (Frontend Contracts & CI). The batch focuses on creating shared packages, defining renderer and provider contracts, expanding test fixtures, and setting up CI gates.

## Story 1: Create Shared Packages
Extracted shared TS interfaces for the GraphQL client, stable error handling, and ontology metadata models.

## Story 2: Define Renderer & Provider Contracts
Created TypeScript interfaces in `frontend/src/interfaces/`:
- `DetailGraphRenderer`: For bounded rich neighborhoods (implemented by `CytoscapeGraph`).
- `OverviewGraphRenderer`: For aggregate/sample graphs.
- `OntologyDataProvider`: For class/property/individual metadata and bounded navigation.

## Story 3: Expand Conformance Fixtures
Added additional RDF fixtures to `tests/fixtures/` covering edge cases like dense axioms, unsupported datatypes, and deep hierarchies. Added a simple parser loading script to ensure they are valid.

## Story 4: Add CI Gates
Created `.github/workflows/ci.yml` that runs:
- Python linting (`ruff` or `flake8`)
- Backend tests (`pytest`)
- Frontend tests (`npm test`)
- Frontend build (`npm run build`)
