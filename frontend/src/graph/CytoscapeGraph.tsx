import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core, ElementDefinition } from 'cytoscape'

import { entityKind } from '../api/graph'
import type { ExplorerGraph } from './state'
import { relationshipKey } from './state'

export interface GraphRendererHandle {
  fit(): void
}

interface CytoscapeGraphProps {
  graph: ExplorerGraph
  selectedId: string | null
  onSelectEntity(id: string): void
}

const CytoscapeGraph = forwardRef<GraphRendererHandle, CytoscapeGraphProps>(
  function CytoscapeGraph({ graph, selectedId, onSelectEntity }, ref) {
    const cyRef = useRef<Core | null>(null)
    const nodeCount = Object.keys(graph.entities).length
    const edgeCount = Object.keys(graph.relationships).length
    const showEdgeLabels = edgeCount <= 200

    const elements: ElementDefinition[] = [
      ...Object.values(graph.entities).map((entity) => ({
        data: { id: entity.id, label: entity.label },
        classes: entityKind(entity).toLowerCase(),
      })),
      ...Object.values(graph.relationships).map((relationship) => ({
        data: {
          id: relationshipKey(relationship),
          source: relationship.source.id,
          target: relationship.target.id,
          label: relationship.relation,
        },
      })),
    ]

    useImperativeHandle(ref, () => ({
      fit() {
        cyRef.current?.fit(undefined, 48)
      },
    }))

    useEffect(() => {
      const cy = cyRef.current
      if (!cy || nodeCount === 0) {
        return
      }
      const timer = window.setTimeout(() => {
        cy.layout({
          name: 'breadthfirst',
          animate: nodeCount <= 200,
          animationDuration: 360,
          fit: true,
          padding: 84,
          roots: selectedId ? [selectedId] : undefined,
          directed: false,
          spacingFactor: 1.7,
          avoidOverlap: true,
        }).run()
      }, 80)
      return () => window.clearTimeout(timer)
    }, [nodeCount, edgeCount, selectedId])

    function onReady(cy: Core) {
      cyRef.current = cy
      cy.removeListener('tap', 'node')
      cy.on('tap', 'node', (event) => onSelectEntity(event.target.id()))
    }

    return (
      <CytoscapeComponent
        elements={elements}
        cy={onReady}
        style={{ width: '100%', height: '100%' }}
        pixelRatio={1}
        hideEdgesOnViewport={edgeCount > 500}
        stylesheet={[
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              color: '#173b37',
              'font-family': 'Manrope',
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
          { selector: 'node.wine', style: { 'background-color': '#b83c50' } },
          { selector: 'node.winery', style: { 'background-color': '#d7972f' } },
          { selector: 'node.region', style: { 'background-color': '#287b73' } },
          { selector: 'node.grape', style: { 'background-color': '#6c5ca4' } },
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
              'font-family': 'Manrope',
              'text-background-color': '#fffdf8',
              'text-background-opacity': 1,
              'text-background-padding': '3px',
              'text-rotation': 'autorotate',
              'min-zoomed-font-size': '9px',
            },
          },
          {
            selector: 'node:selected',
            style: { 'border-color': '#173b37', 'border-width': '5px' },
          },
        ] as never}
        layout={{ name: 'preset' }}
      />
    )
  },
)

export default CytoscapeGraph