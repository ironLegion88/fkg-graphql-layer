import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  client,
  fetchProfile,
  listClasses,
  listProperties,
  getClassInfo,
  getPropertyInfo,
  getResourceMetadata,
  getExpansionPreview,
  advancedSearch,
  getBuildStatus,
  findPath,
  compareEntities,
  getExplanation,
} from './graph'
import type {
  ActiveProfile,
  ClassInfo,
  PropertyInfo,
  ResourceMetadata,
  ExpansionPreview,
  SearchResult,
  BuildStatus,
  PathResult,
  ComparisonResult,
  ExplanationResult,
} from '../interfaces/models'

describe('GraphQL Client Queries', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchProfile requests and returns full ActiveProfile', async () => {
    const mockProfile: ActiveProfile = {
      metadata: {
        package_id: 'test-ontology',
        version: '1.0.0',
        title: 'Test Wine Ontology',
        description: 'Wine knowledge graph',
        ontology_iris: ['http://example.org/wine'],
      },
      prefixes: [{ prefix: 'wine', iri: 'http://example.org/wine#' }],
      categories: [
        {
          name: 'Wine',
          class_iris: ['http://example.org/wine#Wine'],
          color: '#b83c50',
          icon: null,
          label: 'Wine',
        },
      ],
      predicates: [
        {
          name: 'hasMaker',
          iri: 'http://example.org/wine#hasMaker',
          label: 'has maker',
          traversable: true,
          hidden: false,
        },
      ],
      limits: { max_depth: 3, max_nodes: 500, max_edges: 1000 },
      languages: { preferred_languages: ['en', 'fr'] },
      reasoning_profile: 'hermit',
      build_id: 'bld_12345',
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_active_profile: mockProfile,
    })

    const result = await fetchProfile()
    expect(result.metadata.title).toBe('Test Wine Ontology')
    expect(result.build_id).toBe('bld_12345')
    expect(result.reasoning_profile).toBe('hermit')
    expect(result.prefixes).toHaveLength(1)
    expect(result.limits.max_nodes).toBe(500)
  })

  it('listClasses returns ClassInfo array', async () => {
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
        instance_count: 42,
        annotations: [],
        restrictions: [],
      },
    ]

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      list_classes: mockClasses,
    })

    const result = await listClasses(10, 0)
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('Wine')
    expect(result[0].instance_count).toBe(42)
  })

  it('listProperties returns PropertyInfo array', async () => {
    const mockProps: PropertyInfo[] = [
      {
        iri: 'http://example.org/wine#hasMaker',
        compact_iri: { full_iri: 'http://example.org/wine#hasMaker', prefix: 'wine', local_name: 'hasMaker' },
        label: 'has maker',
        property_kind: 'ObjectProperty',
        domains: ['http://example.org/wine#Wine'],
        ranges: ['http://example.org/wine#Winery'],
        inverse_of: 'http://example.org/wine#makesWine',
        characteristics: ['Functional'],
        usage_count: 88,
        annotations: [],
      },
    ]

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      list_properties: mockProps,
    })

    const result = await listProperties(10, 0)
    expect(result).toHaveLength(1)
    expect(result[0].property_kind).toBe('ObjectProperty')
    expect(result[0].domains).toEqual(['http://example.org/wine#Wine'])
    expect(result[0].usage_count).toBe(88)
  })

  it('getClassInfo returns single ClassInfo or null', async () => {
    const mockClass: ClassInfo = {
      iri: 'http://example.org/wine#RedWine',
      compact_iri: { full_iri: 'http://example.org/wine#RedWine', prefix: 'wine', local_name: 'RedWine' },
      label: 'Red Wine',
      direct_parents: ['http://example.org/wine#Wine'],
      all_ancestors: ['http://example.org/wine#Wine', 'http://www.w3.org/2002/07/owl#Thing'],
      direct_children: [],
      all_descendants: [],
      equivalent_classes: [],
      disjoint_classes: ['http://example.org/wine#WhiteWine'],
      instance_count: 24,
      annotations: [],
      restrictions: ['hasColor value Red'],
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_class_info: mockClass,
    })

    const result = await getClassInfo('http://example.org/wine#RedWine')
    expect(result).not.toBeNull()
    expect(result?.label).toBe('Red Wine')
    expect(result?.disjoint_classes).toContain('http://example.org/wine#WhiteWine')
  })

  it('getPropertyInfo returns single PropertyInfo or null', async () => {
    const mockProp: PropertyInfo = {
      iri: 'http://example.org/wine#hasSugar',
      compact_iri: { full_iri: 'http://example.org/wine#hasSugar', prefix: 'wine', local_name: 'hasSugar' },
      label: 'has sugar',
      property_kind: 'DatatypeProperty',
      domains: ['http://example.org/wine#Wine'],
      ranges: ['http://www.w3.org/2001/XMLSchema#string'],
      inverse_of: null,
      characteristics: ['Functional'],
      usage_count: 55,
      annotations: [],
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_property_info: mockProp,
    })

    const result = await getPropertyInfo('http://example.org/wine#hasSugar')
    expect(result).not.toBeNull()
    expect(result?.property_kind).toBe('DatatypeProperty')
  })

  it('getResourceMetadata returns ResourceMetadata or null', async () => {
    const mockMeta: ResourceMetadata = {
      iri: 'http://example.org/wine#ChateauMargaux',
      compact_iri: { full_iri: 'http://example.org/wine#ChateauMargaux', prefix: 'wine', local_name: 'ChateauMargaux' },
      semantic_kind: 'Wine',
      asserted_types: ['http://example.org/wine#Margaux'],
      inferred_types: ['http://example.org/wine#Wine'],
      labels: [{ value: 'Château Margaux', language: 'fr', predicate_iri: 'rdfs:label' }],
      preferred_label: 'Château Margaux',
      descriptions: [{ value: 'Premier Grand Cru Classé', language: 'fr', predicate_iri: 'rdfs:comment' }],
      annotations: [],
      source_graphs: ['http://example.org/graphs/wines'],
      build_id: 'bld_12345',
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_resource_metadata: mockMeta,
    })

    const result = await getResourceMetadata('http://example.org/wine#ChateauMargaux')
    expect(result?.preferred_label).toBe('Château Margaux')
    expect(result?.semantic_kind).toBe('Wine')
    expect(result?.inferred_types).toContain('http://example.org/wine#Wine')
  })

  it('getExpansionPreview returns ExpansionPreview structure', async () => {
    const mockPreview: ExpansionPreview = {
      entity_id: 'wine:Margaux',
      total_count: 15,
      groups: [
        { relation: 'hasMaker', direction: 'OUTGOING', count: 1 },
        { relation: 'madeFromGrape', direction: 'OUTGOING', count: 3 },
        { relation: 'producesWine', direction: 'INCOMING', count: 11 },
      ],
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_expansion_preview: mockPreview,
    })

    const result = await getExpansionPreview('wine:Margaux')
    expect(result.total_count).toBe(15)
    expect(result.groups).toHaveLength(3)
    expect(result.groups[0].direction).toBe('OUTGOING')
  })

  it('advancedSearch sends search input and returns SearchResult', async () => {
    const mockResult: SearchResult = {
      entities: [
        { __typename: 'Wine', id: 'wine:Cabernet', label: 'Cabernet Sauvignon', description: 'Red wine' },
      ],
      total_matches: 1,
    }

    const spy = vi.spyOn(client, 'request').mockResolvedValueOnce({
      search: mockResult,
    })

    const result = await advancedSearch({
      query: 'Cabernet',
      limit: 10,
      offset: 0,
      kinds: ['Wine'],
      require_description: true,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        options: {
          query: 'Cabernet',
          limit: 10,
          offset: 0,
          kinds: ['Wine'],
          require_description: true,
        },
      }),
    )
    expect(result.total_matches).toBe(1)
    expect(result.entities[0].label).toBe('Cabernet Sauvignon')
  })

  it('getBuildStatus returns BuildStatus structure', async () => {
    const mockStatus: BuildStatus = {
      build_id: 'bld_98765',
      status: 'ready',
      consistency: 'consistent',
      triple_count: 3500,
      inferred_count: 700,
      semantic_profile: 'wine-profile',
      reasoner_status: 'completed',
      reasoner_name: 'HermiT',
      validation_summary: 'Passed',
      unsatisfiable_classes: [],
      unsupported_constructs: [],
      findings: [
        { severity: 'info', message: 'All constraints met', focus_node: null, source_shape: null },
      ],
    }

    vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_build_status: mockStatus,
    })

    const result = await getBuildStatus()
    expect(result.build_id).toBe('bld_98765')
    expect(result.consistency).toBe('consistent')
    expect(result.inferred_count).toBe(700)
    expect(result.findings).toHaveLength(1)
  })

  it('findPath requests and returns PathResult with path entities and relations (GQ-109)', async () => {
    const mockResult: PathResult = {
      status: 'FOUND',
      path: {
        entities: [
          { __typename: 'OntologyEntity', id: 'wine:Merlot', label: 'Merlot', description: null },
          { __typename: 'OntologyEntity', id: 'wine:Bordeaux', label: 'Bordeaux', description: null },
        ],
        relations: ['locatedIn'],
      },
      visited_nodes: 5,
    }

    const requestSpy = vi.spyOn(client, 'request').mockResolvedValueOnce({
      find_path: mockResult,
    })

    const result = await findPath('wine:Merlot', 'wine:Bordeaux')
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('find_path'),
      { sourceId: 'wine:Merlot', targetId: 'wine:Bordeaux' },
    )
    expect(result.status).toBe('FOUND')
    expect(result.visited_nodes).toBe(5)
    expect(result.path?.entities).toHaveLength(2)
    expect(result.path?.relations).toEqual(['locatedIn'])
  })

  it('compareEntities requests and returns ComparisonResult (GQ-111)', async () => {
    const mockComparison: ComparisonResult = {
      common_types: ['wine:RedWine'],
      unique_types_a: ['wine:BordeauxWine'],
      unique_types_b: ['wine:BurgundyWine'],
      common_properties: ['wine:hasMaker'],
      unique_properties_a: ['wine:hasVintage'],
      unique_properties_b: ['wine:hasOak'],
      shared_neighbors: [
        { __typename: 'OntologyEntity', id: 'wine:France', label: 'France', description: null },
      ],
    }

    const requestSpy = vi.spyOn(client, 'request').mockResolvedValueOnce({
      compare: mockComparison,
    })

    const result = await compareEntities('wine:Merlot', 'wine:Pinot')
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('compare'),
      { idA: 'wine:Merlot', idB: 'wine:Pinot' },
    )
    expect(result.common_types).toEqual(['wine:RedWine'])
    expect(result.unique_types_a).toEqual(['wine:BordeauxWine'])
    expect(result.shared_neighbors).toHaveLength(1)
    expect(result.shared_neighbors[0].label).toBe('France')
  })

  it('getExplanation requests and returns ExplanationResult (GQ-112)', async () => {
    const mockExplanation: ExplanationResult = {
      available: false,
      proof_steps: [],
      reasoner: 'HermiT 1.4.3',
      message: 'Explanation service is not yet available.',
    }

    const requestSpy = vi.spyOn(client, 'request').mockResolvedValueOnce({
      get_explanation: mockExplanation,
    })

    const result = await getExplanation('handle_proof_99')
    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('get_explanation'),
      { handle: 'handle_proof_99' },
    )
    expect(result.available).toBe(false)
    expect(result.proof_steps).toEqual([])
    expect(result.reasoner).toBe('HermiT 1.4.3')
    expect(result.message).toContain('not yet available')
  })
})
