import React, { useState, useEffect } from 'react'
import {
  GitCompare,
  Pin,
  PinOff,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  Tag,
  Boxes,
  Users,
  AlertTriangle,
  LoaderCircle,
  HelpCircle,
  Layers,
  ListFilter,
} from 'lucide-react'
import type { GraphEntity, ComparisonResult } from '../interfaces/models'
import { compareEntities, searchEntities } from '../api/graph'
import { HierarchyTreeView } from '../views/HierarchyTreeView'
import { buildComparisonTree } from '../views/treeBuilders'
import './EntityComparison.css'

export interface EntityComparisonProps {
  currentEntity?: GraphEntity | null
  pinnedEntities?: GraphEntity[]
  onPinEntity?: (entity: GraphEntity) => void
  onUnpinEntity?: (entityId: string) => void
  onSelectEntity?: (entity: GraphEntity) => void
  onClose?: () => void
}

export const EntityComparison: React.FC<EntityComparisonProps> = ({
  currentEntity,
  pinnedEntities = [],
  onPinEntity,
  onUnpinEntity,
  onSelectEntity,
  onClose,
}) => {
  const [entityA, setEntityA] = useState<GraphEntity | null>(pinnedEntities[0] || currentEntity || null)
  const [entityB, setEntityB] = useState<GraphEntity | null>(pinnedEntities[1] || null)

  // Search states for picking entities
  const [searchAQuery, setSearchAQuery] = useState('')
  const [searchBQuery, setSearchBQuery] = useState('')
  const [searchResultsA, setSearchResultsA] = useState<GraphEntity[]>([])
  const [searchResultsB, setSearchResultsB] = useState<GraphEntity[]>([])
  const [isSearchingA, setIsSearchingA] = useState(false)
  const [isSearchingB, setIsSearchingB] = useState(false)

  // Comparison execution states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [displayMode, setDisplayMode] = useState<'cards' | 'tree'>('cards')

  // When pinnedEntities changes, if entityA or entityB is null, prefill
  useEffect(() => {
    if (!entityA && pinnedEntities.length > 0) {
      setEntityA(pinnedEntities[0])
    }
    if (!entityB && pinnedEntities.length > 1) {
      setEntityB(pinnedEntities[1])
    }
  }, [pinnedEntities, entityA, entityB])

  // Search autocomplete for A
  useEffect(() => {
    if (!searchAQuery.trim() || searchAQuery.length < 2) {
      setSearchResultsA([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingA(true)
      try {
        const results = await searchEntities(searchAQuery.trim())
        setSearchResultsA(results.slice(0, 6))
      } catch {
        setSearchResultsA([])
      } finally {
        setIsSearchingA(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchAQuery])

  // Search autocomplete for B
  useEffect(() => {
    if (!searchBQuery.trim() || searchBQuery.length < 2) {
      setSearchResultsB([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingB(true)
      try {
        const results = await searchEntities(searchBQuery.trim())
        setSearchResultsB(results.slice(0, 6))
      } catch {
        setSearchResultsB([])
      } finally {
        setIsSearchingB(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchBQuery])

  const handleSwap = () => {
    const temp = entityA
    setEntityA(entityB)
    setEntityB(temp)
    setComparisonResult(null)
  }

  const handleCompare = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!entityA || !entityB) {
      setError('Please select two distinct entities to compare.')
      return
    }
    if (entityA.id === entityB.id) {
      setError('Cannot compare an entity with itself. Select two different entities.')
      return
    }

    setIsLoading(true)
    setError(null)
    setComparisonResult(null)

    try {
      const result = await compareEntities(entityA.id, entityB.id)
      setComparisonResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compare entities.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const labelA = entityA?.label || entityA?.id || 'Entity A'
  const labelB = entityB?.label || entityB?.id || 'Entity B'

  return (
    <div className="entity-comparison-panel" role="region" aria-label="Entity Comparison" data-testid="entity-comparison">
      {/* Header */}
      <div className="comparison-header">
        <div className="header-title-box">
          <GitCompare size={18} className="comparison-header-icon" aria-hidden="true" />
          <div>
            <h3 className="comparison-title">Entity Comparison</h3>
            <p className="comparison-subtitle">
              Side-by-side diff of shared and unique types, properties, and neighbors (UW-005, AC-107)
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="comparison-close-btn"
            onClick={onClose}
            aria-label="Close Entity Comparison"
            title="Close Entity Comparison"
          >
            ×
          </button>
        )}
      </div>

      {/* Pinned Entities Bar */}
      <div className="pinned-entities-bar">
        <div className="pinned-bar-header">
          <div className="pinned-header-title">
            <Pin size={14} aria-hidden="true" />
            <span>Pinned for Comparison ({pinnedEntities.length})</span>
          </div>
          {currentEntity && (
            <button
              type="button"
              className="pin-current-btn"
              onClick={() => onPinEntity?.(currentEntity)}
              disabled={pinnedEntities.some((e) => e.id === currentEntity.id)}
              title={`Pin current entity "${currentEntity.label || currentEntity.id}"`}
            >
              <Pin size={12} />
              <span>Pin Current: {currentEntity.label || currentEntity.id}</span>
            </button>
          )}
        </div>

        {pinnedEntities.length > 0 ? (
          <div className="pinned-chips-row">
            {pinnedEntities.map((p) => {
              const isA = entityA?.id === p.id
              const isB = entityB?.id === p.id

              return (
                <div
                  key={`pinned_${p.id}`}
                  className={`pinned-chip ${isA ? 'is-slot-a' : isB ? 'is-slot-b' : ''}`}
                >
                  <span className="pinned-chip-label" title={p.id}>
                    {p.label || p.id}
                  </span>
                  <div className="pinned-chip-actions">
                    <button
                      type="button"
                      className="slot-assign-btn slot-a"
                      onClick={() => {
                        setEntityA(p)
                        setComparisonResult(null)
                      }}
                      title="Set as Entity A"
                      aria-label={`Set ${p.label} as Entity A`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      className="slot-assign-btn slot-b"
                      onClick={() => {
                        setEntityB(p)
                        setComparisonResult(null)
                      }}
                      title="Set as Entity B"
                      aria-label={`Set ${p.label} as Entity B`}
                    >
                      B
                    </button>
                    {onUnpinEntity && (
                      <button
                        type="button"
                        className="unpin-btn"
                        onClick={() => onUnpinEntity(p.id)}
                        title="Unpin entity"
                        aria-label={`Unpin ${p.label}`}
                      >
                        <PinOff size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="pinned-empty-hint">
            No entities pinned yet. Pin nodes from the inspector or search to easily select them for comparison.
          </p>
        )}
      </div>

      {/* Selectors Form */}
      <form className="comparison-form" onSubmit={handleCompare}>
        <div className="comparison-slots-row">
          {/* Entity A Slot */}
          <div className="slot-box slot-a-box">
            <div className="slot-header">
              <span className="slot-badge badge-a">Entity A</span>
              <span className="slot-name">{entityA ? entityA.label || entityA.id : 'None selected'}</span>
            </div>
            <div className="slot-input-wrapper">
              <input
                id="compare-entity-a-input"
                type="text"
                className="slot-input"
                placeholder="Search or enter Entity A..."
                value={searchAQuery}
                onChange={(e) => setSearchAQuery(e.target.value)}
                aria-label="Search Entity A"
              />
              {isSearchingA && <LoaderCircle size={14} className="spin input-spinner" />}
            </div>
            {searchResultsA.length > 0 && (
              <ul className="autocomplete-menu" role="listbox" aria-label="Entity A suggestions">
                {searchResultsA.map((res) => (
                  <li
                    key={`res_a_${res.id}`}
                    role="option"
                    aria-selected={res.id === entityA?.id}
                    className="autocomplete-item"
                    onClick={() => {
                      setEntityA(res)
                      setSearchAQuery('')
                      setSearchResultsA([])
                      setComparisonResult(null)
                    }}
                  >
                    <span className="item-label">{res.label || res.id}</span>
                    <span className="item-id">{res.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Swap Button */}
          <div className="swap-btn-container">
            <button
              type="button"
              className="swap-btn"
              onClick={handleSwap}
              title="Swap Entity A and Entity B"
              aria-label="Swap Entity A and Entity B"
            >
              <ArrowRightLeft size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Entity B Slot */}
          <div className="slot-box slot-b-box">
            <div className="slot-header">
              <span className="slot-badge badge-b">Entity B</span>
              <span className="slot-name">{entityB ? entityB.label || entityB.id : 'None selected'}</span>
            </div>
            <div className="slot-input-wrapper">
              <input
                id="compare-entity-b-input"
                type="text"
                className="slot-input"
                placeholder="Search or enter Entity B..."
                value={searchBQuery}
                onChange={(e) => setSearchBQuery(e.target.value)}
                aria-label="Search Entity B"
              />
              {isSearchingB && <LoaderCircle size={14} className="spin input-spinner" />}
            </div>
            {searchResultsB.length > 0 && (
              <ul className="autocomplete-menu" role="listbox" aria-label="Entity B suggestions">
                {searchResultsB.map((res) => (
                  <li
                    key={`res_b_${res.id}`}
                    role="option"
                    aria-selected={res.id === entityB?.id}
                    className="autocomplete-item"
                    onClick={() => {
                      setEntityB(res)
                      setSearchBQuery('')
                      setSearchResultsB([])
                      setComparisonResult(null)
                    }}
                  >
                    <span className="item-label">{res.label || res.id}</span>
                    <span className="item-id">{res.id}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="comparison-action-row">
          <button
            type="submit"
            className="compare-run-btn"
            disabled={!entityA || !entityB || entityA.id === entityB.id || isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
                <span>Computing Comparison...</span>
              </>
            ) : (
              <>
                <GitCompare size={16} aria-hidden="true" />
                <span>Compare Entities</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="comparison-error-banner" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="comparison-loading-state" aria-live="polite">
          <LoaderCircle size={28} className="spin text-accent" />
          <p>Analyzing common and unique types, properties, and neighboring topology...</p>
        </div>
      )}

      {/* Empty State before comparison */}
      {!comparisonResult && !isLoading && (
        <div className="comparison-empty-state" data-testid="comparison-empty">
          <HelpCircle size={32} className="empty-icon text-muted" aria-hidden="true" />
          <h4>Ready to Compare</h4>
          <p>
            Select two entities from your pinned list or use the search inputs above, then click{' '}
            <strong>Compare Entities</strong> to inspect their topological differences.
          </p>
        </div>
      )}

      {/* Results View */}
      {comparisonResult && !isLoading && (
        <div className="comparison-results-container" data-testid="comparison-results" aria-live="polite">
          {/* View mode toggle toolbar */}
          <div className="results-toolbar">
            <div className="results-summary">
              <h4>Comparison Results</h4>
              <p>
                Comparing <strong>{labelA}</strong> vs <strong>{labelB}</strong>
              </p>
            </div>
            <div className="view-mode-group" role="group" aria-label="Comparison View Mode">
              <button
                type="button"
                className={`mode-btn ${displayMode === 'cards' ? 'active' : ''}`}
                onClick={() => setDisplayMode('cards')}
                aria-pressed={displayMode === 'cards'}
                title="Structured Diff Cards View"
              >
                <Layers size={14} />
                <span>Diff Cards</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${displayMode === 'tree' ? 'active' : ''}`}
                onClick={() => setDisplayMode('tree')}
                aria-pressed={displayMode === 'tree'}
                title="Hierarchical ARIA Tree View"
              >
                <ListFilter size={14} />
                <span>Tree View</span>
              </button>
            </div>
          </div>

          {displayMode === 'cards' ? (
            <div className="diff-cards-layout">
              {/* Section 1: Types (AC-107) */}
              <div className="diff-section">
                <div className="diff-section-header">
                  <Boxes size={16} aria-hidden="true" />
                  <h5>Types & Classes</h5>
                </div>
                <div className="diff-columns-grid">
                  {/* Common Types */}
                  <div className="diff-col common-col">
                    <div className="col-header">
                      <span className="diff-tag tag-common">
                        <CheckCircle2 size={12} />
                        <span>Shared ({comparisonResult.common_types.length})</span>
                      </span>
                    </div>
                    {comparisonResult.common_types.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.common_types.map((typeIri) => (
                          <li key={`common_t_${typeIri}`} className="diff-item item-common">
                            <CheckCircle2 size={13} className="item-icon" />
                            <span className="item-name" title={typeIri}>
                              {typeIri.includes('#') ? typeIri.split('#')[1] : typeIri.split('/').pop() || typeIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">No shared types</p>
                    )}
                  </div>

                  {/* Unique A Types */}
                  <div className="diff-col unique-a-col">
                    <div className="col-header">
                      <span className="diff-tag tag-a">
                        <Tag size={12} />
                        <span>Unique to {labelA} ({comparisonResult.unique_types_a.length})</span>
                      </span>
                    </div>
                    {comparisonResult.unique_types_a.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.unique_types_a.map((typeIri) => (
                          <li key={`uniq_a_t_${typeIri}`} className="diff-item item-a">
                            <Tag size={13} className="item-icon" />
                            <span className="item-name" title={typeIri}>
                              {typeIri.includes('#') ? typeIri.split('#')[1] : typeIri.split('/').pop() || typeIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">None</p>
                    )}
                  </div>

                  {/* Unique B Types */}
                  <div className="diff-col unique-b-col">
                    <div className="col-header">
                      <span className="diff-tag tag-b">
                        <Tag size={12} />
                        <span>Unique to {labelB} ({comparisonResult.unique_types_b.length})</span>
                      </span>
                    </div>
                    {comparisonResult.unique_types_b.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.unique_types_b.map((typeIri) => (
                          <li key={`uniq_b_t_${typeIri}`} className="diff-item item-b">
                            <Tag size={13} className="item-icon" />
                            <span className="item-name" title={typeIri}>
                              {typeIri.includes('#') ? typeIri.split('#')[1] : typeIri.split('/').pop() || typeIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">None</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Properties (AC-107) */}
              <div className="diff-section">
                <div className="diff-section-header">
                  <Tag size={16} aria-hidden="true" />
                  <h5>Properties & Predicates</h5>
                </div>
                <div className="diff-columns-grid">
                  {/* Common Properties */}
                  <div className="diff-col common-col">
                    <div className="col-header">
                      <span className="diff-tag tag-common">
                        <CheckCircle2 size={12} />
                        <span>Shared ({comparisonResult.common_properties.length})</span>
                      </span>
                    </div>
                    {comparisonResult.common_properties.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.common_properties.map((propIri) => (
                          <li key={`common_p_${propIri}`} className="diff-item item-common">
                            <CheckCircle2 size={13} className="item-icon" />
                            <span className="item-name" title={propIri}>
                              {propIri.includes('#') ? propIri.split('#')[1] : propIri.split('/').pop() || propIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">No shared properties</p>
                    )}
                  </div>

                  {/* Unique A Properties */}
                  <div className="diff-col unique-a-col">
                    <div className="col-header">
                      <span className="diff-tag tag-a">
                        <Tag size={12} />
                        <span>Unique to {labelA} ({comparisonResult.unique_properties_a.length})</span>
                      </span>
                    </div>
                    {comparisonResult.unique_properties_a.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.unique_properties_a.map((propIri) => (
                          <li key={`uniq_a_p_${propIri}`} className="diff-item item-a">
                            <Tag size={13} className="item-icon" />
                            <span className="item-name" title={propIri}>
                              {propIri.includes('#') ? propIri.split('#')[1] : propIri.split('/').pop() || propIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">None</p>
                    )}
                  </div>

                  {/* Unique B Properties */}
                  <div className="diff-col unique-b-col">
                    <div className="col-header">
                      <span className="diff-tag tag-b">
                        <Tag size={12} />
                        <span>Unique to {labelB} ({comparisonResult.unique_properties_b.length})</span>
                      </span>
                    </div>
                    {comparisonResult.unique_properties_b.length > 0 ? (
                      <ul className="diff-item-list">
                        {comparisonResult.unique_properties_b.map((propIri) => (
                          <li key={`uniq_b_p_${propIri}`} className="diff-item item-b">
                            <Tag size={13} className="item-icon" />
                            <span className="item-name" title={propIri}>
                              {propIri.includes('#') ? propIri.split('#')[1] : propIri.split('/').pop() || propIri}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-items-copy">None</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Shared Neighbors (AC-107) */}
              <div className="diff-section">
                <div className="diff-section-header">
                  <Users size={16} aria-hidden="true" />
                  <h5>Shared Neighbors ({comparisonResult.shared_neighbors.length})</h5>
                </div>
                {comparisonResult.shared_neighbors.length > 0 ? (
                  <div className="shared-neighbors-chips">
                    {comparisonResult.shared_neighbors.map((neighbor) => (
                      <button
                        key={`shared_nbr_${neighbor.id}`}
                        type="button"
                        className="neighbor-chip"
                        onClick={() => onSelectEntity?.(neighbor)}
                        title={`Inspect shared neighbor ${neighbor.label || neighbor.id}`}
                      >
                        <CheckCircle2 size={13} className="neighbor-icon" />
                        <span className="neighbor-label">{neighbor.label || neighbor.id}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="no-items-copy" style={{ padding: '8px 12px' }}>
                    No shared neighboring entities connected to both resources.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Tree View using HierarchyTreeView + buildComparisonTree */
            <div className="comparison-tree-wrapper">
              <HierarchyTreeView
                nodes={buildComparisonTree(comparisonResult, labelA, labelB)}
                onSelectNode={(node) => {
                  if (node.data && onSelectEntity) {
                    onSelectEntity(node.data)
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EntityComparison
