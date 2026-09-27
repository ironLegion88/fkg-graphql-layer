import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import dagre from 'cytoscape-dagre'

import { entityKind } from '../api/graph'
import { relationshipKey } from './state'
import type { DetailGraphRenderer } from '../interfaces/renderers'
import type { GraphEntity, SemanticCategory } from '../interfaces/models'

// Register cytoscape layout extensions safely
try {
  cytoscape.use(dagre)
} catch {
  // Extension already registered
}

export interface GraphRendererHandle {
  fit(): void
  focusNode(id: string): void
  runLayout(name?: string): void
  getCy(): Core | null
}

export interface CytoscapeGraphProps extends DetailGraphRenderer {
  categories?: SemanticCategory[]
  layoutName?: string
  pinnedNodeIds?: string[]
  onTogglePinNode?: (id: string) => void
}

export type NodeShape = 'diamond' | 'rectangle' | 'ellipse' | 'round-rectangle'

export interface NodeStyleInfo {
  shape: NodeShape
  color: string
  icon?: string | null
  categoryName: string
}

export const defaultCategoryColors: Record<string, string> = {
  wine: '#b83c50',
  winery: '#d7972f',
  region: '#287b73',
  grape: '#6c5ca4',
  pizza: '#ff5a5f',
  pizzatopping: '#00a699',
  pizzabase: '#fc642d',
  country: '#484848',
  class: '#3b82f6',
  property: '#8b5cf6',
  individual: '#10b981',
  unknown: '#6b7280',
}

/**
 * Determine node shape, color, and icon based on entity kind and profile categories.
 * RC-001, RC-002: classes = diamond, properties = rectangle, individuals = ellipse, unknown = round-rectangle.
 */
export function getNodeStyling(
  entity: GraphEntity,
  categories?: SemanticCategory[],
  categoryColors?: Record<string, string>,
): NodeStyleInfo {
  const kind = (entity.kind || entity.__typename || '').toLowerCase()

  // Match against profile semantic categories by name or class IRI
  let matchedCat: SemanticCategory | undefined
  if (categories && categories.length > 0) {
    matchedCat = categories.find(
      (cat) =>
        cat.name.toLowerCase() === kind ||
        cat.class_iris?.some(
          (iri) => iri === entity.id || iri.toLowerCase() === entity.id.toLowerCase(),
        ),
    )
  }

  // Determine node shape
  let shape: NodeShape = 'ellipse'
  if (kind === 'class' || kind === 'ontologyclass') {
    shape = 'diamond'
  } else if (
    kind === 'property' ||
    kind === 'objectproperty' ||
    kind === 'datatypeproperty' ||
    kind === 'annotationproperty'
  ) {
    shape = 'rectangle'
  } else if (kind === 'unknown' || kind === 'genericentity') {
    shape = 'round-rectangle'
  } else if (kind === 'individual' || kind === 'ontologyindividual') {
    shape = 'ellipse'
  } else {
    // Entities representing domain concepts (wine, pizza, topping, etc.) are individuals
    shape = 'ellipse'
  }

  const categoryName = matchedCat?.name || entity.kind || entity.__typename || 'unknown'
  const color =
    matchedCat?.color ||
    (categoryColors && categoryColors[categoryName.toLowerCase()]) ||
    (categoryColors && categoryColors[kind]) ||
    defaultCategoryColors[categoryName.toLowerCase()] ||
    defaultCategoryColors[kind] ||
    '#287b73'

  return {
    shape,
    color,
    icon: matchedCat?.icon ?? null,
    categoryName,
  }
}

