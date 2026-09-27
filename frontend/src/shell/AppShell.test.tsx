import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppShell } from './AppShell'
import type { ActiveProfile } from '../interfaces/models'

describe('AppShell Component', () => {
  const mockProfile: ActiveProfile = {
    metadata: {
      package_id: 'wine-ontology',
      version: '2.1.0',
      title: 'Wine Knowledge Graph',
      description: 'Comprehensive ontology of wines and regions',
      ontology_iris: ['http://example.org/wine'],
    },
    prefixes: [{ prefix: 'wine', iri: 'http://example.org/wine#' }],
    categories: [
      { name: 'Wine', class_iris: [], color: '#b83c50', icon: null, label: 'Wine' },
      { name: 'Winery', class_iris: [], color: '#d7972f', icon: null, label: 'Winery' },
    ],
    predicates: [
      { name: 'hasMaker', iri: null, label: 'has maker', traversable: true, hidden: false },
    ],
    limits: { max_depth: 3, max_nodes: 500, max_edges: 1000 },
    languages: { preferred_languages: ['en', 'fr'] },
    reasoning_profile: 'hermit',
    build_id: 'bld_wine_987654321',
  }

  it('renders three panels and header with profile metadata', () => {
    const html = renderToString(
      <AppShell
        profile={mockProfile}
        nodeCount={42}
        edgeCount={87}
        navigationContent={<div data-testid="nav-content">Nav Panel</div>}
        canvasContent={<div data-testid="canvas-content">Canvas Area</div>}
        inspectorContent={<div data-testid="inspector-content">Inspector Details</div>}
      />,
    )

    // Panels
    expect(html).toContain('nav-panel')
    expect(html).toContain('canvas-panel-wrapper')
    expect(html).toContain('inspector-panel')
    expect(html).toContain('Nav Panel')
    expect(html).toContain('Canvas Area')
    expect(html).toContain('Inspector Details')

    // Header metadata
    expect(html).toContain('Wine Knowledge Graph')
    expect(html).toContain('2.1.0')
    expect(html).toContain('bld_wine')
    expect(html).toContain('hermit')
    expect(html).toContain('42')
    expect(html).toContain('nodes')
    expect(html).toContain('87')
    expect(html).toContain('edges')
  })

  it('renders loading state when isLoading is true', () => {
    const html = renderToString(
      <AppShell
        isLoading={true}
        nodeCount={0}
        edgeCount={0}
        navigationContent={<div>Nav</div>}
        canvasContent={<div>Canvas</div>}
        inspectorContent={<div>Inspector</div>}
      />,
    )

    expect(html).toContain('shell-loading')
    expect(html).toContain('Loading Knowledge Graph')
    expect(html).not.toContain('inspector-panel')
  })

  it('renders error state when error is provided', () => {
    const html = renderToString(
      <AppShell
        error={new Error('Connection timed out')}
        nodeCount={0}
        edgeCount={0}
        navigationContent={<div>Nav</div>}
        canvasContent={<div>Canvas</div>}
        inspectorContent={<div>Inspector</div>}
      />,
    )

    expect(html).toContain('shell-error')
    expect(html).toContain('Unable to Load Profile')
    expect(html).toContain('Connection timed out')
    expect(html).toContain('Retry Connection')
  })
})
