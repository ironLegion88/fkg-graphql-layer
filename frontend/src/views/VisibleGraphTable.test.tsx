import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { VisibleGraphTable } from './VisibleGraphTable'
import type { ExplorerGraph } from '../graph/state'
import type { GraphEntity, GraphRelationship } from '../interfaces/models'

const wineEntity: GraphEntity = {
  __typename: 'OntologyEntity',
  id: 'http://example.org/wine#Chardonnay',
  label: 'Chardonnay',
  description: 'A popular white wine grape',
  kind: 'Class',
}

const wineryEntity: GraphEntity = {
  __typename: 'OntologyEntity',
  id: 'http://example.org/wine#Corbans',
  label: 'Corbans',
  description: 'A New Zealand winery',
  kind: 'Individual',
}

const regionEntity: GraphEntity = {
  __typename: 'OntologyEntity',
  id: 'http://example.org/wine#Marlborough',
  label: 'Marlborough',
  description: 'Wine region in NZ',
  kind: 'Individual',
}

const rel1: GraphRelationship = {
  relation: 'hasMaker',
  source: wineEntity,
  target: wineryEntity,
  predicate_iri: 'http://example.org/wine#hasMaker',
  predicate_label: 'has maker',
  is_inferred: false,
  source_graph: 'http://example.org/wine-graph',
  explanation_handle: null,
}

const rel2: GraphRelationship = {
  relation: 'locatedIn',
  source: wineryEntity,
  target: regionEntity,
  predicate_iri: 'http://example.org/wine#locatedIn',
  predicate_label: 'located in',
  is_inferred: true,
  source_graph: 'http://example.org/inferred-graph',
  explanation_handle: 'expl_123',
}

const mockGraph: ExplorerGraph = {
  entities: {
    [wineEntity.id]: wineEntity,
    [wineryEntity.id]: wineryEntity,
    [regionEntity.id]: regionEntity,
  },
  relationships: {
    [`${rel1.source.id}|${rel1.relation}|${rel1.target.id}`]: rel1,
    [`${rel2.source.id}|${rel2.relation}|${rel2.target.id}`]: rel2,
  },
}

describe('VisibleGraphTable (GE-008, AX-002, AX-005)', () => {
  it('renders all visible relationships matching current graph state', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={mockGraph}
        onSelectEntity={vi.fn()}
      />,
    )

    // Table header columns
    expect(html).toContain('Source Entity')
    expect(html).toContain('Predicate')
    expect(html).toContain('Target Entity')
    expect(html).toContain('Dir')
    expect(html).toContain('Origin')
    expect(html).toContain('Source Graph')
    expect(html).toContain('Actions')

    // Rows content
    expect(html).toContain('Chardonnay')
    expect(html).toContain('has maker')
    expect(html).toContain('Corbans')
    expect(html).toContain('located in')
    expect(html).toContain('Marlborough')

    // Status summary
    expect(html).toMatch(/Showing.*2.*of.*2.*relationships/)
  })

  it('displays non-color semantic cues for asserted and inferred facts (AX-003, AC-106)', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={mockGraph}
        onSelectEntity={vi.fn()}
      />,
    )

    // Asserted cue with text label and solid border style
    expect(html).toContain('asserted-cue')
    expect(html).toContain('Asserted')

    // Inferred cue with text label and dashed border style
    expect(html).toContain('inferred-cue')
    expect(html).toContain('Inferred')
  })

  it('renders filter controls and search input (GE-008)', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={mockGraph}
        onSelectEntity={vi.fn()}
      />,
    )

    expect(html).toContain('Filter entities, predicates, graphs...')
    expect(html).toMatch(/All predicates.*2/)
    expect(html).toContain('hasMaker')
    expect(html).toContain('locatedIn')
    expect(html).toContain('All (Asserted &amp; Inferred)')
    expect(html).toContain('Asserted only (✓)')
    expect(html).toContain('Inferred only (⚡)')
  })

  it('indicates selected relationship row with row-selected class and aria-selected', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={mockGraph}
        selectedRelationship={rel1}
        onSelectEntity={vi.fn()}
      />,
    )

    expect(html).toContain('row-selected')
    expect(html).toContain('aria-selected="true"')
  })

  it('renders action buttons for inspecting, expanding, and removing', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={mockGraph}
        onSelectEntity={vi.fn()}
        onExpandEntity={vi.fn()}
        onRemoveRelationship={vi.fn()}
      />,
    )

    expect(html).toContain('Inspect Chardonnay')
    expect(html).toContain('Expand Corbans')
    expect(html).toContain('Remove relationship hasMaker')
  })

  it('renders accessible empty state when no relationships exist', () => {
    const emptyGraphState: ExplorerGraph = {
      entities: {},
      relationships: {},
    }

    const html = renderToString(
      <VisibleGraphTable
        graph={emptyGraphState}
        onSelectEntity={vi.fn()}
      />,
    )

    expect(html).toContain('No relationships visible in graph')
    expect(html).toContain('Search or select an entity from the navigation panel')
  })
})
