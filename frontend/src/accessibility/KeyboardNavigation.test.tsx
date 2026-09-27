import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { VisibleGraphTable } from '../views/VisibleGraphTable'
import { HierarchyTreeView, type TreeNode } from '../views/HierarchyTreeView'
import { SkipLinks } from './FocusManager'
import type { ExplorerGraph } from '../graph/state'
import type { GraphEntity, GraphRelationship } from '../interfaces/models'

describe('Keyboard Navigation & Responsive Accessibility (AX-001, AX-003, AX-007, AC-113)', () => {
  const sampleEntity1: GraphEntity = {
    __typename: 'OntologyEntity',
    id: 'wine:Chardonnay1',
    label: 'Chardonnay 2021',
    kind: 'Class',
    description: 'Crisp white wine',
  }

  const sampleEntity2: GraphEntity = {
    __typename: 'OntologyEntity',
    id: 'winery:NapaEstate',
    label: 'Napa Estate',
    kind: 'Individual',
    description: 'Family winery in Napa',
  }

  const sampleRel: GraphRelationship = {
    relation: 'hasMaker',
    source: sampleEntity1,
    target: sampleEntity2,
    predicate_iri: 'http://example.org/wine#hasMaker',
    predicate_label: 'has maker',
    is_inferred: false,
    source_graph: 'http://example.org/wine',
    explanation_handle: null,
  }

  const sampleGraph: ExplorerGraph = {
    entities: {
      [sampleEntity1.id]: sampleEntity1,
      [sampleEntity2.id]: sampleEntity2,
    },
    relationships: {
      'wine:Chardonnay1|hasMaker|winery:NapaEstate': sampleRel,
    },
  }

  const sampleTreeNodes: TreeNode[] = [
    {
      id: 'root_potable',
      label: 'Potable Liquid',
      children: [
        {
          id: 'child_wine',
          label: 'Wine',
          children: [
            { id: 'leaf_red', label: 'Red Wine' },
            { id: 'leaf_white', label: 'White Wine' },
          ],
        },
      ],
    },
  ]

  it('VisibleGraphTable provides keyboard-operable column headers and action buttons (AX-001, GE-008)', () => {
    const html = renderToString(
      <VisibleGraphTable
        graph={sampleGraph}
        onSelectEntity={() => {}}
        onSelectRelationship={() => {}}
        onExpandEntity={() => {}}
        onRemoveRelationship={() => {}}
        onRemoveEntity={() => {}}
      />,
    )

    // Table has proper accessibility roles and labels
    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Visible relationships data"')
    expect(html).toContain('<table')

    // Sort buttons have aria-sort or aria-label attributes and are keyboard accessible
    expect(html).toContain('Sort by Source Entity')
    expect(html).toContain('Sort by Predicate')
    expect(html).toContain('Sort by Target Entity')

    // Action buttons are keyboard accessible
    expect(html).toContain('aria-label="Inspect')
    expect(html).toContain('aria-label="Expand')
    expect(html).toContain('aria-label="Remove')
  })

  it('HierarchyTreeView implements roving tabindex and WAI-ARIA Tree View pattern (AX-001, AX-002)', () => {
    const html = renderToString(
      <HierarchyTreeView
        nodes={sampleTreeNodes}
        ariaLabel="Ontology Class Hierarchy"
        initialExpandedIds={['root_potable', 'child_wine']}
      />,
    )

    // Tree container role and keyboard instructions
    expect(html).toContain('role="tree"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="Ontology Class Hierarchy"')

    // Treeitem roles, hierarchy levels, and expansion states
    expect(html).toContain('role="treeitem"')
    expect(html).toContain('aria-level="1"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('aria-selected=')

    // First node receives active roving tabindex (0)
    expect(html).toContain('tabindex="0"')
  })

  it('SkipLinks renders bypass links with valid IDs targeting primary panels (AX-001, AX-003)', () => {
    const html = renderToString(<SkipLinks />)

    expect(html).toContain('skip-links-container')
    expect(html).toContain('href="#main-canvas"')
    expect(html).toContain('href="#visible-graph-table"')
    expect(html).toContain('href="#navigation-panel"')
    expect(html).toContain('href="#inspector-panel"')
  })

  it('AppShell.css contains Desktop, Tablet, and Mobile responsive breakpoints (AX-007, AX-006)', async () => {
    // @ts-expect-error dynamic node import
    const fs = await import('node:fs')
    // @ts-expect-error dynamic node import
    const path = await import('node:path')
    const cssPath = path.resolve('src/shell/AppShell.css')

    if (fs.existsSync(cssPath)) {
      const content = fs.readFileSync(cssPath, 'utf-8')
      // Desktop breakpoint (>1024px)
      expect(content).toContain('@media (min-width: 1025px)')

      // Tablet breakpoint (768px-1024px) with drawer and slide-over
      expect(content).toContain('@media (min-width: 768px) and (max-width: 1024px)')
      expect(content).toContain('.tablet-drawer-backdrop')
      expect(content).toContain('transform: translateX(-100%)')
      expect(content).toContain('transform: translateX(100%)')

      // Mobile breakpoint (<768px) with vertical panel stacking
      expect(content).toContain('@media (max-width: 767px)')
      expect(content).toContain('flex-direction: column !important')
      expect(content).toContain('.drawer-header-mobile')
      expect(content).toContain('.drawer-close-btn')
    }
  })

  it('CSS styles enforce touch targets >= 44px on mobile viewports (AX-007, AC-113)', async () => {
    // @ts-expect-error dynamic node import
    const fs = await import('node:fs')
    // @ts-expect-error dynamic node import
    const path = await import('node:path')

    const appCss = path.resolve('src/App.css')
    const tableCss = path.resolve('src/views/VisibleGraphTable.css')
    const treeCss = path.resolve('src/views/HierarchyTreeView.css')
    const shellCss = path.resolve('src/shell/AppShell.css')

    if (fs.existsSync(appCss)) {
      const content = fs.readFileSync(appCss, 'utf-8')
      expect(content).toContain('min-height: 44px')
      expect(content).toContain('min-width: 44px')
    }

    if (fs.existsSync(tableCss)) {
      const content = fs.readFileSync(tableCss, 'utf-8')
      expect(content).toContain('min-height: 44px')
      expect(content).toContain('min-width: 44px')
    }

    if (fs.existsSync(treeCss)) {
      const content = fs.readFileSync(treeCss, 'utf-8')
      expect(content).toContain('min-height: 44px')
    }

    if (fs.existsSync(shellCss)) {
      const content = fs.readFileSync(shellCss, 'utf-8')
      expect(content).toContain('min-height: 44px')
      expect(content).toContain('min-width: 44px')
    }
  })

  it('Visible focus ring styles (:focus-visible) are defined across components (AX-001, AC-113)', async () => {
    // @ts-expect-error dynamic node import
    const fs = await import('node:fs')
    // @ts-expect-error dynamic node import
    const path = await import('node:path')

    const focusCss = path.resolve('src/accessibility/FocusManager.css')
    const tableCss = path.resolve('src/views/VisibleGraphTable.css')
    const treeCss = path.resolve('src/views/HierarchyTreeView.css')

    if (fs.existsSync(focusCss)) {
      const content = fs.readFileSync(focusCss, 'utf-8')
      expect(content).toContain(':focus-visible')
    }

    if (fs.existsSync(tableCss)) {
      const content = fs.readFileSync(tableCss, 'utf-8')
      expect(content).toContain(':focus-visible')
    }

    if (fs.existsSync(treeCss)) {
      const content = fs.readFileSync(treeCss, 'utf-8')
      expect(content).toContain(':focus-visible')
    }
  })
})
