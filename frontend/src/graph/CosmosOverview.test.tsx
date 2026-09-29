import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import CosmosOverview from './CosmosOverview'
import { OverviewErrorBoundary } from './LazyCosmosOverview'
import type { OverviewData } from '../interfaces/models'

// Mock @cosmos.gl/graph if running in node/headless environment
vi.mock('@cosmos.gl/graph', () => {
  return {
    Graph: vi.fn().mockImplementation(() => ({
      render: vi.fn(),
      destroy: vi.fn(),
      getZoomLevel: vi.fn().mockReturnValue(1),
      setZoomLevel: vi.fn(),
      fitView: vi.fn(),
      zoomToPointByIndex: vi.fn(),
    })),
  }
})

describe('CosmosOverview Component (RC-003, RC-004, RC-005, RC-009)', () => {
  const mockOverviewData: OverviewData = {
    clusters: [
      {
        class_iri: 'http://example.org/wine#Wine',
        label: 'Wine',
        instance_count: 85,
        color: '#b83c50',
      },
      {
        class_iri: 'http://example.org/wine#Winery',
        label: 'Winery',
        instance_count: 42,
        color: '#d7972f',
      },
      {
        class_iri: 'http://example.org/wine#Region',
        label: 'Region',
        instance_count: 18,
        color: '#4a82b0',
      },
    ],
    edges: [
      {
        source_class: 'http://example.org/wine#Wine',
        target_class: 'http://example.org/wine#Winery',
        predicate: 'hasMaker',
        count: 70,
      },
    ],
    total_instances: 145,
    total_relationships: 70,
  }

  it('renders overview container with stats header (RC-003)', () => {
    const html = renderToString(
      <CosmosOverview
        overviewData={mockOverviewData}
        selectedClusterIri={null}
        onSelectCluster={vi.fn()}
      />,
    )

    expect(html).toContain('cosmos-overview-wrapper')
    expect(html).toContain('GPU Overview')
    expect(html).toContain('3</strong> classes')
    expect(html).toContain('145</strong> instances')
    expect(html).toContain('70</strong> relationships')
  })

  it('renders cluster pills with instance counts and colors (RC-004, RC-009)', () => {
    const html = renderToString(
      <CosmosOverview
        overviewData={mockOverviewData}
        selectedClusterIri={null}
        onSelectCluster={vi.fn()}
      />,
    )

    expect(html).toContain('Wine')
    expect(html).toContain('85')
    expect(html).toContain('Winery')
    expect(html).toContain('42')
    expect(html).toContain('Region')
    expect(html).toContain('18')
    expect(html).toContain('placeholder="Find class cluster..."')
  })

  it('renders selected cluster card with drill-down button (RC-005)', () => {
    const html = renderToString(
      <CosmosOverview
        overviewData={mockOverviewData}
        selectedClusterIri="http://example.org/wine#Wine"
        onSelectCluster={vi.fn()}
        onDrillDown={vi.fn()}
      />,
    )

    expect(html).toContain('data-testid="cosmos-selected-cluster"')
    expect(html).toContain('Wine')
    expect(html).toContain('85')
    expect(html).toContain('data-testid="drilldown-button"')
    expect(html).toContain('Drill down to Detail')
  })

  it('supports category color overrides when cluster color is null (RC-009)', () => {
    const customData: OverviewData = {
      ...mockOverviewData,
      clusters: [
        {
          class_iri: 'http://example.org/wine#Wine',
          label: 'Wine',
          instance_count: 85,
          color: null,
        },
      ],
    }

    const categoryColors: Record<string, string> = {
      Wine: '#ff0055',
    }

    const html = renderToString(
      <CosmosOverview
        overviewData={customData}
        selectedClusterIri={null}
        categoryColors={categoryColors}
        onSelectCluster={vi.fn()}
      />,
    )

    expect(html).toContain('background-color:#ff0055')
  })

  it('renders empty clusters notice when no classes exist', () => {
    const emptyData: OverviewData = {
      clusters: [],
      edges: [],
      total_instances: 0,
      total_relationships: 0,
    }

    const html = renderToString(
      <CosmosOverview
        overviewData={emptyData}
        selectedClusterIri={null}
        onSelectCluster={vi.fn()}
      />,
    )

    expect(html).toContain('No ontology classes found for overview visualization.')
  })
})

describe('LazyCosmosOverview and ErrorBoundary (NF-008, AC-111)', () => {
  it('renders children content normally when error boundary has no error', () => {
    const html = renderToString(
      <OverviewErrorBoundary fallback={() => <div>Fallback Active</div>}>
        <div className="test-child">Child Content</div>
      </OverviewErrorBoundary>,
    )

    expect(html).toContain('Child Content')
    expect(html).not.toContain('Fallback Active')
  })

  it('computes error state via getDerivedStateFromError', () => {
    const testError = new Error('WebGL 2 device initialization failed')
    const state = OverviewErrorBoundary.getDerivedStateFromError(testError)
    expect(state.hasError).toBe(true)
    expect(state.error).toBe(testError)
  })

  it('renders fallback output when boundary is in error state', () => {
    const boundary = new OverviewErrorBoundary({
      children: <div>Child</div>,
      fallback: (err) => <div className="error-fallback">{err.message}</div>,
    })
    boundary.state = {
      hasError: true,
      error: new Error('WebGL context lost'),
    }

    const rendered = boundary.render()
    const html = renderToString(rendered as React.ReactElement)
    expect(html).toContain('WebGL context lost')
    expect(html).toContain('error-fallback')
  })
})
