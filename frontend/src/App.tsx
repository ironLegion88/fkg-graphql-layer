import { startTransition, useEffect, useRef, useState, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  Crosshair,
  LoaderCircle,
  Network,
  RotateCcw,
  Undo2,
  Redo2,
  Search,
  FolderTree,
  Binary,
  Layers,
} from 'lucide-react'
import './App.css'
import {
  type GraphEntity,
  type GraphExpansion,
  type GraphRelationship,
  type ExpansionRequest,
  type TraversalDirection,
  type ExpansionPreview,
  type PreviewGroup,
  expandGraph,
  fetchProfile,
  getExpansionPreview,
} from './api/graph'
import { InspectorPanel } from './inspector'
import CytoscapeGraph, { type GraphRendererHandle } from './graph/CytoscapeGraph'
import { ExpansionPreviewDialog } from './graph/ExpansionPreviewDialog'
import {
  DEFAULT_VISIBLE_LIMITS,
  addStandaloneEntity,
  emptyGraph,
  mergeExpansion as mergeGraphExpansion,
  relationshipsForEntity,
  initialUndoRedoStack,
  pushUndoExpansion,
  applyUndo,
  applyRedo,
  type ExplorerGraph,
  type UndoRedoStack,
} from './graph/state'
import { AppShell } from './shell/AppShell'
import { SearchPanel } from './navigation/SearchPanel'
import { ClassTree } from './navigation/ClassTree'
import { PropertyBrowser } from './navigation/PropertyBrowser'
import { CommandPalette, type CommandPaletteAction } from './navigation/CommandPalette'
import { SemanticLegend } from './navigation/SemanticLegend'
import { LanguageSelector } from './navigation/LanguageSelector'

type NavTab = 'search' | 'classes' | 'properties'

