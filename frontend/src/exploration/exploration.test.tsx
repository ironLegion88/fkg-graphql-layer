import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PathBuilder } from './PathBuilder'
import { EntityComparison } from './EntityComparison'
import { ExplanationPanel } from './ExplanationPanel'
import type {
  ComparisonResult,
  GraphEntity,
  GraphRelationship,
  PathResult,
} from '../interfaces/models'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

describe('PathBuilder Component (UW-004, GQ-109, GQ-110, AC-108)', () => {
  const availableEntities: GraphEntity[] = [
    {
      __typename: 'Wine',
      id: 'wine:ChateauMargaux',
      label: 'Château Margaux',
      description: 'Premier Grand Cru Classé',
    },
    {
      __typename: 'Region',
      id: 'wine:BordeauxRegion',
      label: 'Bordeaux Region',
      description: 'Famous French wine region',
    },
    {
      __typename: 'Grape',
      id: 'wine:CabernetSauvignon',
      label: 'Cabernet Sauvignon',
      description: 'Red grape variety',
    },
  ]

  it('renders initial state with source and target selectors', () => {
    const html = renderToString(
      <PathBuilder
        visibleEntities={availableEntities}
        onSelectEntity={vi.fn()}
      />
    )

    expect(html).toContain('Path Builder')
    expect(html).toContain('Source Entity (Start)')
    expect(html).toContain('Target Entity (Goal)')
    expect(html).toContain('Find Path')
  })

  it('renders FOUND outcome with path sequence and tree (AC-108)', () => {
    const foundResult: PathResult = {
      status: 'FOUND',
      path: {
        entities: [
          availableEntities[0],
          availableEntities[1],
        ],
        relations: ['locatedIn'],
      },
      visited_nodes: 12,
    }

    const html = renderToString(
      <PathBuilder
        initialSourceId="wine:ChateauMargaux"
        initialTargetId="wine:BordeauxRegion"
        initialPathResult={foundResult}
        visibleEntities={availableEntities}
        onHighlightPath={vi.fn()}
      />
    )

    expect(html).toContain('Path Discovered')
    expect(html).toContain('hops')
    expect(html).toContain('nodes')
    expect(html).toContain('Château Margaux')
    expect(html).toContain('Bordeaux Region')
    expect(html).toContain('locatedIn')
    expect(html).toContain('Highlight on Canvas')
    expect(html).toContain('role="tree"')
  })

  it('renders NO_PATH outcome with warning banner (AC-108)', () => {
    const noPathResult: PathResult = {
      status: 'NO_PATH',
      path: null,
      visited_nodes: 45,
    }

    const html = renderToString(
      <PathBuilder
        initialSourceId="wine:ChateauMargaux"
        initialTargetId="wine:CabernetSauvignon"
        initialPathResult={noPathResult}
        visibleEntities={availableEntities}
      />
    )

    expect(html).toContain('No Path Found')
    expect(html).toContain('No connecting path exists between')
    expect(html).toContain('within the configured traversal limits')
  })

  it('renders TIMEOUT outcome with caution notice (AC-108)', () => {
    const timeoutResult: PathResult = {
      status: 'TIMEOUT',
      path: null,
      visited_nodes: 500,
    }

    const html = renderToString(
      <PathBuilder
        initialSourceId="wine:ChateauMargaux"
        initialTargetId="wine:CabernetSauvignon"
        initialPathResult={timeoutResult}
        visibleEntities={availableEntities}
      />
    )

    expect(html).toContain('Path Search Timed Out')
    expect(html).toContain('The traversal query timed out after visiting')
    expect(html).toContain('nodes')
  })

  it('renders BUDGET_EXHAUSTED outcome with guidance (AC-108)', () => {
    const budgetResult: PathResult = {
      status: 'BUDGET_EXHAUSTED',
      path: null,
      visited_nodes: 1000,
    }

    const html = renderToString(
      <PathBuilder
        initialSourceId="wine:ChateauMargaux"
        initialTargetId="wine:CabernetSauvignon"
        initialPathResult={budgetResult}
        visibleEntities={availableEntities}
      />
    )

    expect(html).toContain('Search Budget Exhausted')
    expect(html).toContain('Search stopped because the node budget was reached')
    expect(html).toContain('nodes')
  })

  it('renders loading state when path search is in progress', () => {
    const html = renderToString(
      <PathBuilder
        initialSourceId="wine:ChateauMargaux"
        initialTargetId="wine:BordeauxRegion"
        initialLoading={true}
        visibleEntities={availableEntities}
      />
    )

    expect(html).toContain('Traversing graph to find shortest path')
    expect(html).toContain('aria-live="polite"')
  })
})

