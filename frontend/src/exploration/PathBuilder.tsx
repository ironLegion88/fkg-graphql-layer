import React, { useState, useEffect } from 'react'
import {
  Route,
  ArrowRightLeft,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Maximize2,
  LoaderCircle,
  HelpCircle,
} from 'lucide-react'
import type { GraphEntity, GraphPath, PathResult, PathStatus } from '../interfaces/models'
import { findPath, searchEntities } from '../api/graph'
import { HierarchyTreeView } from '../views/HierarchyTreeView'
import { buildPathTree } from '../views/treeBuilders'
import './PathBuilder.css'

export interface PathBuilderProps {
  currentEntity?: GraphEntity | null
  visibleEntities?: GraphEntity[]
  initialSourceId?: string
  initialTargetId?: string
  initialPathResult?: PathResult | null
  initialLoading?: boolean
  onSelectEntity?: (entity: GraphEntity) => void
  onHighlightPath?: (path: GraphPath) => void
  onClose?: () => void
}

export const PathBuilder: React.FC<PathBuilderProps> = ({
  currentEntity,
  visibleEntities = [],
  initialSourceId,
  initialTargetId,
  initialPathResult = null,
  initialLoading = false,
  onSelectEntity,
  onHighlightPath,
  onClose,
}) => {
  const [sourceId, setSourceId] = useState<string>(initialSourceId || currentEntity?.id || '')
  const [sourceLabel, setSourceLabel] = useState<string>(
    initialSourceId || currentEntity?.label || currentEntity?.id || ''
  )
  const [targetId, setTargetId] = useState<string>(initialTargetId || '')
  const [targetLabel, setTargetLabel] = useState<string>(initialTargetId || '')

  // Search autocomplete states
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [sourceSearchResults, setSourceSearchResults] = useState<GraphEntity[]>([])
  const [targetSearchResults, setTargetSearchResults] = useState<GraphEntity[]>([])
  const [isSearchingSource, setIsSearchingSource] = useState(false)
  const [isSearchingTarget, setIsSearchingTarget] = useState(false)

  // Execution state
  const [isLoading, setIsLoading] = useState(initialLoading)
  const [error, setError] = useState<string | null>(null)
  const [pathResult, setPathResult] = useState<PathResult | null>(initialPathResult)

  // Sync currentEntity into source if changed and source not set yet
  const [prevEntity, setPrevEntity] = useState<GraphEntity | null>(currentEntity || null)
  if (currentEntity && currentEntity !== prevEntity) {
    setPrevEntity(currentEntity)
    if (!sourceId) {
      setSourceId(currentEntity.id)
      setSourceLabel(currentEntity.label || currentEntity.id)
    }
  }

  // Search entities for source
  useEffect(() => {
    if (!sourceSearchQuery.trim() || sourceSearchQuery.length < 2) {
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingSource(true)
      try {
        const results = await searchEntities(sourceSearchQuery.trim())
        setSourceSearchResults(results.slice(0, 8))
      } catch {
        setSourceSearchResults([])
      } finally {
        setIsSearchingSource(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [sourceSearchQuery])

  // Search entities for target
  useEffect(() => {
    if (!targetSearchQuery.trim() || targetSearchQuery.length < 2) {
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingTarget(true)
      try {
        const results = await searchEntities(targetSearchQuery.trim())
        setTargetSearchResults(results.slice(0, 8))
      } catch {
        setTargetSearchResults([])
      } finally {
        setIsSearchingTarget(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [targetSearchQuery])

  const handleSwap = () => {
    const tempId = sourceId
    const tempLabel = sourceLabel
    setSourceId(targetId)
    setSourceLabel(targetLabel)
    setTargetId(tempId)
    setTargetLabel(tempLabel)
    setPathResult(null)
  }

  const handleFindPath = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!sourceId || !targetId) {
      setError('Please select both a source and a target entity.')
      return
    }
    if (sourceId === targetId) {
      setError('Source and target entities must be different.')
      return
    }

    setIsLoading(true)
    setError(null)
    setPathResult(null)

    try {
      const result = await findPath(sourceId, targetId)
      setPathResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to search path between entities.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const renderStatusOutcome = (result: PathResult) => {
    const status: PathStatus = result.status

    switch (status) {
      case 'FOUND': {
        if (!result.path || result.path.entities.length === 0) {
          return (
            <div className="path-outcome-card outcome-no-path" data-testid="path-outcome-empty">
              <Ban size={20} className="outcome-icon" aria-hidden="true" />
              <div>
                <h4>No Path Discovered</h4>
                <p>Path query returned FOUND status but no intermediate entities were provided.</p>
              </div>
            </div>
          )
        }

        const pathTree = buildPathTree(result.path.entities, result.path.relations)

        return (
          <div className="path-outcome-card outcome-found" data-testid="path-outcome-found">
            <div className="outcome-header">
              <div className="outcome-title-row">
                <CheckCircle2 size={20} className="outcome-icon text-success" aria-hidden="true" />
                <div>
                  <h4 className="outcome-title">Path Discovered</h4>
                  <p className="outcome-meta">
                    Found path across <strong>{result.path.entities.length} entities</strong> (
                    {result.path.relations.length} hops), visiting {result.visited_nodes} nodes.
                  </p>
                </div>
              </div>
              {onHighlightPath && result.path && (
                <button
                  type="button"
                  className="path-action-btn primary"
                  onClick={() => onHighlightPath(result.path!)}
                  title="Add path to canvas and focus visualization"
                  aria-label="Highlight path on canvas"
                >
                  <Maximize2 size={14} aria-hidden="true" />
                  <span>Highlight on Canvas</span>
                </button>
              )}
            </div>

            {/* Sequence chips */}
            <div className="path-sequence-flow" aria-label="Path step sequence">
              {result.path.entities.map((entity, idx) => {
                const relation = idx > 0 ? result.path!.relations[idx - 1] : null
                const isSource = idx === 0
                const isTarget = idx === result.path!.entities.length - 1

                return (
                  <React.Fragment key={`${entity.id}_flow_${idx}`}>
                    {relation && (
                      <div className="path-relation-pill" title={`Relation: ${relation}`}>
                        <span className="relation-text">{relation}</span>
                        <ArrowRight size={13} className="relation-arrow" aria-hidden="true" />
                      </div>
                    )}
                    <button
                      type="button"
                      className={`path-entity-chip ${isSource ? 'source' : isTarget ? 'target' : 'intermediate'}`}
                      onClick={() => onSelectEntity?.(entity)}
                      title={`Inspect entity ${entity.label} (${entity.id})`}
                    >
                      <span className="chip-badge">{isSource ? 'Start' : isTarget ? 'Goal' : `${idx}`}</span>
                      <span className="chip-label">{entity.label || entity.id}</span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>

            {/* Structured ARIA Hierarchy Tree */}
            <div className="path-tree-wrapper">
              <h5 className="path-tree-title">Step-by-Step Traversal Tree</h5>
              <HierarchyTreeView<GraphEntity>
                nodes={pathTree}
                onSelect={(node) => {
                  if (node.data && onSelectEntity) {
                    onSelectEntity(node.data)
                  }
                }}
              />
            </div>
          </div>
        )
      }

      case 'NO_PATH':
        return (
          <div className="path-outcome-card outcome-no-path" data-testid="path-outcome-no-path">
            <Ban size={22} className="outcome-icon text-muted" aria-hidden="true" />
            <div className="outcome-content">
              <h4>No Path Found</h4>
              <p>
                No connecting path exists between <strong>{sourceLabel || sourceId}</strong> and{' '}
                <strong>{targetLabel || targetId}</strong> within the configured traversal limits.
              </p>
              <p className="outcome-hint">
                <HelpCircle size={13} aria-hidden="true" />
                <span>Try searching with multi-hop expansion or connecting via a parent class.</span>
              </p>
            </div>
          </div>
        )

      case 'TIMEOUT':
        return (
          <div className="path-outcome-card outcome-timeout" data-testid="path-outcome-timeout">
            <Clock size={22} className="outcome-icon text-warning" aria-hidden="true" />
            <div className="outcome-content">
              <h4>Path Search Timed Out</h4>
              <p>
                The traversal query timed out after visiting <strong>{result.visited_nodes} nodes</strong>.
              </p>
              <p className="outcome-hint">
                <AlertTriangle size={13} aria-hidden="true" />
                <span>
                  The graph neighborhood is dense. Try filtering specific predicate relations or specifying intermediate checkpoints.
                </span>
              </p>
            </div>
          </div>
        )

      case 'BUDGET_EXHAUSTED':
        return (
          <div className="path-outcome-card outcome-budget" data-testid="path-outcome-budget-exhausted">
            <AlertTriangle size={22} className="outcome-icon text-danger" aria-hidden="true" />
            <div className="outcome-content">
              <h4>Search Budget Exhausted</h4>
              <p>
                Search stopped because the node budget was reached after visiting{' '}
                <strong>{result.visited_nodes} nodes</strong>.
              </p>
              <p className="outcome-hint">
                <span>
                  Try narrowing the traversal depth or applying predicate filters before re-running the search.
                </span>
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="path-builder-panel" role="region" aria-label="Path Builder" data-testid="path-builder">
      <div className="path-builder-header">
        <div className="header-title-box">
          <Route size={18} className="path-header-icon" aria-hidden="true" />
          <div>
            <h3 className="path-builder-title">Path Builder</h3>
            <p className="path-builder-subtitle">Discover bounded shortest paths between knowledge graph entities</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="path-close-btn"
            onClick={onClose}
            aria-label="Close Path Builder"
            title="Close Path Builder"
          >
            ×
          </button>
        )}
      </div>

      <form className="path-builder-form" onSubmit={handleFindPath}>
        {/* Source Entity Selection */}
        <div className="endpoint-selector-row">
          <div className="endpoint-field">
            <label htmlFor="source-entity-input" className="endpoint-label">
              <span className="dot source-dot" aria-hidden="true" />
              <span>Source Entity (Start)</span>
            </label>
            <div className="endpoint-input-wrapper">
              <input
                id="source-entity-input"
                type="text"
                className="endpoint-input"
                placeholder="Search or enter entity IRI..."
                value={sourceSearchQuery || sourceLabel || sourceId}
                onChange={(e) => {
                  const val = e.target.value
                  setSourceSearchQuery(val)
                  setSourceId(val)
                  setSourceLabel(val)
                  if (!val.trim() || val.length < 2) {
                    setSourceSearchResults([])
                  }
                }}
                aria-label="Source entity IRI or label"
              />
              {isSearchingSource && <LoaderCircle size={15} className="spin input-spinner" />}
            </div>

            {/* Autocomplete dropdown */}
            {sourceSearchResults.length > 0 && (
              <ul className="autocomplete-menu" role="listbox" aria-label="Source entity suggestions">
                {sourceSearchResults.map((entity) => (
                  <li
                    key={`source_${entity.id}`}
                    role="option"
                    aria-selected={entity.id === sourceId}
                    className="autocomplete-item"
                    onClick={() => {
                      setSourceId(entity.id)
                      setSourceLabel(entity.label || entity.id)
                      setSourceSearchQuery('')
                      setSourceSearchResults([])
                    }}
                  >
                    <span className="item-label">{entity.label || entity.id}</span>
                    <span className="item-id">{entity.id}</span>
                  </li>
                ))}
              </ul>
            )}

            {currentEntity && currentEntity.id !== sourceId && (
              <button
                type="button"
                className="quick-pick-btn"
                onClick={() => {
                  setSourceId(currentEntity.id)
                  setSourceLabel(currentEntity.label || currentEntity.id)
                  setSourceSearchQuery('')
                }}
              >
                Use Current: {currentEntity.label || currentEntity.id}
              </button>
            )}
          </div>

          {/* Swap Button */}
          <div className="swap-btn-container">
            <button
              type="button"
              className="swap-btn"
              onClick={handleSwap}
              title="Swap source and target endpoints"
              aria-label="Swap source and target"
            >
              <ArrowRightLeft size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Target Entity Selection */}
          <div className="endpoint-field">
            <label htmlFor="target-entity-input" className="endpoint-label">
              <span className="dot target-dot" aria-hidden="true" />
              <span>Target Entity (Goal)</span>
            </label>
            <div className="endpoint-input-wrapper">
              <input
                id="target-entity-input"
                type="text"
                className="endpoint-input"
                placeholder="Search or enter entity IRI..."
                value={targetSearchQuery || targetLabel || targetId}
                onChange={(e) => {
                  const val = e.target.value
                  setTargetSearchQuery(val)
                  setTargetId(val)
                  setTargetLabel(val)
                  if (!val.trim() || val.length < 2) {
                    setTargetSearchResults([])
                  }
                }}
                aria-label="Target entity IRI or label"
              />
              {isSearchingTarget && <LoaderCircle size={15} className="spin input-spinner" />}
            </div>

            {/* Autocomplete dropdown */}
            {targetSearchResults.length > 0 && (
              <ul className="autocomplete-menu" role="listbox" aria-label="Target entity suggestions">
                {targetSearchResults.map((entity) => (
                  <li
                    key={`target_${entity.id}`}
                    role="option"
                    aria-selected={entity.id === targetId}
                    className="autocomplete-item"
                    onClick={() => {
                      setTargetId(entity.id)
                      setTargetLabel(entity.label || entity.id)
                      setTargetSearchQuery('')
                      setTargetSearchResults([])
                    }}
                  >
                    <span className="item-label">{entity.label || entity.id}</span>
                    <span className="item-id">{entity.id}</span>
                  </li>
                ))}
              </ul>
            )}

            {currentEntity && currentEntity.id !== targetId && (
              <button
                type="button"
                className="quick-pick-btn"
                onClick={() => {
                  setTargetId(currentEntity.id)
                  setTargetLabel(currentEntity.label || currentEntity.id)
                  setTargetSearchQuery('')
                }}
              >
                Use Current: {currentEntity.label || currentEntity.id}
              </button>
            )}
          </div>
        </div>

        {/* Visible Entities Quick Select Bar */}
        {visibleEntities.length > 0 && (
          <div className="visible-quick-picks">
            <span className="quick-picks-label">Quick Pick from Canvas:</span>
            <div className="quick-picks-list">
              {visibleEntities.slice(0, 6).map((e) => (
                <button
                  key={`pick_${e.id}`}
                  type="button"
                  className={`quick-chip ${e.id === sourceId ? 'is-source' : e.id === targetId ? 'is-target' : ''}`}
                  onClick={() => {
                    if (!sourceId) {
                      setSourceId(e.id)
                      setSourceLabel(e.label || e.id)
                    } else {
                      setTargetId(e.id)
                      setTargetLabel(e.label || e.id)
                    }
                  }}
                  title={`Pick ${e.label || e.id}`}
                >
                  {e.label || e.id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="path-actions-row">
          <button
            type="submit"
            className="find-path-btn"
            disabled={!sourceId || !targetId || sourceId === targetId || isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
                <span>Searching Path...</span>
              </>
            ) : (
              <>
                <Search size={16} aria-hidden="true" />
                <span>Find Path</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="path-error-banner" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="path-loading-state" aria-live="polite">
          <LoaderCircle size={28} className="spin text-accent" />
          <p>Traversing graph to find shortest path between entities...</p>
        </div>
      )}

      {/* Results View */}
      {pathResult && !isLoading && (
        <div className="path-results-container" aria-live="polite">
          {renderStatusOutcome(pathResult)}
        </div>
      )}
    </div>
  )
}

export default PathBuilder
