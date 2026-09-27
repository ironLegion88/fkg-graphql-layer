import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResourceInspector } from './ResourceInspector'
import { ClassInspector } from './ClassInspector'
import { PropertyInspector } from './PropertyInspector'
import { ConsistencyPanel } from './ConsistencyPanel'
import { ProvenancePanel } from './ProvenancePanel'
import { InspectorPanel } from './InspectorPanel'
import type {
  ResourceMetadata,
  ClassInfo,
  PropertyInfo,
  BuildStatus,
  GraphRelationship,
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

describe('Semantic Inspector Components', () => {
  const mockResourceMetadata: ResourceMetadata = {
    iri: 'http://example.org/wine#ChateauMargaux',
    compact_iri: {
      full_iri: 'http://example.org/wine#ChateauMargaux',
      prefix: 'wine',
      local_name: 'ChateauMargaux',
    },
    semantic_kind: 'Wine',
    asserted_types: ['http://example.org/wine#Bordeaux'],
    inferred_types: ['http://example.org/wine#Wine', 'http://example.org/wine#RedWine'],
    labels: [
      { value: 'Château Margaux', language: 'fr', predicate_iri: 'rdfs:label' },
      { value: 'Chateau Margaux', language: 'en', predicate_iri: 'rdfs:label' },
    ],
    preferred_label: 'Château Margaux',
    descriptions: [
      { value: 'Premier Grand Cru Classé wine estate.', language: 'en', predicate_iri: 'rdfs:comment' },
    ],
    annotations: [
      { predicate_iri: 'http://xmlns.com/foaf/0.1/depiction', value: 'https://example.org/margaux.jpg', language: null },
      { predicate_iri: 'rdfs:seeAlso', value: 'https://en.wikipedia.org/wiki/Ch%C3%A2teau_Margaux', language: null },
    ],
    source_graphs: ['urn:fkg:graph:asserted'],
    build_id: 'bld_1234567890',
  }

  const mockClassInfo: ClassInfo = {
    iri: 'http://example.org/wine#Wine',
    compact_iri: { full_iri: 'http://example.org/wine#Wine', prefix: 'wine', local_name: 'Wine' },
    label: 'Wine',
    direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
    all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
    direct_children: ['http://example.org/wine#RedWine', 'http://example.org/wine#WhiteWine'],
    all_descendants: ['http://example.org/wine#RedWine', 'http://example.org/wine#WhiteWine'],
    equivalent_classes: ['http://example.org/wine#BeverageWine'],
    disjoint_classes: ['http://example.org/wine#Beer'],
    instance_count: 52,
    annotations: [
      { predicate_iri: 'rdfs:comment', value: 'An alcoholic beverage made of fermented grape juice.', language: 'en' },
    ],
    restrictions: ['hasMaker some Winery', 'hasColor value Red'],
  }

  const mockPropertyInfo: PropertyInfo = {
    iri: 'http://example.org/wine#hasMaker',
    compact_iri: { full_iri: 'http://example.org/wine#hasMaker', prefix: 'wine', local_name: 'hasMaker' },
    label: 'has maker',
    property_kind: 'ObjectProperty',
    domains: ['http://example.org/wine#Wine'],
    ranges: ['http://example.org/wine#Winery'],
    inverse_of: 'http://example.org/wine#producesWine',
    equivalent_properties: [],
    sub_properties: [],
    super_properties: [],
    characteristics: ['Functional', 'Asymmetric'],
    usage_count: 142,
    annotations: [
      { predicate_iri: 'rdfs:comment', value: 'Relates a wine to its producing winery.', language: 'en' },
    ],
  }

  const mockBuildStatus: BuildStatus = {
    build_id: 'bld_ca3f45ba12d4',
    status: 'ready',
    consistency: 'consistent',
    triple_count: 3648,
    inferred_count: 791,
    semantic_profile: 'wine-profile',
    reasoner_status: 'completed',
    reasoner_name: 'HermiT',
    validation_summary: 'Passed',
    unsatisfiable_classes: [],
    unsupported_constructs: [],
    findings: [],
  }

  const mockRelationship: GraphRelationship = {
    relation: 'hasMaker',
    source: { __typename: 'Wine', id: 'wine:Margaux', label: 'Château Margaux', description: null },
    target: { __typename: 'Winery', id: 'winery:MargauxEstate', label: 'Margaux Estate', description: null },
    predicate_iri: 'http://example.org/wine#hasMaker',
    predicate_label: 'has maker',
    is_inferred: false,
    source_graph: 'urn:fkg:graph:asserted',
    explanation_handle: null,
  }

  const mockInferredRelationship: GraphRelationship = {
    relation: 'locatedIn',
    source: { __typename: 'Wine', id: 'wine:Margaux', label: 'Château Margaux', description: null },
    target: { __typename: 'Region', id: 'region:France', label: 'France', description: null },
    predicate_iri: 'http://example.org/wine#locatedIn',
    predicate_label: 'located in',
    is_inferred: true,
    source_graph: 'urn:fkg:graph:inferred',
    explanation_handle: 'expl_transitive_locatedIn_987',
  }

  // 1. Resource Inspector Tests
  it('ResourceInspector renders preferred label, IRIs, multilingual labels, descriptions, and annotations', () => {
    const html = renderToString(<ResourceInspector metadata={mockResourceMetadata} />)
    expect(html).toContain('Château Margaux')
    expect(html).toContain('wine:ChateauMargaux')
    expect(html).toContain('http://example.org/wine#ChateauMargaux')
    expect(html).toContain('Premier Grand Cru Classé')
    expect(html).toContain('lang-tag')
    expect(html).toContain('fr')
    expect(html).toContain('en')
    expect(html).toContain('https://example.org/margaux.jpg')
    expect(html).toContain('urn:fkg:graph:asserted')
    expect(html).toContain('build:')
    expect(html).toContain('bld_123456')
  })

  // 2. AC-106 Non-Color Cues Test for Asserted vs Inferred Types
  it('ResourceInspector distinguishes asserted and inferred types with non-color cues (icon + text labels)', () => {
    const html = renderToString(<ResourceInspector metadata={mockResourceMetadata} />)
    // Non-color cues: Asserted text label + Inferred text label
    expect(html).toContain('Asserted Type')
    expect(html).toContain('Inferred Type')
    expect(html).toContain('Bordeaux')
    expect(html).toContain('RedWine')
    expect(html).toContain('asserted-row')
    expect(html).toContain('inferred-row')
  })

  // 3. Class Inspector Tests
  it('ClassInspector renders class hierarchy, equivalent classes, disjoints, restrictions, and instance count', () => {
    const html = renderToString(<ClassInspector classInfo={mockClassInfo} />)
    expect(html).toContain('Wine')
    expect(html).toContain('52')
    expect(html).toContain('instances')
    expect(html).toContain('Superclasses')
    expect(html).toContain('Thing')
    expect(html).toContain('Direct Subclasses')
    expect(html).toContain('RedWine')
    expect(html).toContain('WhiteWine')
    expect(html).toContain('BeverageWine')
    expect(html).toContain('Beer')
    expect(html).toContain('hasMaker some Winery')
    expect(html).toContain('hasColor value Red')
  })

  // 4. Property Inspector Tests
  it('PropertyInspector renders property kind, domain, range, characteristics, inverse, and usage count', () => {
    const html = renderToString(<PropertyInspector propertyInfo={mockPropertyInfo} />)
    expect(html).toContain('has maker')
    expect(html).toContain('ObjectProperty')
    expect(html).toContain('142')
    expect(html).toContain('uses')
    expect(html).toContain('Domain')
    expect(html).toContain('Range')
    expect(html).toContain('Wine')
    expect(html).toContain('Winery')
    expect(html).toContain('producesWine')
    expect(html).toContain('Functional')
    expect(html).toContain('Asymmetric')
  })

  // 5. Consistency Panel Tests
  it('ConsistencyPanel renders build status, consistency check, reasoner profile, and metrics', () => {
    const html = renderToString(<ConsistencyPanel buildStatus={mockBuildStatus} />)
    expect(html).toContain('Ontology is Consistent')
    expect(html).toContain('3,648')
    expect(html).toContain('791')
    expect(html).toContain('bld_ca3f45ba12d4')
    expect(html).toContain('HermiT')
    expect(html).toContain('All classes are satisfiable (0 unsatisfiable classes)')
    expect(html).toContain('All OWL 2 constructs in profile are supported')
  })

  it('ConsistencyPanel renders warnings and unsatisfiable classes when present', () => {
    const inconsistentStatus: BuildStatus = {
      ...mockBuildStatus,
      consistency: 'inconsistent',
      unsatisfiable_classes: ['http://example.org/wine#SourWine'],
      unsupported_constructs: ['SelfRestriction'],
      findings: [
        { severity: 'error', message: 'Contradiction in disjoint classes', focus_node: 'wine:SourWine', source_shape: null },
      ],
    }

    const html = renderToString(<ConsistencyPanel buildStatus={inconsistentStatus} />)
    expect(html).toContain('Logical Inconsistency Detected')
    expect(html).toContain('SourWine')
    expect(html).toContain('SelfRestriction')
    expect(html).toContain('Contradiction in disjoint classes')
  })

  // 6. Provenance Panel Tests (AC-106 Non-Color Cues)
  it('ProvenancePanel distinguishes asserted facts with solid border and check icon', () => {
    const html = renderToString(
      <ProvenancePanel
        selectedRelationship={mockRelationship}
        activeBuildId="bld_ca3f45ba"
        reasonerName="HermiT"
      />,
    )
    expect(html).toContain('Asserted Fact (Direct Axiom)')
    expect(html).toContain('Château Margaux')
    expect(html).toContain('Margaux Estate')
    expect(html).toContain('has maker')
    expect(html).toContain('urn:fkg:graph:asserted')
    expect(html).toContain('This is an asserted fact directly declared in the ontology')
  })

  it('ProvenancePanel distinguishes inferred facts with non-color cues and Why explanation action', () => {
    const html = renderToString(
      <ProvenancePanel
        selectedRelationship={mockInferredRelationship}
        activeBuildId="bld_ca3f45ba"
        reasonerName="HermiT"
      />,
    )
    // Non-color cue: text label + icon
    expect(html).toContain('Inferred Fact (Derived Semantic)')
    expect(html).toContain('France')
    expect(html).toContain('urn:fkg:graph:inferred')
    expect(html).toContain('Why is this inferred? (View Proof)')
    expect(html).toContain('expl_transitive_locatedIn_987')
  })

  // 7. InspectorPanel Integration & State Tests
  it('InspectorPanel renders empty state when no entity is selected', () => {
    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <InspectorPanel selectedId={null} />
      </QueryClientProvider>,
    )
    expect(html).toContain('No Entity Selected')
    expect(html).toContain('View Build Consistency')
  })

  it('InspectorPanel renders tab bar with all 5 inspector options', () => {
    const queryClient = createTestQueryClient()
    const html = renderToString(
      <QueryClientProvider client={queryClient}>
        <InspectorPanel selectedId="wine:Margaux" />
      </QueryClientProvider>,
    )
    expect(html).toContain('Resource')
    expect(html).toContain('Class')
    expect(html).toContain('Property')
    expect(html).toContain('Provenance')
    expect(html).toContain('Consistency')
  })
})