describe('EntityComparison Component (UW-005, GQ-111, AC-107)', () => {
  const pinnedEntities: GraphEntity[] = [
    {
      __typename: 'Wine',
      id: 'wine:ChateauMargaux',
      label: 'Château Margaux',
      description: 'Premier Grand Cru Classé',
    },
    {
      __typename: 'Wine',
      id: 'wine:ChateauLatour',
      label: 'Château Latour',
      description: 'Premier Grand Cru Pauillac',
    },
  ]

  const mockComparisonResult: ComparisonResult = {
    common_types: ['wine:RedWine', 'wine:BordeauxWine'],
    unique_types_a: ['wine:MargauxAppellation'],
    unique_types_b: ['wine:PauillacAppellation'],
    common_properties: ['wine:hasMaker', 'wine:hasVintageYear'],
    unique_properties_a: ['wine:hasChateauDirector'],
    unique_properties_b: ['wine:hasTowerHistory'],
    shared_neighbors: [
      {
        __typename: 'Region',
        id: 'wine:Bordeaux',
        label: 'Bordeaux Region',
        description: null,
      },
    ],
  }

  it('renders notice when fewer than 2 entities are pinned', () => {
    const html = renderToString(
      <EntityComparison
        pinnedEntities={[pinnedEntities[0]]}
        onUnpinEntity={vi.fn()}
      />
    )

    expect(html).toContain('Pinned for Comparison (<!-- -->1<!-- -->)')
    expect(html).toContain('Entity A')
  })

  it('renders side-by-side diff with shared and unique types and properties (AC-107)', () => {
    const html = renderToString(
      <EntityComparison
        pinnedEntities={pinnedEntities}
        initialComparisonResult={mockComparisonResult}
        onUnpinEntity={vi.fn()}
      />
    )

    expect(html).toContain('Entity Comparison')
    expect(html).toContain('Compare Entities')
    // Section headers
    expect(html).toContain('Types &amp; Classes')
    expect(html).toContain('Properties &amp; Predicates')
    expect(html).toContain('Shared Neighbors')
    // Shared and unique tags
    expect(html).toContain('Shared (<!-- -->2<!-- -->)')
    expect(html).toContain('Unique to')
    expect(html).toContain('Château Margaux')
    expect(html).toContain('Château Latour')
    // Displayed types and properties
    expect(html).toContain('RedWine')
    expect(html).toContain('BordeauxWine')
    expect(html).toContain('hasMaker')
    expect(html).toContain('hasChateauDirector')
    expect(html).toContain('hasTowerHistory')
    // Shared neighbors
    expect(html).toContain('Bordeaux Region')
  })

  it('renders tree hierarchy mode when requested', () => {
    const html = renderToString(
      <EntityComparison
        pinnedEntities={pinnedEntities}
        initialComparisonResult={mockComparisonResult}
        initialMode="tree"
        onUnpinEntity={vi.fn()}
      />
    )

    expect(html).toContain('role="tree"')
  })

  it('renders loading state during comparison fetch', () => {
    const html = renderToString(
      <EntityComparison
        pinnedEntities={pinnedEntities}
        initialLoading={true}
        onUnpinEntity={vi.fn()}
      />
    )

    expect(html).toContain('Analyzing common and unique types')
    expect(html).toContain('aria-live="polite"')
  })
})

describe('ExplanationPanel Component (UW-006, GQ-112, GE-013)', () => {
  const mockRelationship: GraphRelationship = {
    relation: 'subClassOf',
    source: {
      __typename: 'Wine',
      id: 'wine:ChateauMargaux',
      label: 'Château Margaux',
      description: null,
    },
    target: {
      __typename: 'Wine',
      id: 'wine:FrenchWine',
      label: 'French Wine',
      description: null,
    },
    predicate_iri: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
    predicate_label: 'subClassOf',
    is_inferred: true,
    source_graph: 'urn:fkg:graph:inferred',
    explanation_handle: 'proof_handle_abc',
  }

  it('renders explanation panel dialog with relationship details', () => {
    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ExplanationPanel
          isOpen={true}
          handle="proof_handle_abc"
          relationship={mockRelationship}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(html).toContain('Inference Justification')
    expect(html).toContain('subClassOf')
    expect(html).toContain('Château Margaux')
    expect(html).toContain('French Wine')
    expect(html).toContain('proof_handle_abc')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-labelledby="explanation-dialog-title"')
  })

  it('renders not available state gracefully when backend returns available=false (UW-006, GQ-112)', () => {
    const queryClient = createTestQueryClient()
    // Pre-populate query cache with unavailable result
    queryClient.setQueryData(['explanation', 'proof_handle_abc'], {
      available: false,
      proof_steps: [],
      reasoner: null,
      message: 'Explanation service is not yet available. The inference was produced by the configured reasoner.',
    })

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ExplanationPanel
          isOpen={true}
          handle="proof_handle_abc"
          relationship={mockRelationship}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(html).toContain('Explanation Not Available')
    expect(html).toContain('Explanation service is not yet available')
    expect(html).toContain('Offline HermiT Reasoner')
  })

  it('renders proof steps when available=true', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['explanation', 'proof_handle_xyz'], {
      available: true,
      proof_steps: [
        'Château Margaux rdf:type MargauxRegionWine',
        'MargauxRegionWine rdfs:subClassOf BordeauxWine',
        'Therefore, Château Margaux rdf:type BordeauxWine',
      ],
      reasoner: 'HermiT 1.4.3',
      message: null,
    })

    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ExplanationPanel
          isOpen={true}
          handle="proof_handle_xyz"
          relationship={mockRelationship}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(html).toContain('HermiT 1.4.3')
    expect(html).toContain('Deduction Steps')
    expect(html).toContain('role="tree"')
    expect(html).toContain('MargauxRegionWine')
  })

  it('returns null when isOpen is false', () => {
    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ExplanationPanel
          isOpen={false}
          handle="proof_handle_abc"
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    )

    expect(html).toBe('')
  })
})
