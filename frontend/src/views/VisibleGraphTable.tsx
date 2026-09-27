import React, { useState, useMemo } from 'react'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Zap,
  Check,
  Eye,
  Network,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowRight,
  RotateCcw,
  Boxes,
  Tag,
  Circle,
} from 'lucide-react'
import type {
  GraphRelationship,
  GraphEntity,
  ActiveProfile,
} from '../interfaces/models'
import type { ExplorerGraph } from '../graph/state'
import './VisibleGraphTable.css'

export type SortColumn =
  | 'source'
  | 'predicate'
  | 'target'
  | 'direction'
  | 'is_inferred'
  | 'source_graph'

export type SortDirection = 'asc' | 'desc' | null

export interface VisibleGraphTableProps {
  graph: ExplorerGraph
  selectedEntityId?: string | null
  selectedRelationship?: GraphRelationship | null
  profile?: ActiveProfile
  onSelectEntity: (id: string) => void
  onSelectRelationship?: (rel: GraphRelationship) => void
  onExpandEntity?: (entity: GraphEntity) => void
  onRemoveEntity?: (entityId: string) => void
  onRemoveRelationship?: (rel: GraphRelationship) => void
}

function getEntityKindIcon(entity: GraphEntity) {
  const kind = entity.kind?.toLowerCase() || ''
  if (kind.includes('class')) {
    return <Boxes size={14} className="kind-icon class-icon" aria-hidden="true" />
  }
  if (kind.includes('property')) {
    return <Tag size={14} className="kind-icon property-icon" aria-hidden="true" />
  }
  return <Circle size={12} className="kind-icon individual-icon" aria-hidden="true" />
}

