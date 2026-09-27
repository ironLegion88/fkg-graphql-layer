import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  HierarchyTreeView,
  buildClassHierarchyTree,
  buildPathTree,
  buildComparisonTree,
  buildProofTree,
  type TreeNode,
} from './HierarchyTreeView'
import type { ClassInfo, GraphEntity, GraphRelationship } from '../interfaces/models'

describe('HierarchyTreeView (AX-001, AX-002)', () => {
  const sampleNodes: TreeNode[] = [
    {
      id: 'root_beverage',
      label: 'Beverage',
      subtitle: 'Liquid prepared for consumption',
      children: [
        {
          id: 'wine_class',
          label: 'Wine',
          badge: '12 instances',
          badgeVariant: 'info',
          children: [
            {
              id: 'red_wine',
              label: 'Red Wine',
              badge: '5 instances',
            },
            {
              id: 'white_wine',
              label: 'White Wine',
              badge: '7 instances',
            },
          ],
        },
        {
          id: 'potable_liquid',
          label: 'Potable Liquid',
        },
      ],
    },
  ]

  it('renders tree container with role="tree" and ARIA attributes', () => {
    const html = renderToString(
      <HierarchyTreeView
        nodes={sampleNodes}
        ariaLabel="Ontology Class Hierarchy"
        initialExpandedIds={['root_beverage', 'wine_class']}
      />,
    )

    expect(html).toContain('role="tree"')
    expect(html).toContain('aria-label="Ontology Class Hierarchy"')
    expect(html).toContain('role="treeitem"')
    expect(html).toContain('aria-level="1"')
    expect(html).toContain('Beverage')
    expect(html).toContain('Wine')
    expect(html).toContain('Red Wine')
    expect(html).toContain('White Wine')
  })

  it('indicates selected node with selected class and aria-selected="true"', () => {
    const html = renderToString(
      <HierarchyTreeView
        nodes={sampleNodes}
        selectedId="wine_class"
        initialExpandedIds={['root_beverage']}
      />,
    )

    expect(html).toContain('selected')
    expect(html).toContain('aria-selected="true"')
  })

  it('renders search filter input and expand/collapse action buttons', () => {
    const html = renderToString(
      <HierarchyTreeView
        nodes={sampleNodes}
        enableFilter={true}
        filterPlaceholder="Search classes..."
      />,
    )

    expect(html).toContain('Search classes...')
    expect(html).toContain('Expand All')
    expect(html).toContain('Collapse All')
  })

  it('buildClassHierarchyTree constructs tree from ClassInfo models', () => {
    const mockClasses: ClassInfo[] = [
      {
        iri: 'http://example.org/wine#Wine',
        compact_iri: { full_iri: 'http://example.org/wine#Wine', prefix: 'wine', local_name: 'Wine' },
        label: 'Wine',
        direct_parents: [],
        all_ancestors: [],
        direct_children: ['http://example.org/wine#RedWine'],
        all_descendants: ['http://example.org/wine#RedWine'],
        equivalent_classes: [],
        disjoint_classes: [],
        instance_count: 24,
        annotations: [],
        restrictions: [],
      },
      {
        iri: 'http://example.org/wine#RedWine',
        compact_iri: { full_iri: 'http://example.org/wine#RedWine', prefix: 'wine', local_name: 'RedWine' },
        label: 'Red Wine',
        direct_parents: ['http://example.org/wine#Wine'],
        all_ancestors: ['http://example.org/wine#Wine'],
        direct_children: [],
        all_descendants: [],
        equivalent_classes: [],
        disjoint_classes: [],
        instance_count: 10,
        annotations: [],
        restrictions: [],
      },
    ]

    const tree = buildClassHierarchyTree(mockClasses)
    expect(tree.length).toBe(1)
    expect(tree[0].label).toBe('Wine')
    expect(tree[0].badge).toBe('24 instances')
    expect(tree[0].children?.length).toBe(1)
    expect(tree[0].children?.[0].label).toBe('Red Wine')

    const html = renderToString(
      <HierarchyTreeView nodes={tree} initialExpandedIds={['http://example.org/wine#Wine']} />,
    )
    expect(html).toContain('Wine')
    expect(html).toContain('Red Wine')
    expect(html).toContain('24 instances')
  })

  it('buildPathTree constructs step-by-step path sequence', () => {
    const entities: GraphEntity[] = [
      { __typename: 'OntologyEntity', id: 'wine:Cabernet', label: 'Cabernet', description: null },
      { __typename: 'OntologyEntity', id: 'wine:Napa', label: 'Napa Valley', description: null },
      { __typename: 'OntologyEntity', id: 'wine:USA', label: 'United States', description: null },
    ]
    const relations = ['locatedIn', 'partOf']

    const pathTree = buildPathTree(entities, relations)
    expect(pathTree.length).toBe(3)
    expect(pathTree[0].badge).toBe('Start')
    expect(pathTree[1].badge).toBe('Step 1')
    expect(pathTree[2].badge).toBe('Goal')

    const html = renderToString(<HierarchyTreeView nodes={pathTree} />)
    expect(html).toContain('Cabernet')
    expect(html).toContain('Napa Valley')
    expect(html).toContain('United States')
    expect(html).toContain('Start')
    expect(html).toContain('Goal')
  })

  it('buildComparisonTree constructs comparison groups with non-color cues', () => {
    const source: GraphEntity = { __typename: 'OntologyEntity', id: 'w1', label: 'Merlot', description: null }
    const winery: GraphEntity = { __typename: 'OntologyEntity', id: 'w2', label: 'Kendall', description: null }

    const sharedRel: GraphRelationship = {
      relation: 'hasMaker',
      source,
      target: winery,
      predicate_iri: null,
      predicate_label: null,
      is_inferred: false,
      source_graph: null,
      explanation_handle: null,
    }

    const uniqueRelA: GraphRelationship = {
      relation: 'hasColor',
      source,
      target: { __typename: 'OntologyEntity', id: 'c1', label: 'Red', description: null },
      predicate_iri: null,
      predicate_label: null,
      is_inferred: true,
      source_graph: null,
      explanation_handle: null,
    }

    const comparisonTree = buildComparisonTree([sharedRel], [uniqueRelA], [], 'Merlot', 'Pinot')
    expect(comparisonTree.length).toBe(3)
    expect(comparisonTree[0].label).toContain('Shared Facts')
    expect(comparisonTree[1].label).toContain('Unique to Merlot')

    const html = renderToString(
      <HierarchyTreeView
        nodes={comparisonTree}
        initialExpandedIds={['group_shared', 'group_unique_a']}
      />,
    )
    expect(html).toContain('Shared Facts (1)')
    expect(html).toContain('Unique to Merlot (1)')
    expect(html).toContain('Asserted')
    expect(html).toContain('Inferred')
  })

  it('buildProofTree constructs explanation proof steps hierarchy', () => {
    const proofSteps = [
      {
        step: 1,
        conclusion: 'Chardonnay is a WhiteWine',
        premises: ['Chardonnay hasColor White', 'WhiteWine hasColor White'],
        rule: 'owl:subClassOf',
      },
    ]

    const proofTree = buildProofTree(proofSteps)
    expect(proofTree.length).toBe(1)
    expect(proofTree[0].label).toBe('Step 1: Chardonnay is a WhiteWine')

    const html = renderToString(
      <HierarchyTreeView nodes={proofTree} initialExpandedIds={['proof_step_1']} />,
    )
    expect(html).toContain('Step 1: Chardonnay is a WhiteWine')
    expect(html).toContain('Chardonnay hasColor White')
    expect(html).toContain('Premise')
  })

  it('renders accessible empty state when node list is empty', () => {
    const html = renderToString(
      <HierarchyTreeView nodes={[]} emptyMessage="No ontology classes available." />,
    )
    expect(html).toContain('No ontology classes available.')
  })
})