function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [graph, setGraph] = useState<ExplorerGraph>(emptyGraph)
  const [undoRedoStack, setUndoRedoStack] = useState<UndoRedoStack>(initialUndoRedoStack)
  const [nextCursorByEntity, setNextCursorByEntity] = useState<Record<string, string | null>>({})
  const [direction, setDirection] = useState<TraversalDirection>('BOTH')
  const [selectedRelations, setSelectedRelations] = useState<string[]>([])
  const [includeInferred, setIncludeInferred] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('search')
  const [currentLanguage, setCurrentLanguage] = useState('en')
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState<GraphRelationship | null>(null)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [expansionPreview, setExpansionPreview] = useState<ExpansionPreview | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewTargetEntity, setPreviewTargetEntity] = useState<GraphEntity | null>(null)

  const rendererRef = useRef<GraphRendererHandle | null>(null)

  const {
    data: profile,
    isLoading: isProfileLoading,
    error: profileError,
  } = useQuery({
    queryKey: ['active-profile'],
    queryFn: () => fetchProfile(),
  })

  const RELATION_OPTIONS = useMemo(() => {
    return profile?.predicates.filter((p) => !p.hidden && p.traversable).map((p) => p.name) || []
  }, [profile])

  const categoryColors = useMemo(() => {
    return profile?.categories.reduce((acc, cat) => {
      if (cat.color) {
        acc[cat.name.toLowerCase()] = cat.color
      }
      return acc
    }, {} as Record<string, string>)
  }, [profile])

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
        setUndoRedoStack((current) => pushUndoExpansion(current, result.record))
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
    setSelectedRelationship(null)
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

  async function performExpansion(
    id: string,
    cursor: string | null = null,
    dir: TraversalDirection = direction,
    relations: string[] = selectedRelations,
    inferred: boolean = includeInferred,
  ) {
    setNotice(null)
    try {
      const expansion = await relationshipsMutation.mutateAsync({
        id,
        cursor,
        direction: dir,
        relations: relations.length > 0 ? relations : undefined,
        includeInferred: inferred,
      })
      const result = applyExpansion(expansion)
      updateNotice(expansion, result.limitReached)
      return result
    } catch {
      setNotice('The graph service could not load relationships for this entity.')
      return null
    }
  }

  async function expandSelected(forcePreview = false) {
    if (!selectedEntity) {
      return
    }
    setNotice(null)
    setIsPreviewLoading(true)
    setPreviewTargetEntity(selectedEntity)

    try {
      const preview = await getExpansionPreview(selectedEntity.id)
      setExpansionPreview(preview)
      setIsPreviewLoading(false)

      // GE-003, GQ-108: If total count is small (< 10) and preview not explicitly forced, auto-expand
      if (preview.total_count < 10 && !forcePreview) {
        await performExpansion(
          selectedEntity.id,
          nextCursorByEntity[selectedEntity.id] ?? null,
          direction,
          selectedRelations,
          includeInferred,
        )
        setPreviewTargetEntity(null)
        setExpansionPreview(null)
      } else {
        // High-degree node or forced preview: show preview dialog
        setIsPreviewDialogOpen(true)
      }
    } catch {
      setIsPreviewLoading(false)
      // Fallback to direct expansion if preview query encounters an error
      await performExpansion(
        selectedEntity.id,
        nextCursorByEntity[selectedEntity.id] ?? null,
        direction,
        selectedRelations,
        includeInferred,
      )
      setPreviewTargetEntity(null)
      setExpansionPreview(null)
    }
  }

  async function handleConfirmPreviewExpand(selectedGroups: PreviewGroup[]) {
    if (!previewTargetEntity) return
    setIsPreviewDialogOpen(false)

    // Extract selected relations - never add nodes for rejected predicates
    const chosenRelations = Array.from(new Set(selectedGroups.map((g) => g.relation)))
    const hasOutgoing = selectedGroups.some((g) => g.direction === 'OUTGOING' || g.direction === 'BOTH')
    const hasIncoming = selectedGroups.some((g) => g.direction === 'INCOMING' || g.direction === 'BOTH')
    const chosenDirection: TraversalDirection =
      hasOutgoing && hasIncoming ? 'BOTH' : hasOutgoing ? 'OUTGOING' : 'INCOMING'

    await performExpansion(
      previewTargetEntity.id,
      null,
      chosenDirection,
      chosenRelations,
      includeInferred,
    )
    setPreviewTargetEntity(null)
    setExpansionPreview(null)
  }

  function resetGraph() {
    setGraph(emptyGraph)
    setSelectedId(null)
    setSelectedRelationship(null)
    setUndoRedoStack(initialUndoRedoStack)
    setNextCursorByEntity({})
    setNotice(null)
  }

  function fitGraph() {
    rendererRef.current?.fit()
  }

  function handleUndo() {
    const { graph: newGraph, stack: newStack, undoneRecord } = applyUndo(graph, undoRedoStack)
    if (!undoneRecord) {
      return
    }
    setGraph(newGraph)
    setUndoRedoStack(newStack)
    setNextCursorByEntity((current) => {
      const next = { ...current }
      delete next[undoneRecord.centerId]
      return next
    })
    if (selectedId && !newGraph.entities[selectedId]) {
      setSelectedId(null)
    }
    setNotice(null)
  }

  function handleRedo() {
    const { graph: newGraph, stack: newStack, redoneRecord } = applyRedo(
      graph,
      undoRedoStack,
      DEFAULT_VISIBLE_LIMITS,
    )
    if (!redoneRecord) {
      return
    }
    setGraph(newGraph)
    setUndoRedoStack(newStack)
    setNotice(null)
  }

  // Keyboard shortcut listener for Undo (Ctrl+Z) and Redo (Ctrl+Shift+Z / Ctrl+Y)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (event.shiftKey) {
          event.preventDefault()
          handleRedo()
        } else {
          event.preventDefault()
          handleUndo()
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [graph, undoRedoStack])

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

  // Command palette actions
  const commandActions: CommandPaletteAction[] = [
    {
      id: 'tab-search',
      title: 'Switch to Search Tab',
      subtitle: 'Search individual entities',
      shortcut: 'S',
      onSelect: () => setActiveNavTab('search'),
    },
    {
      id: 'tab-classes',
      title: 'Switch to Classes Tree',
      subtitle: 'Browse ontology class hierarchy',
      shortcut: 'C',
      onSelect: () => setActiveNavTab('classes'),
    },
    {
      id: 'tab-properties',
      title: 'Switch to Properties Browser',
      subtitle: 'Browse object and datatype properties',
      shortcut: 'P',
      onSelect: () => setActiveNavTab('properties'),
    },
    {
      id: 'graph-fit',
      title: 'Fit Graph View',
      subtitle: 'Zoom to fit all visible nodes on canvas',
      shortcut: 'F',
      onSelect: fitGraph,
    },
    {
      id: 'graph-undo',
      title: 'Undo Last Expansion',
      subtitle: 'Roll back the latest expanded neighborhood',
      shortcut: 'Ctrl+Z',
      onSelect: handleUndo,
    },
    {
      id: 'graph-redo',
      title: 'Redo Expansion',
      subtitle: 'Reapply the previously undone expansion',
      shortcut: 'Ctrl+Shift+Z',
      onSelect: handleRedo,
    },
    {
      id: 'graph-reset',
      title: 'Reset Graph Canvas',
      subtitle: 'Clear all nodes and start fresh',
      onSelect: resetGraph,
    },
    ...(selectedEntity
      ? [
          {
            id: 'graph-expand-selected',
            title: `Expand "${selectedEntity.label}"`,
            subtitle: `Load relationships for ${selectedEntity.id}`,
            shortcut: 'E',
            onSelect: () => void expandSelected(),
          },
        ]
      : []),
  ]

  // Left Navigation Panel Content
  const navigationContent = (
    <div className="nav-panel-wrapper">
      <div className="nav-tab-bar" role="tablist" aria-label="Ontology Navigation Views">
        <button
          type="button"
          role="tab"
          id="tab-search-btn"
          aria-selected={activeNavTab === 'search'}
          aria-controls="tab-search-panel"
          className={`nav-tab-btn ${activeNavTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('search')}
        >
          <Search size={14} aria-hidden="true" />
          <span>Search</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-classes-btn"
          aria-selected={activeNavTab === 'classes'}
          aria-controls="tab-classes-panel"
          className={`nav-tab-btn ${activeNavTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('classes')}
        >
          <FolderTree size={14} aria-hidden="true" />
          <span>Classes</span>
        </button>
        <button
          type="button"
          role="tab"
          id="tab-properties-btn"
          aria-selected={activeNavTab === 'properties'}
          aria-controls="tab-properties-panel"
          className={`nav-tab-btn ${activeNavTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveNavTab('properties')}
        >
          <Binary size={14} aria-hidden="true" />
          <span>Properties</span>
        </button>
      </div>

      <div className="nav-tab-content">
        {activeNavTab === 'search' && (
          <div id="tab-search-panel" role="tabpanel" aria-labelledby="tab-search-btn">
            <SearchPanel
              profile={profile}
              onSelectEntity={(entity) => void inspectEntity(entity)}
              selectedEntityId={selectedId}
            />
          </div>
        )}

        {activeNavTab === 'classes' && (
          <div id="tab-classes-panel" role="tabpanel" aria-labelledby="tab-classes-btn">
            <ClassTree
              onSelectClass={(iri, label) => {
                const classEntity: GraphEntity = {
                  __typename: 'OntologyEntity',
                  id: iri,
                  label,
                  description: null,
                  kind: 'Class',
                }
                void inspectEntity(classEntity)
              }}
              selectedIri={selectedId}
            />
          </div>
        )}

        {activeNavTab === 'properties' && (
          <div id="tab-properties-panel" role="tabpanel" aria-labelledby="tab-properties-btn">
            <PropertyBrowser
              onSelectProperty={(iri, label) => {
                const propertyEntity: GraphEntity = {
                  __typename: 'OntologyEntity',
                  id: iri,
                  label,
                  description: null,
                  kind: 'Property',
                }
                void inspectEntity(propertyEntity)
              }}
              selectedIri={selectedId}
            />
          </div>
        )}
      </div>
    </div>
  )

  // Center Canvas Panel Content
  const canvasContent = (
    <div className="canvas-wrapper">
      <div className="canvas-toolbar">
        <div>
          <p className="eyebrow">Explore</p>
          <h2>Relationship map</h2>
        </div>
        <div className="icon-actions">
          <button
            type="button"
            title="Undo last expansion (Ctrl+Z)"
            aria-label="Undo last expansion"
            onClick={handleUndo}
            disabled={undoRedoStack.undoStack.length === 0}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            title="Redo expansion (Ctrl+Shift+Z)"
            aria-label="Redo expansion"
            onClick={handleRedo}
            disabled={undoRedoStack.redoStack.length === 0}
          >
            <Redo2 size={18} />
          </button>
          <button
            type="button"
            title="Fit graph"
            aria-label="Fit graph"
            onClick={fitGraph}
            disabled={nodeCount === 0}
          >
            <Crosshair size={18} />
          </button>
          <button
            type="button"
            title="Reset graph"
            aria-label="Reset graph"
            onClick={resetGraph}
            disabled={nodeCount === 0}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="graph-notice" role="status">
          <CircleAlert size={17} />
          <span>{notice}</span>
        </div>
      )}

      <div className="graph-canvas">
        {nodeCount === 0 && (
          <div className="empty-graph">
            <Network size={34} aria-hidden="true" />
            <h3>Start with an entity, class, or property</h3>
            <p>
              Search or browse on the left, then select an item to reveal its connected graph.
            </p>
          </div>
        )}
        <CytoscapeGraph
          ref={rendererRef}
          graph={graph}
          selectedId={selectedId}
          categories={profile?.categories}
          categoryColors={categoryColors}
          onSelectEntity={setSelectedId}
        />
      </div>

      {profile && (
        <SemanticLegend
          categories={profile.categories}
        />
      )}
    </div>
  )

  const traversalControlsBlock = selectedEntity ? (
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

      <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
        <button
          type="button"
          className="primary-action"
          onClick={() => void expandSelected(false)}
          disabled={relationshipsMutation.isPending || isPreviewLoading}
          style={{ flex: 1 }}
        >
          {relationshipsMutation.isPending || isPreviewLoading ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Network size={17} />
          )}
          {nextCursorByEntity[selectedEntity.id]
            ? 'Load more'
            : 'Expand'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void expandSelected(true)}
          disabled={relationshipsMutation.isPending || isPreviewLoading}
          title="Preview and select predicate groups before expanding"
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          <Layers size={15} />
          Preview
        </button>
      </div>

      <div className="relation-summary" style={{ marginTop: 12 }}>
        <p className="eyebrow">Visible connections ({visibleRelationships.length})</p>
        {visibleRelationships.length > 0 && (
          <table className="relationship-table">
            <thead>
              <tr>
                <th>Dir</th>
                <th>Relation</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {visibleRelationships.map((relationship) => {
                const outgoing = relationship.source.id === selectedEntity.id
                const neighbor = outgoing ? relationship.target : relationship.source
                return (
                  <tr
                    key={`${relationship.source.id}|${relationship.relation}|${relationship.target.id}`}
                  >
                    <td>
                      <span
                        className="direction-badge"
                        title={outgoing ? 'Outgoing' : 'Incoming'}
                      >
                        {outgoing ? '→' : '←'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          font: 'inherit',
                          color: '#287b73',
                          textDecoration: 'underline',
                        }}
                        onClick={() => setSelectedRelationship(relationship)}
                        title="Inspect fact provenance in Provenance panel"
                      >
                        {relationship.relation}
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => setSelectedId(neighbor.id)}>
                        {neighbor.label}
                      </button>
                    </td>
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
  ) : null

  // Right Inspector Panel Content (Batch 2B)
  const inspectorContent = (
    <InspectorPanel
      selectedId={selectedId}
      selectedRelationship={selectedRelationship}
      visibleRelationships={visibleRelationships}
      activeBuildId={profile?.build_id}
      reasonerName={profile?.reasoning_profile}
      onNavigate={(iri) => {
        if (graph.entities[iri]) {
          setSelectedId(iri)
        } else {
          const newEntity: GraphEntity = {
            __typename: 'OntologyEntity',
            id: iri,
            label: iri.includes('#') ? iri.split('#')[1] : iri.split('/').pop() || iri,
            description: null,
          }
          void inspectEntity(newEntity)
        }
      }}
      onExpand={() => void expandSelected()}
      onShowInstances={() => {
        setActiveNavTab('search')
      }}
      onShowSubclasses={() => {
        setActiveNavTab('classes')
      }}
      onFilterByProperty={(propIri) => {
        const propName = propIri.includes('#') ? propIri.split('#')[1] : propIri.split('/').pop() || propIri
        toggleRelation(propName)
      }}
      traversalControls={traversalControlsBlock}
    />
  )

  const headerActions = (
    <LanguageSelector
      preferredLanguages={profile?.languages?.preferred_languages}
      currentLanguage={currentLanguage}
      onLanguageChange={setCurrentLanguage}
    />
  )

  return (
    <>
      <AppShell
        profile={profile}
        isLoading={isProfileLoading}
        error={profileError}
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        navigationContent={navigationContent}
        canvasContent={canvasContent}
        inspectorContent={inspectorContent}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        headerActions={headerActions}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectEntity={(entity) => void inspectEntity(entity)}
        actions={commandActions}
      />

      <ExpansionPreviewDialog
        isOpen={isPreviewDialogOpen}
        entityLabel={previewTargetEntity?.label || ''}
        entityId={previewTargetEntity?.id || ''}
        preview={expansionPreview}
        isLoading={isPreviewLoading}
        onExpand={(groups) => void handleConfirmPreviewExpand(groups)}
        onCancel={() => {
          setIsPreviewDialogOpen(false)
          setPreviewTargetEntity(null)
          setExpansionPreview(null)
        }}
      />
    </>
  )
}

export default App