export const VisibleGraphTable: React.FC<VisibleGraphTableProps> = ({
  graph,
  selectedEntityId,
  selectedRelationship,
  profile,
  onSelectEntity,
  onSelectRelationship,
  onExpandEntity,
  onRemoveEntity,
  onRemoveRelationship,
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('source')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [textFilter, setTextFilter] = useState('')
  const [predicateFilter, setPredicateFilter] = useState<string>('ALL')
  const [inferredFilter, setInferredFilter] = useState<'ALL' | 'INFERRED' | 'ASSERTED'>('ALL')
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const getCategoryColor = (entity: GraphEntity): string | undefined => {
    if (!profile?.categories) return undefined
    const match = profile.categories.find(
      (c) =>
        c.name.toLowerCase() === entity.kind?.toLowerCase() ||
        c.class_iris.includes(entity.id),
    )
    return match?.color || undefined
  }

  // Extract all visible relationships as an array
  const allRelationships = useMemo(() => {
    return Object.values(graph.relationships)
  }, [graph.relationships])

  // Extract unique predicate relations for the filter dropdown
  const uniquePredicates = useMemo(() => {
    const set = new Set<string>()
    for (const rel of allRelationships) {
      set.add(rel.relation)
    }
    return Array.from(set).sort()
  }, [allRelationships])

  // Filter relationships
  const filteredRelationships = useMemo(() => {
    return allRelationships.filter((rel) => {
      // Text filter
      if (textFilter.trim()) {
        const query = textFilter.toLowerCase().trim()
        const sourceLabel = (rel.source.label || rel.source.id).toLowerCase()
        const targetLabel = (rel.target.label || rel.target.id).toLowerCase()
        const relation = rel.relation.toLowerCase()
        const sourceGraph = (rel.source_graph || '').toLowerCase()
        if (
          !sourceLabel.includes(query) &&
          !targetLabel.includes(query) &&
          !relation.includes(query) &&
          !sourceGraph.includes(query)
        ) {
          return false
        }
      }

      // Predicate filter
      if (predicateFilter !== 'ALL' && rel.relation !== predicateFilter) {
        return false
      }

      // Inferred filter
      if (inferredFilter === 'INFERRED' && !rel.is_inferred) {
        return false
      }
      if (inferredFilter === 'ASSERTED' && rel.is_inferred) {
        return false
      }

      return true
    })
  }, [allRelationships, textFilter, predicateFilter, inferredFilter])

  // Sort relationships
  const sortedRelationships = useMemo(() => {
    if (!sortDirection || !sortColumn) return filteredRelationships

    return [...filteredRelationships].sort((a, b) => {
      let valA = ''
      let valB = ''

      switch (sortColumn) {
        case 'source':
          valA = a.source.label || a.source.id
          valB = b.source.label || b.source.id
          break
        case 'predicate':
          valA = a.predicate_label || a.relation
          valB = b.predicate_label || b.relation
          break
        case 'target':
          valA = a.target.label || a.target.id
          valB = b.target.label || b.target.id
          break
        case 'direction':
          valA = a.relation
          valB = b.relation
          break
        case 'is_inferred':
          return sortDirection === 'asc'
            ? (a.is_inferred ? 1 : 0) - (b.is_inferred ? 1 : 0)
            : (b.is_inferred ? 1 : 0) - (a.is_inferred ? 1 : 0)
        case 'source_graph':
          valA = a.source_graph || ''
          valB = b.source_graph || ''
          break
      }

      const cmp = valA.localeCompare(valB)
      return sortDirection === 'asc' ? cmp : -cmp
    })
  }, [filteredRelationships, sortColumn, sortDirection])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedRelationships.length / pageSize))
  const paginatedRelationships = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRelationships.slice(start, start + pageSize)
  }, [sortedRelationships, currentPage, pageSize])

  // Reset to page 1 when filters change
  const handleFilterChange = (updater: () => void) => {
    updater()
    setCurrentPage(1)
  }

  // Handle column header sort click
  const handleSortClick = (col: SortColumn) => {
    if (sortColumn === col) {
      if (sortDirection === 'asc') setSortDirection('desc')
      else if (sortDirection === 'desc') setSortDirection(null)
      else setSortDirection('asc')
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (col: SortColumn) => {
    if (sortColumn !== col || sortDirection === null) {
      return <ArrowUpDown size={13} className="sort-icon-inactive" aria-hidden="true" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={13} className="sort-icon-active" aria-hidden="true" />
    ) : (
      <ArrowDown size={13} className="sort-icon-active" aria-hidden="true" />
    )
  }

  const getAriaSort = (col: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (sortColumn !== col || sortDirection === null) return 'none'
    return sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  const isRelSelected = (rel: GraphRelationship) => {
    if (selectedRelationship) {
      return (
        selectedRelationship.source.id === rel.source.id &&
        selectedRelationship.relation === rel.relation &&
        selectedRelationship.target.id === rel.target.id
      )
    }
    return selectedEntityId === rel.source.id || selectedEntityId === rel.target.id
  }

  return (
    <section
      className="visible-graph-table-container"
      aria-label="Whole Visible Graph Relationships Table"
      id="visible-graph-table"
    >
      {/* Table Toolbar: Filters and Search */}
      <div className="table-toolbar">
        <div className="filter-group text-search">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            value={textFilter}
            onChange={(e) => handleFilterChange(() => setTextFilter(e.target.value))}
            placeholder="Filter entities, predicates, graphs..."
            aria-label="Filter visible relationships"
            className="table-search-input"
          />
          {textFilter && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => handleFilterChange(() => setTextFilter(''))}
              aria-label="Clear filter search"
            >
              ×
            </button>
          )}
        </div>

        <div className="filter-group">
          <label htmlFor="predicate-filter" className="filter-label">
            Predicate:
          </label>
          <select
            id="predicate-filter"
            value={predicateFilter}
            onChange={(e) => handleFilterChange(() => setPredicateFilter(e.target.value))}
            className="table-select"
            aria-label="Filter by relationship predicate"
          >
            <option value="ALL">All predicates ({uniquePredicates.length})</option>
            {uniquePredicates.map((pred) => (
              <option key={pred} value={pred}>
                {pred}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="inferred-filter" className="filter-label">
            Origin:
          </label>
          <select
            id="inferred-filter"
            value={inferredFilter}
            onChange={(e) =>
              handleFilterChange(() =>
                setInferredFilter(e.target.value as 'ALL' | 'INFERRED' | 'ASSERTED'),
              )
            }
            className="table-select"
            aria-label="Filter by asserted or inferred origin"
          >
            <option value="ALL">All (Asserted & Inferred)</option>
            <option value="ASSERTED">Asserted only (✓)</option>
            <option value="INFERRED">Inferred only (⚡)</option>
          </select>
        </div>

        {(textFilter || predicateFilter !== 'ALL' || inferredFilter !== 'ALL') && (
          <button
            type="button"
            className="reset-filters-btn"
            onClick={() =>
              handleFilterChange(() => {
                setTextFilter('')
                setPredicateFilter('ALL')
                setInferredFilter('ALL')
              })
            }
            title="Reset all filters"
            aria-label="Reset all table filters"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        )}

        <div className="table-stats-summary" aria-live="polite">
          <span>
            Showing <strong>{filteredRelationships.length}</strong> of{' '}
            <strong>{allRelationships.length}</strong> relationships
          </span>
        </div>
      </div>

      {/* Table Content */}
      <div className="table-scroll-container" tabIndex={0} role="region" aria-label="Visible relationships data">
        <table className="visible-relationships-table">
          <thead>
            <tr>
              <th scope="col" aria-sort={getAriaSort('source')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('source')}
                  aria-label={`Sort by Source Entity. Current: ${getAriaSort('source')}`}
                >
                  <span>Source Entity</span>
                  {getSortIcon('source')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('predicate')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('predicate')}
                  aria-label={`Sort by Predicate. Current: ${getAriaSort('predicate')}`}
                >
                  <span>Predicate</span>
                  {getSortIcon('predicate')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('target')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('target')}
                  aria-label={`Sort by Target Entity. Current: ${getAriaSort('target')}`}
                >
                  <span>Target Entity</span>
                  {getSortIcon('target')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('direction')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('direction')}
                  aria-label={`Sort by Direction. Current: ${getAriaSort('direction')}`}
                >
                  <span>Dir</span>
                  {getSortIcon('direction')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('is_inferred')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('is_inferred')}
                  aria-label={`Sort by Origin. Current: ${getAriaSort('is_inferred')}`}
                >
                  <span>Origin</span>
                  {getSortIcon('is_inferred')}
                </button>
              </th>
              <th scope="col" aria-sort={getAriaSort('source_graph')}>
                <button
                  type="button"
                  className="th-sort-button"
                  onClick={() => handleSortClick('source_graph')}
                  aria-label={`Sort by Source Graph. Current: ${getAriaSort('source_graph')}`}
                >
                  <span>Source Graph</span>
                  {getSortIcon('source_graph')}
                </button>
              </th>
              <th scope="col" className="th-actions">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRelationships.length > 0 ? (
              paginatedRelationships.map((rel) => {
                const isSelected = isRelSelected(rel)
                const rowKey = `${rel.source.id}|${rel.relation}|${rel.target.id}`

                return (
                  <tr
                    key={rowKey}
                    className={`relationship-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => {
                      onSelectEntity(rel.source.id)
                      onSelectRelationship?.(rel)
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectEntity(rel.source.id)
                        onSelectRelationship?.(rel)
                      }
                    }}
                    role="row"
                    aria-selected={isSelected}
                  >
                    {/* Source Entity */}
                    <td className="td-entity">
                      <div className="entity-cell">
                        {getEntityKindIcon(rel.source)}
                        <span
                          className="entity-name"
                          title={rel.source.id}
                          style={getCategoryColor(rel.source) ? { color: getCategoryColor(rel.source) } : undefined}
                        >
                          {rel.source.label || rel.source.id}
                        </span>
                      </div>
                    </td>

                    {/* Predicate */}
                    <td className="td-predicate">
                      <span
                        className="predicate-badge"
                        title={rel.predicate_iri || rel.relation}
                      >
                        {rel.predicate_label || rel.relation}
                      </span>
                    </td>

                    {/* Target Entity */}
                    <td className="td-entity">
                      <div className="entity-cell">
                        {getEntityKindIcon(rel.target)}
                        <span
                          className="entity-name"
                          title={rel.target.id}
                          style={getCategoryColor(rel.target) ? { color: getCategoryColor(rel.target) } : undefined}
                        >
                          {rel.target.label || rel.target.id}
                        </span>
                      </div>
                    </td>

                    {/* Direction */}
                    <td className="td-direction">
                      <span className="direction-indicator" title="Directed Outgoing Relationship">
                        <ArrowRight size={13} aria-hidden="true" />
                        <span className="direction-label">Out</span>
                      </span>
                    </td>

                    {/* Is Inferred (Non-color cues: icon + text + border style) */}
                    <td className="td-inferred">
                      {rel.is_inferred ? (
                        <span
                          className="origin-cue inferred-cue"
                          title="Inferred by reasoner rule or ontology axiom"
                        >
                          <Zap size={12} className="origin-icon" aria-hidden="true" />
                          <span className="origin-text">Inferred</span>
                        </span>
                      ) : (
                        <span
                          className="origin-cue asserted-cue"
                          title="Directly asserted in knowledge base"
                        >
                          <Check size={12} className="origin-icon" aria-hidden="true" />
                          <span className="origin-text">Asserted</span>
                        </span>
                      )}
                    </td>

                    {/* Source Graph */}
                    <td className="td-source-graph">
                      <span
                        className="source-graph-name"
                        title={rel.source_graph || 'Default graph'}
                      >
                        {rel.source_graph ? (
                          rel.source_graph.split('/').pop() || rel.source_graph
                        ) : (
                          <span className="default-graph-tag">default</span>
                        )}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-action-buttons">
                        <button
                          type="button"
                          className="row-action-btn inspect-btn"
                          title={`Inspect ${rel.source.label || rel.source.id}`}
                          aria-label={`Inspect ${rel.source.label || rel.source.id}`}
                          onClick={() => {
                            onSelectEntity(rel.source.id)
                            onSelectRelationship?.(rel)
                          }}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span className="sr-only">Inspect</span>
                        </button>
                        {onExpandEntity && (
                          <button
                            type="button"
                            className="row-action-btn expand-btn"
                            title={`Expand ${rel.target.label || rel.target.id}`}
                            aria-label={`Expand ${rel.target.label || rel.target.id}`}
                            onClick={() => onExpandEntity(rel.target)}
                          >
                            <Network size={14} aria-hidden="true" />
                            <span className="sr-only">Expand</span>
                          </button>
                        )}
                        {onRemoveRelationship && (
                          <button
                            type="button"
                            className="row-action-btn remove-btn"
                            title={`Remove relation ${rel.relation}`}
                            aria-label={`Remove relationship ${rel.relation}`}
                            onClick={() => onRemoveRelationship(rel)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            <span className="sr-only">Remove</span>
                          </button>
                        )}
                        {onRemoveEntity && (
                          <button
                            type="button"
                            className="row-action-btn remove-node-btn"
                            title={`Remove ${rel.source.label || rel.source.id} from canvas`}
                            aria-label={`Remove entity ${rel.source.label || rel.source.id}`}
                            onClick={() => onRemoveEntity(rel.source.id)}
                          >
                            <Trash2 size={14} style={{ color: '#b91c1c' }} aria-hidden="true" />
                            <span className="sr-only">Remove Node</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="empty-table-cell">
                  {allRelationships.length === 0 ? (
                    <div className="empty-table-state">
                      <Network size={28} className="empty-icon" aria-hidden="true" />
                      <p className="empty-primary">No relationships visible in graph</p>
                      <p className="empty-secondary">
                        Search or select an entity from the navigation panel to populate the visible graph.
                      </p>
                    </div>
                  ) : (
                    <div className="empty-table-state">
                      <Search size={28} className="empty-icon" aria-hidden="true" />
                      <p className="empty-primary">No relationships match your filters</p>
                      <p className="empty-secondary">
                        Try adjusting your search query, predicate filter, or origin filter.
                      </p>
                      <button
                        type="button"
                        className="reset-filters-btn center-btn"
                        onClick={() =>
                          handleFilterChange(() => {
                            setTextFilter('')
                            setPredicateFilter('ALL')
                            setInferredFilter('ALL')
                          })
                        }
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="table-pagination-footer" role="navigation" aria-label="Table pagination">
          <div className="page-size-selector">
            <label htmlFor="page-size-select" className="page-size-label">
              Rows per page:
            </label>
            <select
              id="page-size-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="page-size-select"
              aria-label="Select number of rows per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="page-navigation-controls">
            <span className="pagination-status" aria-current="page">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (
              {sortedRelationships.length} items)
            </span>

            <div className="pagination-buttons">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="Go to first page"
                title="First page"
              >
                <ChevronsLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
                title="Previous page"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Go to next page"
                title="Next page"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Go to last page"
                title="Last page"
              >
                <ChevronsRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default VisibleGraphTable
