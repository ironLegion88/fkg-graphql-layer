import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { GraphSummary } from './GraphSummary'
import type { GraphEntity, GraphRelationship } from '../interfaces/models'

describe('GraphSummary (AX-004, AX-005)', () => {
  const entityA: GraphEntity = {
    __typename: 'OntologyEntity',
    id: 'wine:Cabernet',
    label: 'Cabernet Sauvignon',
    description: null,
  }

  const entityB: GraphEntity = {
    __typename: 'OntologyEntity',
    id: 'wine:Napa',
    label: 'Napa Valley',
    description: null,
  }

  const sampleRel: GraphRelationship = {
    relation: 'locatedIn',
    source: entityA,
    target: entityB,
    predicate_iri: null,
    predicate_label: null,
    is_inferred: true,
    source_graph: null,
    explanation_handle: null,
  }

  it('renders polite ARIA live region with sr-only styling', () => {
    const html = renderToString(
      <GraphSummary
        nodeCount={5}
        edgeCount={8}
        inferredCount={2}
      />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toContain('sr-only')
    expect(html).toContain('Showing 5 nodes, 8 edges. 2 inferred.')
  })

  it('announces selected entity and view mode', () => {
    const html = renderToString(
      <GraphSummary
        nodeCount={12}
        edgeCount={20}
        inferredCount={4}
        selectedEntity={entityA}
        viewMode="canvas"
      />,
    )

    expect(html).toContain('Selected entity: Cabernet Sauvignon.')
    expect(html).toContain('Current view: graph canvas.')
  })

  it('announces selected relationship with inferred provenance marker', () => {
    const html = renderToString(
      <GraphSummary
        nodeCount={12}
        edgeCount={20}
        inferredCount={4}
        selectedRelationship={sampleRel}
        viewMode="table"
      />,
    )

    expect(html).toContain('Selected relationship: Cabernet Sauvignon locatedIn Napa Valley (inferred).')
    expect(html).toContain('Current view: whole-graph table.')
  })

  it('announces active filters and warnings for limits', () => {
    const html = renderToString(
      <GraphSummary
        nodeCount={500}
        edgeCount={1000}
        inferredCount={120}
        filters={{
          direction: 'OUTGOING',
          includeInferred: false,
          textFilter: 'merlot',
        }}
        limitReached={true}
      />,
    )

    expect(html).toContain('Direction: OUTGOING')
    expect(html).toContain('inferred facts excluded')
    expect(html).toMatch(/search:.*merlot/)
    expect(html).toContain('Warning: visible graph limit reached')
  })

  it('renders visual disclosure when showVisualDisclosure is true', () => {
    const html = renderToString(
      <GraphSummary
        nodeCount={3}
        edgeCount={2}
        inferredCount={1}
        showVisualDisclosure={true}
      />,
    )

    expect(html).toContain('graph-summary-disclosure')
    expect(html).toContain('Graph State Overview')
  })
})