const CytoscapeGraph = forwardRef<GraphRendererHandle, CytoscapeGraphProps>(
  function CytoscapeGraph(
    {
      graph,
      selectedId,
      categoryColors,
      categories,
      layoutName = 'breadthfirst',
      pinnedNodeIds = [],
      onSelectEntity,
    },
    ref,
  ) {
    const cyRef = useRef<Core | null>(null)
    const nodeCount = Object.keys(graph.entities).length
    const edgeCount = Object.keys(graph.relationships).length
    const showEdgeLabels = edgeCount <= 200

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const elements: ElementDefinition[] = [
      ...Object.values(graph.entities).map((entity) => {
        const styling = getNodeStyling(entity, categories, categoryColors)
        const isPinned = pinnedNodeIds.includes(entity.id)
        return {
          data: {
            id: entity.id,
            label: entity.label,
            category: styling.categoryName,
            shape: styling.shape,
            color: styling.color,
            icon: styling.icon || '',
            displayLabel: styling.icon ? `${styling.icon} ${entity.label}` : entity.label,
          },
          classes: [
            styling.categoryName.toLowerCase(),
            `shape-${styling.shape}`,
            entityKind(entity).toLowerCase(),
            isPinned ? 'pinned' : '',
          ]
            .filter(Boolean)
            .join(' '),
        }
      }),
      ...Object.values(graph.relationships).map((relationship) => {
        const isInferred = Boolean(relationship.is_inferred)
        const label = relationship.predicate_label || relationship.relation
        return {
          data: {
            id: relationshipKey(relationship),
            source: relationship.source.id,
            target: relationship.target.id,
            label,
            predicateLabel: relationship.predicate_label || '',
            relation: relationship.relation,
            isInferred,
            lineStyle: isInferred ? 'dashed' : 'solid',
          },
          classes: isInferred ? 'inferred-edge' : 'asserted-edge',
        }
      }),
    ]

    const runLayoutInternal = (name: string = layoutName) => {
      const cy = cyRef.current
      if (!cy || nodeCount === 0) return

      const isLarge = nodeCount > 200
      const duration = prefersReducedMotion ? 0 : isLarge ? 0 : 360
      const animate = !prefersReducedMotion && !isLarge

      let layoutConfig: Record<string, unknown> = {
        name,
        animate,
        animationDuration: duration,
        fit: true,
        padding: 64,
      }

      if (name === 'breadthfirst') {
        layoutConfig = {
          ...layoutConfig,
          roots: selectedId ? [selectedId] : undefined,
          directed: false,
          spacingFactor: 1.6,
          avoidOverlap: true,
        }
      } else if (name === 'cose') {
        layoutConfig = {
          ...layoutConfig,
          randomize: false,
          nodeRepulsion: () => 2048,
          idealEdgeLength: () => 80,
          edgeElasticity: () => 100,
          gravity: 0.25,
          numIter: prefersReducedMotion ? 200 : 500,
        }
      } else if (name === 'dagre') {
        layoutConfig = {
          ...layoutConfig,
          rankDir: 'TB',
          nodeSep: 50,
          rankSep: 80,
          edgeSep: 20,
        }
      } else if (name === 'circle') {
        layoutConfig = {
          ...layoutConfig,
          radius: Math.max(120, nodeCount * 18),
          spacingFactor: 1.2,
          avoidOverlap: true,
        }
      } else if (name === 'concentric') {
        layoutConfig = {
          ...layoutConfig,
          concentric: (node: { id: () => string }) => (node.id() === selectedId ? 10 : 1),
          levelWidth: () => 2,
          spacingFactor: 1.4,
          avoidOverlap: true,
        }
      }

      // Respect pinned nodes: lock them during layout
      cy.nodes().forEach((node) => {
        if (pinnedNodeIds.includes(node.id())) {
          node.lock()
        } else {
          node.unlock()
        }
      })

      try {
        cy.layout(layoutConfig as never).run()
      } catch {
        // Fallback to breadthfirst if chosen algorithm fails (e.g. dagre)
        cy.layout({
          name: 'breadthfirst',
          animate: false,
          fit: true,
          padding: 64,
        } as never).run()
      }
    }

    useImperativeHandle(ref, () => ({
      fit() {
        const cy = cyRef.current
        if (!cy) return
        if (prefersReducedMotion) {
          cy.fit(undefined, 48)
        } else {
          cy.animate({
            fit: { eles: cy.elements(), padding: 48 },
            duration: 300,
          })
        }
      },
      focusNode(id: string) {
        const cy = cyRef.current
        if (!cy) return
        const node = cy.getElementById(id)
        if (node && node.length > 0) {
          if (prefersReducedMotion) {
            cy.center(node)
            cy.zoom(1.4)
          } else {
            cy.animate({
              center: { eles: node },
              zoom: 1.4,
              duration: 350,
            })
          }
        }
      },
      runLayout(name?: string) {
        runLayoutInternal(name || layoutName)
      },
      getCy() {
        return cyRef.current
      },
    }))

    // Re-run layout when node count, edge count, or layout name changes
    useEffect(() => {
      const cy = cyRef.current
      if (!cy || nodeCount === 0) return

      const timer = window.setTimeout(() => {
        runLayoutInternal(layoutName)
      }, 60)

      return () => window.clearTimeout(timer)
    }, [nodeCount, edgeCount, layoutName])

    function onReady(cy: Core) {
      cyRef.current = cy

      // Apply initial pinned status
      cy.nodes().forEach((node) => {
        if (pinnedNodeIds.includes(node.id())) {
          node.lock()
        } else {
          node.unlock()
        }
      })

      cy.removeListener('tap', 'node')
      cy.on('tap', 'node', (event) => onSelectEntity(event.target.id()))
    }

    // Dynamic stylesheet supporting node shapes and inferred edges
    const stylesheet: unknown[] = [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          shape: 'data(shape)',
          'background-color': 'data(color)',
          color: '#173b37',
          'font-family': 'Manrope, sans-serif',
          'font-size': '10px',
          'font-weight': 700,
          'text-wrap': 'wrap',
          'text-max-width': '72px',
          'text-valign': 'bottom',
          'text-margin-y': '12px',
          'min-zoomed-font-size': '8px',
          width: '54px',
          height: '54px',
          'border-width': '3px',
          'border-color': '#ffffff',
          'overlay-opacity': 0,
        },
      },
      // Shape-specific styling
      {
        selector: 'node.shape-diamond, node[shape="diamond"]',
        style: {
          shape: 'diamond',
          width: '58px',
          height: '58px',
        },
      },
      {
        selector: 'node.shape-rectangle, node[shape="rectangle"]',
        style: {
          shape: 'rectangle',
          width: '60px',
          height: '40px',
        },
      },
      {
        selector: 'node.shape-ellipse, node[shape="ellipse"]',
        style: {
          shape: 'ellipse',
          width: '54px',
          height: '54px',
        },
      },
      {
        selector: 'node.shape-round-rectangle, node[shape="round-rectangle"]',
        style: {
          shape: 'round-rectangle',
          width: '56px',
          height: '44px',
        },
      },
      // Category colors mapping from props
      ...Object.entries(categoryColors || defaultCategoryColors).map(
        ([category, color]) => ({
          selector: `node.${category.toLowerCase()}`,
          style: { 'background-color': color },
        }),
      ),
      // Selection highlight
      {
        selector: 'node:selected',
        style: {
          'border-color': '#173b37',
          'border-width': '5px',
        },
      },
      // Pinned node border indicator
      {
        selector: 'node.pinned',
        style: {
          'border-color': '#d7972f',
          'border-width': '4px',
        },
      },
      // Default edge styling
      {
        selector: 'edge',
        style: {
          width: '2px',
          'line-color': '#aebdb7',
          'target-arrow-color': '#aebdb7',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: showEdgeLabels ? 'data(label)' : '',
          color: '#49635e',
          'font-size': '10px',
          'font-family': 'Manrope, sans-serif',
          'text-background-color': '#fffdf8',
          'text-background-opacity': 1,
          'text-background-padding': '3px',
          'text-rotation': 'autorotate',
          'min-zoomed-font-size': '9px',
        },
      },
      // RC-001: Asserted edges solid line
      {
        selector: 'edge.asserted-edge, edge[lineStyle="solid"]',
        style: {
          'line-style': 'solid',
          'line-color': '#aebdb7',
          'target-arrow-color': '#aebdb7',
        },
      },
      // RC-001: Inferred edges dashed line
      {
        selector: 'edge.inferred-edge, edge[lineStyle="dashed"]',
        style: {
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3],
          'line-color': '#7c8ba1',
          'target-arrow-color': '#7c8ba1',
        },
      },
    ]

    return (
      <CytoscapeComponent
        elements={elements}
        cy={onReady}
        style={{ width: '100%', height: '100%' }}
        pixelRatio={1}
        hideEdgesOnViewport={edgeCount > 500}
        stylesheet={stylesheet as never}
        layout={{ name: 'preset' }}
      />
    )
  },
)

export default CytoscapeGraph
