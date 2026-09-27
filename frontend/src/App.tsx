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
  Minimize2,
  Trash2,
  Search,
  FolderTree,
  Binary,
  Layers,
  X,
  Focus,
  Pin,
  PinOff,
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
  removeNode,
  collapseNodeExpansion,
  type ExpansionRecord,
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
  const [isMultiHopMode, setIsMultiHopMode] = useState(false)
  const [traversalDepth, setTraversalDepth] = useState<number>(2)
  const [isMultiHopExpanding, setIsMultiHopExpanding] = useState(false)
  const [multiHopProgress, setMultiHopProgress] = useState<{
    currentHop: number
    totalHops: number
    visitedCount: number
  } | null>(null)
  const multiHopAbortController = useRef<AbortController | null>(null)
  const [layoutName, setLayoutName] = useState<string>('breadthfirst')
  const [pinnedNodeIds, setPinnedNodeIds] = useState<string[]>([])

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

  function cancelMultiHop() {
    if (multiHopAbortController.current) {
      multiHopAbortController.current.abort()
      multiHopAbortController.current = null
    }
    setIsMultiHopExpanding(false)
    setMultiHopProgress(null)
    setNotice('Multi-hop traversal cancelled by user.')
  }

  async function executeMultiHopExpansion(rootEntity: GraphEntity, depth: number) {
    if (depth <= 1) {
      await expandSelected(false)
      return
    }

    const controller = new AbortController()
    multiHopAbortController.current = controller
    setIsMultiHopExpanding(true)
    setNotice(null)

    let currentGraph = graph
    const visited = new Set<string>([rootEntity.id])
    let frontier = [rootEntity.id]
    const allAddedNodeIds: string[] = []
    const allAddedRelationshipIds: string[] = []
    const allAddedEntities: Record<string, GraphEntity> = {}
    const allAddedRelationships: Record<string, GraphRelationship> = {}

    try {
      for (let hop = 1; hop <= depth; hop++) {
        if (controller.signal.aborted) break
        if (frontier.length === 0) break

        setMultiHopProgress({
          currentHop: hop,
          totalHops: depth,
          visitedCount: visited.size,
        })

        const nextFrontier: string[] = []

        for (const nodeId of frontier) {
          if (controller.signal.aborted) break

          // AC-105: Hard visible limits check before expanding
          if (
            Object.keys(currentGraph.entities).length >= DEFAULT_VISIBLE_LIMITS.maxNodes ||
            Object.keys(currentGraph.relationships).length >= DEFAULT_VISIBLE_LIMITS.maxEdges
          ) {
            setNotice(
              `Visible graph limit reached (${DEFAULT_VISIBLE_LIMITS.maxNodes} nodes / ${DEFAULT_VISIBLE_LIMITS.maxEdges} edges). Multi-hop stopped.`,
            )
            break
          }

          const expansion = await expandGraph({
            id: nodeId,
            direction,
            relations: selectedRelations.length > 0 ? selectedRelations : undefined,
            includeInferred,
          })

          if (controller.signal.aborted) break

          const result = mergeGraphExpansion(currentGraph, expansion, DEFAULT_VISIBLE_LIMITS)
          currentGraph = result.graph

          allAddedNodeIds.push(...result.record.addedNodeIds)
          allAddedRelationshipIds.push(...result.record.addedRelationshipIds)
          if (result.record.addedEntities) {
            Object.assign(allAddedEntities, result.record.addedEntities)
          }
          if (result.record.addedRelationships) {
            Object.assign(allAddedRelationships, result.record.addedRelationships)
          }

          for (const neighborId of result.record.addedNodeIds) {
            if (!visited.has(neighborId)) {
              visited.add(neighborId)
              nextFrontier.push(neighborId)
            }
          }

          setGraph(currentGraph)

          if (result.limitReached) {
            setNotice(
              `Visible graph limit reached (${DEFAULT_VISIBLE_LIMITS.maxNodes} nodes / ${DEFAULT_VISIBLE_LIMITS.maxEdges} edges). Multi-hop traversal truncated.`,
            )
            break
          }
        }

        frontier = nextFrontier
      }

      if (
        !controller.signal.aborted &&
        (allAddedNodeIds.length > 0 || allAddedRelationshipIds.length > 0)
      ) {
        const consolidatedRecord: ExpansionRecord = {
          centerId: rootEntity.id,
          addedNodeIds: Array.from(new Set(allAddedNodeIds)),
          addedRelationshipIds: Array.from(new Set(allAddedRelationshipIds)),
          addedEntities: allAddedEntities,
          addedRelationships: allAddedRelationships,
        }
        setUndoRedoStack((current) => pushUndoExpansion(current, consolidatedRecord))
      }
    } catch {
      if (!controller.signal.aborted) {
        setNotice('Multi-hop traversal encountered an error.')
      }
    } finally {
      setIsMultiHopExpanding(false)
      setMultiHopProgress(null)
      multiHopAbortController.current = null
    }
  }

  function resetGraph() {
    setGraph(emptyGraph)
    setSelectedId(null)
    setSelectedRelationship(null)
    setUndoRedoStack(initialUndoRedoStack)
    setPinnedNodeIds([])
    setNextCursorByEntity({})
    setNotice(null)
  }

  function fitGraph() {
    rendererRef.current?.fit()
  }

  function focusSelected() {
    if (selectedId) {
      rendererRef.current?.focusNode(selectedId)
    }
  }

  function togglePinSelectedNode() {
    if (!selectedId) return
    const isPinned = pinnedNodeIds.includes(selectedId)
    setPinnedNodeIds((prev) =>
      isPinned ? prev.filter((id) => id !== selectedId) : [...prev, selectedId],
    )
    const label = selectedEntity?.label || selectedId
    setNotice(isPinned ? `Unpinned "${label}".` : `Pinned "${label}" position in place.`)
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

  function handleCollapseSelectedExpansion() {
    if (!selectedId) return
    const { graph: newGraph, stack: newStack, collapsedRecord } = collapseNodeExpansion(
      graph,
      selectedId,
      undoRedoStack,
    )
    if (collapsedRecord) {
      setGraph(newGraph)
      setUndoRedoStack(newStack)
      if (!newGraph.entities[selectedId]) {
        setSelectedId(null)
      }
      setNotice('Collapsed expansion involving selected node.')
    } else {
      setNotice('No expansions found to collapse for the selected node.')
    }
  }

  function handleRemoveSelectedNode() {
    if (!selectedId) return
    const label = selectedEntity?.label || selectedId
    const newGraph = removeNode(graph, selectedId)
    setGraph(newGraph)
    setSelectedId(null)
    setSelectedRelationship(null)
    setNotice(`Removed "${label}" and connected edges from canvas.`)
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
          {
            id: 'graph-focus-selected',
            title: `Focus "${selectedEntity.label}"`,
            subtitle: 'Center camera and zoom to selected node',
            onSelect: focusSelected,
          },
          {
            id: 'graph-pin-selected',
            title: pinnedNodeIds.includes(selectedEntity.id)
              ? `Unpin "${selectedEntity.label}"`
              : `Pin "${selectedEntity.label}" in place`,
            subtitle: 'Toggle fixed position lock for selected node',
            onSelect: togglePinSelectedNode,
          },
          {
            id: 'graph-collapse-selected',
            title: `Collapse "${selectedEntity.label}" expansion`,
            subtitle: 'Undo the latest expansion involving this node',
            onSelect: handleCollapseSelectedExpansion,
          },
          {
            id: 'graph-remove-node',
            title: `Remove "${selectedEntity.label}"`,
            subtitle: 'Remove node and its incident edges from canvas',
            onSelect: handleRemoveSelectedNode,
          },
        ]
      : []),
    {
      id: 'layout-breadthfirst',
      title: 'Layout: Breadthfirst Tree',
      subtitle: 'Organize nodes in hierarchical tree layout',
      onSelect: () => {
        setLayoutName('breadthfirst')
        rendererRef.current?.runLayout('breadthfirst')
      },
    },
    {
      id: 'layout-cose',
      title: 'Layout: CoSE Force-Directed',
      subtitle: 'Organize nodes with physics/force simulation',
      onSelect: () => {
        setLayoutName('cose')
        rendererRef.current?.runLayout('cose')
      },
    },
    {
      id: 'layout-dagre',
      title: 'Layout: Dagre Hierarchical DAG',
      subtitle: 'Organize nodes in directed acyclic layers',
      onSelect: () => {
        setLayoutName('dagre')
        rendererRef.current?.runLayout('dagre')
      },
    },
    {
      id: 'layout-circle',
      title: 'Layout: Circle',
      subtitle: 'Arrange all nodes in a circle',
      onSelect: () => {
        setLayoutName('circle')
        rendererRef.current?.runLayout('circle')
      },
    },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <p className="eyebrow">Explore</p>
            <h2>Relationship map</h2>
          </div>
          <select
            id="layout-select"
            value={layoutName}
            onChange={(e) => {
              const newLayout = e.target.value
              setLayoutName(newLayout)
              rendererRef.current?.runLayout(newLayout)
            }}
            className="layout-select"
            aria-label="Select layout algorithm"
            title="Choose layout algorithm (RC-007)"
          >
            <option value="breadthfirst">Breadthfirst (Tree)</option>
            <option value="cose">CoSE (Force-Directed)</option>
            <option value="dagre">Dagre (Hierarchical DAG)</option>
            <option value="circle">Circle</option>
            <option value="concentric">Concentric</option>
          </select>
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
          {selectedEntity && (
            <>
              <button
                type="button"
                title={`Focus on "${selectedEntity.label}"`}
                aria-label="Focus on selected node"
                onClick={focusSelected}
              >
                <Focus size={18} />
              </button>
              <button
                type="button"
                title={
                  pinnedNodeIds.includes(selectedEntity.id)
                    ? `Unpin "${selectedEntity.label}"`
                    : `Pin "${selectedEntity.label}" position in place`
                }
                aria-label="Toggle pin node"
                className={pinnedNodeIds.includes(selectedEntity.id) ? 'active-pin' : ''}
                onClick={togglePinSelectedNode}
              >
                {pinnedNodeIds.includes(selectedEntity.id) ? (
                  <PinOff size={18} />
                ) : (
                  <Pin size={18} />
                )}
              </button>
              <button
                type="button"
                title={`Collapse expansion for ${selectedEntity.label}`}
                aria-label="Collapse selected expansion"
                onClick={handleCollapseSelectedExpansion}
              >
                <Minimize2 size={18} />
              </button>
              <button
                type="button"
                title={`Remove ${selectedEntity.label} from canvas`}
                aria-label="Remove selected node"
                onClick={handleRemoveSelectedNode}
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
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
          layoutName={layoutName}
          pinnedNodeIds={pinnedNodeIds}
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
      <div className="traversal-mode-toggle" style={{ marginBottom: 10 }}>
        <p className="eyebrow">Exploration mode</p>
        <div className="direction-control" role="group" aria-label="Exploration hop mode">
          <button
            type="button"
            className={!isMultiHopMode ? 'active' : ''}
            aria-pressed={!isMultiHopMode}
            onClick={() => setIsMultiHopMode(false)}
          >
            1-Hop
          </button>
          <button
            type="button"
            className={isMultiHopMode ? 'active' : ''}
            aria-pressed={isMultiHopMode}
            onClick={() => setIsMultiHopMode(true)}
          >
            Multi-Hop
          </button>
        </div>
      </div>

      {isMultiHopMode && (
        <div className="depth-slider-control" style={{ marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8125rem',
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 600, color: '#334155' }}>Depth:</span>
            <span style={{ color: '#0284c7', fontWeight: 700 }}>
              {traversalDepth} {traversalDepth === 1 ? 'hop' : 'hops'}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="1"
            value={traversalDepth}
            onChange={(e) => setTraversalDepth(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
            aria-label="Multi-hop traversal depth (1 to 3 hops)"
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              color: '#64748b',
            }}
          >
            <span>1 hop</span>
            <span>2 hops</span>
            <span>3 hops</span>
          </div>
        </div>
      )}

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

      {isMultiHopExpanding && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#e0f2fe',
            border: '1px solid #7dd3fc',
            borderRadius: '8px',
            padding: '8px 12px',
            marginTop: 8,
            marginBottom: 8,
            fontSize: '0.8125rem',
            color: '#0369a1',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LoaderCircle size={15} className="spin" />
            <span>
              Hop {multiHopProgress?.currentHop} of {multiHopProgress?.totalHops} ({multiHopProgress?.visitedCount} visited)
            </span>
          </div>
          <button
            type="button"
            onClick={cancelMultiHop}
            style={{
              background: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <X size={13} />
            Cancel
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            if (isMultiHopMode && traversalDepth > 1) {
              void executeMultiHopExpansion(selectedEntity, traversalDepth)
            } else {
              void expandSelected(false)
            }
          }}
          disabled={relationshipsMutation.isPending || isPreviewLoading || isMultiHopExpanding}
          style={{ flex: 1 }}
        >
          {relationshipsMutation.isPending || isPreviewLoading || isMultiHopExpanding ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Network size={17} />
          )}
          {isMultiHopMode && traversalDepth > 1
            ? `Expand (${traversalDepth} hops)`
            : nextCursorByEntity[selectedEntity.id]
              ? 'Load more'
              : 'Expand'}
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void expandSelected(true)}
          disabled={relationshipsMutation.isPending || isPreviewLoading || isMultiHopExpanding}
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
