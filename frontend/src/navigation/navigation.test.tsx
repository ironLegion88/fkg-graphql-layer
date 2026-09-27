import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClassTree } from './ClassTree'
import { PropertyBrowser } from './PropertyBrowser'
import { SearchPanel } from './SearchPanel'
import { CommandPalette } from './CommandPalette'
import { SemanticLegend } from './SemanticLegend'
import { LanguageSelector } from './LanguageSelector'
import type {
  ActiveProfile,
  ClassInfo,
  PropertyInfo,
  SearchResult,
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

describe('Navigation Components', () => {
  const mockClasses: ClassInfo[] = [
    {
      iri: 'http://example.org/wine#Wine',
      compact_iri: { full_iri: 'http://example.org/wine#Wine', prefix: 'wine', local_name: 'Wine' },
      label: 'Wine',
      direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
      all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
      direct_children: ['http://example.org/wine#RedWine'],
      all_descendants: ['http://example.org/wine#RedWine'],
      equivalent_classes: [],
      disjoint_classes: [],
      instance_count: 52,
      annotations: [],
      restrictions: [],
    },
    {
      iri: 'http://example.org/wine#RedWine',
      compact_iri: { full_iri: 'http://example.org/wine#RedWine', prefix: 'wine', local_name: 'RedWine' },
      label: 'Red Wine',
      direct_parents: ['http://example.org/wine#Wine'],
      all_ancestors: ['http://example.org/wine#Wine', 'http://www.w3.org/2002/07/owl#Thing'],
      direct_children: [],
      all_descendants: [],
      equivalent_classes: [],
      disjoint_classes: [],
      instance_count: 26,
      annotations: [],
      restrictions: [],
    },
  ]

  const mockProperties: PropertyInfo[] = [
    {
      iri: 'http://example.org/wine#hasMaker',
      compact_iri: { full_iri: 'http://example.org/wine#hasMaker', prefix: 'wine', local_name: 'hasMaker' },
      label: 'has maker',
      property_kind: 'ObjectProperty',
      domains: ['http://example.org/wine#Wine'],
      ranges: ['http://example.org/wine#Winery'],
      inverse_of: 'http://example.org/wine#makesWine',
      characteristics: ['Functional'],
      usage_count: 42,
      annotations: [],
    },
    {
      iri: 'http://example.org/wine#hasFlavor',
      compact_iri: { full_iri: 'http://example.org/wine#hasFlavor', prefix: 'wine', local_name: 'hasFlavor' },
      label: 'has flavor',
      property_kind: 'DatatypeProperty',
      domains: ['http://example.org/wine#Wine'],
      ranges: ['http://www.w3.org/2001/XMLSchema#string'],
      inverse_of: null,
      characteristics: [],
      usage_count: 18,
      annotations: [],
    },
  ]

  const mockProfile: ActiveProfile = {
    metadata: {
      package_id: 'wine',
      version: '1.0.0',
      title: 'Wine Ontology',
      description: 'Wine knowledge graph',
      ontology_iris: [],
    },
    prefixes: [{ prefix: 'wine', iri: 'http://example.org/wine#' }],
    categories: [
      { name: 'Wine', class_iris: [], color: '#b83c50', icon: null, label: 'Fine Wine' },
      { name: 'Winery', class_iris: [], color: '#d7972f', icon: null, label: 'Winery' },
    ],
    predicates: [],
    limits: { max_depth: 3, max_nodes: 500, max_edges: 1000 },
    languages: { preferred_languages: ['en', 'fr', 'it'] },
    reasoning_profile: 'hermit',
    build_id: 'bld_123',
  }

  it('ClassTree renders class hierarchy with labels, badges, and filters', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['list-classes'], mockClasses)

    const onSelect = vi.fn()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <ClassTree onSelectClass={onSelect} selectedIri="http://example.org/wine#Wine" />
      </QueryClientProvider>,
    )

    expect(html).toContain('Classes')
    expect(html).toContain('Wine')
    expect(html).toContain('52') // instance count badge
    expect(html).toContain('Filter classes...')
    expect(html).toContain('Expand')
  })

  it('PropertyBrowser renders property list with kinds, domains, and ranges', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['list-properties'], mockProperties)

    const onSelect = vi.fn()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <PropertyBrowser onSelectProperty={onSelect} />
      </QueryClientProvider>,
    )

    expect(html).toContain('Properties')
    expect(html).toContain('has maker')
    expect(html).toContain('has flavor')
    expect(html).toContain('Object')
    expect(html).toContain('Datatype')
    expect(html).toContain('Functional')
    expect(html).toContain('domain:')
    expect(html).toContain('range:')
  })

  it('SearchPanel renders search bar and filter controls', () => {
    const queryClient = createTestQueryClient()
    const mockSearchData: SearchResult = {
      entities: [
        { __typename: 'Wine', id: 'wine:Cabernet', label: 'Cabernet Sauvignon', description: 'Dry red wine' },
      ],
      total_matches: 1,
    }
    queryClient.setQueryData(
      ['advanced-search', '', 0, [], false],
      mockSearchData,
    )

    const onSelect = vi.fn()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <SearchPanel profile={mockProfile} onSelectEntity={onSelect} />
      </QueryClientProvider>,
    )

    expect(html).toContain('Find Entities')
    expect(html).toContain('Search by label, IRI, alias...')
    expect(html).toContain('Enter at least two letters to search')
  })

  it('CommandPalette renders dialog when open and shows commands', () => {
    const actions = [
      { id: 'fit', title: 'Fit Graph View', subtitle: 'Zoom to fit', shortcut: 'F', onSelect: vi.fn() },
      { id: 'reset', title: 'Reset Canvas', subtitle: 'Clear nodes', onSelect: vi.fn() },
    ]

    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <CommandPalette isOpen={true} onClose={vi.fn()} actions={actions} />
      </QueryClientProvider>,
    )

    expect(html).toContain('Command Palette')
    expect(html).toContain('Fit Graph View')
    expect(html).toContain('Reset Canvas')
    expect(html).toContain('Commands &amp; Actions')
    expect(html).toContain('Type a command or search entities')
  })

  it('CommandPalette returns null when closed', () => {
    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <CommandPalette isOpen={false} onClose={vi.fn()} actions={[]} />
      </QueryClientProvider>,
    )

    expect(html).toBe('')
  })

  it('SemanticLegend renders dynamic categories and colors', () => {
    const html = renderToString(
      <SemanticLegend categories={mockProfile.categories} />,
    )

    expect(html).toContain('Legend:')
    expect(html).toContain('Fine Wine')
    expect(html).toContain('Winery')
    expect(html).toContain('#b83c50')
    expect(html).toContain('#d7972f')
  })

  it('LanguageSelector renders preferred languages from profile', () => {
    const onLang = vi.fn()
    const html = renderToString(
      <LanguageSelector
        preferredLanguages={mockProfile.languages.preferred_languages}
        currentLanguage="en"
        onLanguageChange={onLang}
      />,
    )

    expect(html).toContain('English (en)')
    expect(html).toContain('Français (fr)')
    expect(html).toContain('Italiano (it)')
  })
})
