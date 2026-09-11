import { startTransition, useDeferredValue, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  Crosshair,
  LoaderCircle,
  Network,
  Plus,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react'
import './App.css'
import {
  type GraphEntity,
  type GraphExpansion,
  type ExpansionRequest,
  type TraversalDirection,
  entityKind,
  expandGraph,
  searchEntities,
  fetchProfile,
} from './api/graph'
import CytoscapeGraph, { type GraphRendererHandle } from './graph/CytoscapeGraph'
import {
  DEFAULT_VISIBLE_LIMITS,
  addStandaloneEntity,
  collapseExpansion,
  emptyGraph,
  mergeExpansion as mergeGraphExpansion,
  relationshipsForEntity,
  type ExpansionRecord,
  type ExplorerGraph,
} from './graph/state'


function typeLabel(entity: GraphEntity): string {
  return entityKind(entity).toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function App() {
  const [searchInput, setSearchInput] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [graph, setGraph] = useState<ExplorerGraph>(emptyGraph)
  const [expansionHistory, setExpansionHistory] = useState<ExpansionRecord[]>([])
  const [nextCursorByEntity, setNextCursorByEntity] = useState<Record<string, string | null>>({})
  const [direction, setDirection] = useState<TraversalDirection>('BOTH')
  const [selectedRelations, setSelectedRelations] = useState<string[]>([])
  const [includeInferred, setIncludeInferred] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(searchInput.trim())
  const rendererRef = useRef<GraphRendererHandle | null>(null)

  const profileQuery = useQuery({
    queryKey: ['active-profile'],
    queryFn: () => fetchProfile(),
  })

  const profile = profileQuery.data
  const RELATION_OPTIONS = profile?.predicates.filter(p => !p.hidden && p.traversable).map(p => p.name) || []
  
  const categoryColors = profile?.categories.reduce((acc, cat) => {
    if (cat.color) {
      acc[cat.name.toLowerCase()] = cat.color
    }
    return acc
  }, {} as Record<string, string>)

  const searchQuery = useQuery({
    queryKey: ['entity-search', deferredSearch],
    queryFn: () => searchEntities(deferredSearch),
    enabled: deferredSearch.length >= 2 && !!profile,
  })

  const relationshipsMutation = useMutation({
    mutationFn: (request: ExpansionRequest) => expandGraph(request),
  })

  const selectedEntity = selectedId ? graph.entities[selectedId] : undefined
  const nodeCount = Object.keys(graph.entities).length
  const edgeCount = Object.keys(graph.relationships).length
  const visibleRelationships = selectedEntity
    ? relationshipsForEntity(graph, selectedEntity.id)
    : []

  function applyExpansion(expansion: GraphExpansion) {
    const result = mergeGraphExpansion(graph, expansion, DEFAULT_VISIBLE_LIMITS)
    startTransition(() => {
      setGraph(result.graph)
      if (
        result.record.addedNodeIds.length > 0 ||
        result.record.addedRelationshipIds.length > 0
      ) {
        setExpansionHistory((current) => [...current.slice(-19), result.record])
      }
      setNextCursorByEntity((current) => ({
        ...current,
        [expansion.center.id]: result.limitReached
          ? null
          : expansion.page_info.next_cursor,
      }))
    })
    return result
  }

  function expansionRequest(id: string, cursor: string | null): ExpansionRequest {
    return {
      id,
      cursor,
      direction,
      relations: selectedRelations,
      includeInferred,
    }
  }

  function updateNotice(expansion: GraphExpansion, limitReached: boolean) {
    if (limitReached) {
      setNotice(
        `Visible graph limit reached (${DEFAULT_VISIBLE_LIMITS.maxNodes} nodes / ${DEFAULT_VISIBLE_LIMITS.maxEdges} edges). Undo or reset before expanding further.`,
      )
    } else if (expansion.page_info.truncated) {
      setNotice('More relationships are available for this entity.')
    }
  }

  async function inspectEntity(entity: GraphEntity) {
    setNotice(null)
    setSelectedId(entity.id)
    setGraph((current) => addStandaloneEntity(current, entity))
    try {
      const expansion = await relationshipsMutation.mutateAsync(
        expansionRequest(entity.id, null),
      )
      const result = applyExpansion(expansion)
      updateNotice(expansion, result.limitReached)
    } catch {
      setNotice('The graph service could not load relationships for this entity.')
    }
  }

  async function expandSelected() {
    if (!selectedEntity) {
      return
    }
    setNotice(null)
    try {
      const expansion = await relationshipsMutation.mutateAsync(
        expansionRequest(
          selectedEntity.id,
          nextCursorByEntity[selectedEntity.id] ?? null,
        ),
      )
      const result = applyExpansion(expansion)
      updateNotice(expansion, result.limitReached)
    } catch {
      setNotice('The graph service could not load relationships for this entity.')
    }
  }

  function resetGraph() {
    setGraph(emptyGraph)
    setSelectedId(null)
    setExpansionHistory([])
    setNextCursorByEntity({})
    setNotice(null)
  }

  function fitGraph() {
    rendererRef.current?.fit()
  }

  function undoLastExpansion() {
    const lastExpansion = expansionHistory.at(-1)
    if (!lastExpansion) {
      return
    }
    const collapsed = collapseExpansion(graph, lastExpansion)
    setGraph(collapsed)
    setExpansionHistory((current) => current.slice(0, -1))
    setNextCursorByEntity((current) => {
      const next = { ...current }
      delete next[lastExpansion.centerId]
      return next
    })
    if (selectedId && !collapsed.entities[selectedId]) {
      setSelectedId(null)
    }
    setNotice(null)
  }

  function toggleRelation(relation: string) {
    setNextCursorByEntity({})
    setSelectedRelations((current) =>
      current.includes(relation)
        ? current.filter((value) => value !== relation)
        : [...current, relation],
    )
  }

  function changeDirection(value: TraversalDirection) {
    setNextCursorByEntity({})
    setDirection(value)
  }

  function changeInferenceFilter(value: boolean) {
    setNextCursorByEntity({})
    setIncludeInferred(value)
  }

  return (
    <main className="explorer-shell">
      {profile && (
        <style>
          {profile.categories.map(cat => cat.color ? `.${cat.name.toLowerCase()} { background: ${cat.color} !important; }` : '').join('\n')}
        </style>
      )}
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><Network size={22} /></div>
          <div>
            <p className="eyebrow">{profile?.metadata.description ?? 'Loading profile...'}</p>
            <h1>{profile?.metadata.title ?? 'Graph Explorer'}</h1>
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
              <button type="button" title="Undo last expansion" aria-label="Undo last expansion" onClick={undoLastExpansion} disabled={expansionHistory.length === 0}>
                <Undo2 size={18} />
              </button>
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
            <CytoscapeGraph
              ref={rendererRef}
              graph={graph}
              selectedId={selectedId}
              categoryColors={categoryColors}
              onSelectEntity={setSelectedId}
            />
          </div>
          <div className="legend" aria-label="Node legend">
            {profile?.categories.map((cat) => (
              <span key={cat.name}><i className={cat.name.toLowerCase()} /> {cat.label || cat.name}</span>
            ))}
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

              <div className="traversal-controls">
                <p className="eyebrow">Traversal filters</p>
                <div className="direction-control" role="group" aria-label="Relationship direction">
                  {(['BOTH', 'OUTGOING', 'INCOMING'] as TraversalDirection[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={direction === value ? 'active' : ''}
                      aria-pressed={direction === value}
                      onClick={() => changeDirection(value)}
                    >
                      {value === 'BOTH' ? 'Both' : value === 'OUTGOING' ? 'Out' : 'In'}
                    </button>
                  ))}
                </div>
                <fieldset className="relation-filters">
                  <legend>Relationships</legend>
                  {RELATION_OPTIONS.map((relation) => (
                    <label key={relation}>
                      <input
                        type="checkbox"
                        checked={selectedRelations.includes(relation)}
                        onChange={() => toggleRelation(relation)}
                      />
                      {relation}
                    </label>
                  ))}
                </fieldset>
                <label className="inference-toggle">
                  <input
                    type="checkbox"
                    checked={includeInferred}
                    onChange={(event) => changeInferenceFilter(event.target.checked)}
                  />
                  Include inferred relationships
                </label>
              </div>

              <button
                type="button"
                className="primary-action"
                onClick={() => void expandSelected()}
                disabled={relationshipsMutation.isPending}
              >
                {relationshipsMutation.isPending ? <LoaderCircle size={17} className="spin" /> : <Network size={17} />}
                {nextCursorByEntity[selectedEntity.id]
                  ? 'Load more relationships'
                  : 'Refresh relationships'}
              </button>

              <div className="relation-summary">
                <p className="eyebrow">Visible connections</p>
                {visibleRelationships.length > 0 && (
                  <table className="relationship-table">
                    <thead>
                      <tr><th>Dir</th><th>Relation</th><th>Entity</th></tr>
                    </thead>
                    <tbody>
                      {visibleRelationships.map((relationship) => {
                        const outgoing = relationship.source.id === selectedEntity.id
                        const neighbor = outgoing ? relationship.target : relationship.source
                        return (
                          <tr key={`${relationship.source.id}|${relationship.relation}|${relationship.target.id}`}>
                            <td><span className="direction-badge" title={outgoing ? 'Outgoing' : 'Incoming'}>{outgoing ? '→' : '←'}</span></td>
                            <td>{relationship.relation}</td>
                            <td><button type="button" onClick={() => setSelectedId(neighbor.id)}>{neighbor.label}</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {visibleRelationships.length === 0 && (
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
