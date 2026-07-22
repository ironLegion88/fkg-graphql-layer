import { useDeferredValue, useEffect, useRef, useState, startTransition } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import CytoscapeComponent from 'react-cytoscapejs'
import type { Core, ElementDefinition } from 'cytoscape'
import {
  CircleAlert,
  Crosshair,
  LoaderCircle,
  Network,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import './App.css'
import {
  type GraphEntity,
  type GraphRelationship,
  entityKind,
  getRelationships,
  searchEntities,
} from './api/graph'

interface ExplorerGraph {
  entities: Record<string, GraphEntity>
  relationships: Record<string, GraphRelationship>
}

const emptyGraph: ExplorerGraph = { entities: {}, relationships: {} }

function relationshipKey(relationship: GraphRelationship): string {
  return `${relationship.source.id}|${relationship.relation}|${relationship.target.id}`
}

function typeLabel(entity: GraphEntity): string {
  return entityKind(entity).toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function App() {
  const [searchInput, setSearchInput] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [graph, setGraph] = useState<ExplorerGraph>(emptyGraph)
  const [notice, setNotice] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(searchInput.trim())
  const cyRef = useRef<Core | null>(null)

  const searchQuery = useQuery({
    queryKey: ['entity-search', deferredSearch],
    queryFn: () => searchEntities(deferredSearch),
    enabled: deferredSearch.length >= 2,
  })

  const relationshipsMutation = useMutation({
    mutationFn: getRelationships,
  })

  const selectedEntity = selectedId ? graph.entities[selectedId] : undefined
  const nodeCount = Object.keys(graph.entities).length
  const edgeCount = Object.keys(graph.relationships).length

  const graphElements: ElementDefinition[] = [
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

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || nodeCount === 0) {
      return
    }
    const timer = window.setTimeout(() => {
      cy.layout({
        name: 'breadthfirst',
        animate: true,
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

  function mergeRelationships(relationships: GraphRelationship[]) {
    startTransition(() => {
      setGraph((current) => {
        const entities = { ...current.entities }
        const nextRelationships = { ...current.relationships }
        for (const relationship of relationships) {
          entities[relationship.source.id] = relationship.source
          entities[relationship.target.id] = relationship.target
          nextRelationships[relationshipKey(relationship)] = relationship
        }
        return { entities, relationships: nextRelationships }
      })
    })
  }

  async function inspectEntity(entity: GraphEntity) {
    setNotice(null)
    setSelectedId(entity.id)
    setGraph((current) => ({
      ...current,
      entities: { ...current.entities, [entity.id]: entity },
    }))
    try {
      const relationships = await relationshipsMutation.mutateAsync(entity.id)
      mergeRelationships(relationships)
    } catch {
      setNotice('The graph service could not load relationships for this entity.')
    }
  }

  async function expandSelected() {
    if (!selectedEntity) {
      return
    }
    await inspectEntity(selectedEntity)
  }

  function resetGraph() {
    setGraph(emptyGraph)
    setSelectedId(null)
    setNotice(null)
  }

  function fitGraph() {
    cyRef.current?.fit(undefined, 48)
  }

  function onGraphReady(cy: Core) {
    cyRef.current = cy
    if (cy.scratch('wine-node-tap-bound')) {
      return
    }
    cy.on('tap', 'node', (event) => {
      const entity = graph.entities[event.target.id()]
      if (entity) {
        void inspectEntity(entity)
      }
    })
    cy.scratch('wine-node-tap-bound', true)
  }

  return (
    <main className="explorer-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Network size={22} /></div>
          <div>
            <p className="eyebrow">Sample Wines Knowledge Graph</p>
            <h1>Wine Graph Explorer</h1>
          </div>
        </div>
        <div className="graph-stats" aria-label="Current graph size">
          <span>{nodeCount} nodes</span>
          <span>{edgeCount} edges</span>
        </div>
      </header>

      <section className="explorer-layout" aria-label="Wine graph workspace">
        <aside className="search-panel">
          <div className="panel-heading">
            <p className="eyebrow">Discover</p>
            <h2>Find an entity</h2>
          </div>
          <label className="search-input" htmlFor="entity-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="entity-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Wine, winery, region..."
              autoComplete="off"
            />
            {searchInput && (
              <button
                type="button"
                title="Clear search"
                aria-label="Clear search"
                onClick={() => setSearchInput('')}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <p className="search-hint">Enter at least two letters to search the knowledge graph.</p>

          <div className="search-results" aria-live="polite">
            {searchQuery.isFetching && <p className="status-line"><LoaderCircle size={16} className="spin" /> Searching</p>}
            {searchQuery.isError && <p className="error-line"><CircleAlert size={16} /> GraphQL search is unavailable.</p>}
            {searchQuery.data?.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className="entity-result"
                onClick={() => void inspectEntity(entity)}
              >
                <span className={`kind-dot ${entityKind(entity).toLowerCase()}`} aria-hidden="true" />
                <span className="entity-result-copy">
                  <strong>{entity.label}</strong>
                  <small>{typeLabel(entity)}</small>
                </span>
                <Plus size={16} aria-hidden="true" />
              </button>
            ))}
            {deferredSearch.length >= 2 && !searchQuery.isFetching && searchQuery.data?.length === 0 && (
              <p className="empty-copy">No matching entities found.</p>
            )}
          </div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div>
              <p className="eyebrow">Explore</p>
              <h2>Relationship map</h2>
            </div>
            <div className="icon-actions">
              <button type="button" title="Fit graph" aria-label="Fit graph" onClick={fitGraph} disabled={nodeCount === 0}>
                <Crosshair size={18} />
              </button>
              <button type="button" title="Reset graph" aria-label="Reset graph" onClick={resetGraph} disabled={nodeCount === 0}>
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {notice && <div className="graph-notice"><CircleAlert size={17} /> {notice}</div>}

          <div className="graph-canvas">
            {nodeCount === 0 && (
              <div className="empty-graph">
                <Network size={34} aria-hidden="true" />
                <h3>Start with a wine, place, grape, or winery</h3>
                <p>Search on the left, then choose an entity to reveal its connected graph.</p>
              </div>
            )}
            <CytoscapeComponent
              elements={graphElements}
              cy={onGraphReady}
              style={{ width: '100%', height: '100%' }}
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
                    label: 'data(label)',
                    color: '#49635e',
                    'font-size': '10px',
                    'font-family': 'Manrope',
                    'text-background-color': '#fffdf8',
                    'text-background-opacity': 1,
                    'text-background-padding': '3px',
                    'text-rotation': 'autorotate',
                  },
                },
                {
                  selector: 'node:selected',
                  style: { 'border-color': '#173b37', 'border-width': '5px' },
                },
              ] as never}
              layout={{ name: 'cose', fit: true, padding: 48 }}
            />
          </div>
          <div className="legend" aria-label="Node legend">
            <span><i className="wine" /> Wine</span>
            <span><i className="winery" /> Winery</span>
            <span><i className="region" /> Region</span>
            <span><i className="grape" /> Grape</span>
          </div>
        </section>

        <aside className="detail-panel">
          <div className="panel-heading">
            <p className="eyebrow">Inspect</p>
            <h2>Selected entity</h2>
          </div>
          {!selectedEntity && <p className="empty-copy detail-empty">Select a search result or graph node to view its details.</p>}
          {selectedEntity && (
            <div className="selected-entity">
              <span className={`entity-kind ${entityKind(selectedEntity).toLowerCase()}`}>{typeLabel(selectedEntity)}</span>
              <h3>{selectedEntity.label}</h3>
              <p className="entity-id">{selectedEntity.id}</p>
              {selectedEntity.description && <p className="entity-description">{selectedEntity.description}</p>}
              <button
                type="button"
                className="primary-action"
                onClick={() => void expandSelected()}
                disabled={relationshipsMutation.isPending}
              >
                {relationshipsMutation.isPending ? <LoaderCircle size={17} className="spin" /> : <Network size={17} />}
                Expand relationships
              </button>

              <div className="relation-summary">
                <p className="eyebrow">Visible connections</p>
                {Object.values(graph.relationships)
                  .filter((relationship) => relationship.source.id === selectedEntity.id || relationship.target.id === selectedEntity.id)
                  .map((relationship) => (
                    <div className="relation-row" key={relationshipKey(relationship)}>
                      <span>{relationship.relation}</span>
                      <strong>{relationship.source.id === selectedEntity.id ? relationship.target.label : relationship.source.label}</strong>
                    </div>
                  ))}
                {Object.values(graph.relationships).every((relationship) => relationship.source.id !== selectedEntity.id && relationship.target.id !== selectedEntity.id) && (
                  <p className="empty-copy">No graph relationships are available for this entity.</p>
                )}
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}

export default App
