import React, { useState, useDeferredValue } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  X,
  LoaderCircle,
  CircleAlert,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Check,
} from 'lucide-react'
import { advancedSearch, entityKind } from '../api/graph'
import type { ActiveProfile, GraphEntity } from '../interfaces/models'
import './SearchPanel.css'

export interface SearchPanelProps {
  onSelectEntity: (entity: GraphEntity) => void
  profile?: ActiveProfile
  selectedEntityId?: string | null
}

const PAGE_SIZE = 25

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSelectEntity,
  profile,
  selectedEntityId,
}) => {
  const [searchInput, setSearchInput] = useState('')
  const [selectedKinds, setSelectedKinds] = useState<string[]>([])
  const [selectedNamespace, setSelectedNamespace] = useState<string>('ALL')
  const [requireDescription, setRequireDescription] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)

  const deferredSearch = useDeferredValue(searchInput.trim())

  // Categories from profile for kind filtering
  const availableKinds = profile?.categories.map((c) => c.name) ?? [
    'Wine',
    'Winery',
    'Region',
    'Grape',
  ]

  // Prefixes from profile for namespace filtering
  const prefixes = profile?.prefixes ?? []

  const isQueryActive = deferredSearch.length >= 2

  const {
    data: searchResult,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: [
      'advanced-search',
      deferredSearch,
      page,
      selectedKinds,
      requireDescription,
    ],
    queryFn: () =>
      advancedSearch({
        query: deferredSearch,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        kinds: selectedKinds.length > 0 ? selectedKinds : undefined,
        require_description: requireDescription,
      }),
    enabled: isQueryActive,
  })

  const entities = searchResult?.entities ?? []
  const totalMatches = searchResult?.total_matches ?? 0
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE)

  // Filter entities locally by namespace if selected
  const displayedEntities = React.useMemo(() => {
    if (selectedNamespace === 'ALL') return entities
    return entities.filter((e) => {
      if (selectedNamespace.includes(':')) {
        return e.id.startsWith(selectedNamespace)
      }
      return e.id.toLowerCase().includes(selectedNamespace.toLowerCase())
    })
  }, [entities, selectedNamespace])

  const handleKindToggle = (kind: string) => {
    setPage(0)
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    )
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setPage(0)
  }

  const formatKind = (entity: GraphEntity): string => {
    const kind = entityKind(entity)
    return kind.toLowerCase().replace(/^./, (l) => l.toUpperCase())
  }

  const activeFilterCount =
    selectedKinds.length +
    (selectedNamespace !== 'ALL' ? 1 : 0) +
    (requireDescription ? 1 : 0)

  return (
    <div className="search-panel-container" aria-label="Entity Search and Discovery">
      <div className="search-panel-heading">
        <p className="eyebrow">Discover</p>
        <h2>Find Entities</h2>
      </div>

      {/* Search Input Bar */}
      <div className="search-bar-row">
        <label className="search-input-field" htmlFor="advanced-search-input">
          <Search size={16} aria-hidden="true" />
          <input
            id="advanced-search-input"
            type="search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(0)
            }}
            placeholder="Search by label, IRI, alias..."
            autoComplete="off"
            aria-label="Search entities"
          />
          {searchInput && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={handleClearSearch}
              title="Clear search input"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </label>

        <button
          type="button"
          className={`filter-toggle-btn ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setShowFilters((prev) => !prev)}
          title="Toggle search filters"
          aria-label="Toggle search filters"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={15} />
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Advanced Filter Drawer */}
      {showFilters && (
        <div className="search-filters-drawer" role="region" aria-label="Search filters">
          <div className="filter-group">
            <span className="filter-group-title">
              <Filter size={12} /> Semantic Kinds
            </span>
            <div className="kind-checkbox-grid">
              {availableKinds.map((kind) => {
                const checked = selectedKinds.includes(kind)
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`kind-pill ${checked ? 'active' : ''}`}
                    onClick={() => handleKindToggle(kind)}
                    aria-pressed={checked}
                  >
                    {checked && <Check size={11} />}
                    <span className={`kind-dot ${kind.toLowerCase()}`} aria-hidden="true" />
                    <span>{kind}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {prefixes.length > 0 && (
            <div className="filter-group">
              <span className="filter-group-title">Namespace</span>
              <select
                className="filter-select"
                value={selectedNamespace}
                onChange={(e) => {
                  setSelectedNamespace(e.target.value)
                  setPage(0)
                }}
                aria-label="Select namespace filter"
              >
                <option value="ALL">All namespaces</option>
                {prefixes.map((p) => (
                  <option key={p.prefix} value={`${p.prefix}:`}>
                    {p.prefix} ({p.iri})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label className="filter-checkbox-label">
              <input
                type="checkbox"
                checked={requireDescription}
                onChange={(e) => {
                  setRequireDescription(e.target.checked)
                  setPage(0)
                }}
              />
              <span>Require description</span>
            </label>
          </div>
        </div>
      )}

      {/* Results Header / Pagination status */}
      {isQueryActive && (
        <div className="search-results-meta">
          <span className="results-count">
            {isFetching ? (
              <span className="fetching-indicator">
                <LoaderCircle size={13} className="spin" /> Searching...
              </span>
            ) : (
              `${totalMatches} ${totalMatches === 1 ? 'match' : 'matches'}`
            )}
          </span>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                type="button"
                className="page-btn"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="page-indicator">
                {page + 1}/{totalPages}
              </span>
              <button
                type="button"
                className="page-btn"
                disabled={page >= totalPages - 1 || isFetching}
                onClick={() => setPage((p) => p + 1)}
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="search-results-list" aria-live="polite">
        {!isQueryActive && (
          <p className="search-hint">Enter at least two letters to search the knowledge graph.</p>
        )}

        {isError && (
          <div className="search-error-state">
            <CircleAlert size={16} />
            <span>Search error: {error instanceof Error ? error.message : 'Service unavailable'}</span>
          </div>
        )}

        {isQueryActive && !isLoading && displayedEntities.length === 0 && (
          <div className="search-empty-state">
            <p>No matching entities found.</p>
            {activeFilterCount > 0 && <small>Try loosening your search filters.</small>}
          </div>
        )}

        {displayedEntities.map((entity) => {
          const isSelected = selectedEntityId === entity.id
          const kind = entityKind(entity)
          return (
            <button
              key={entity.id}
              type="button"
              className={`entity-result-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectEntity(entity)}
              title={`Add ${entity.label} to canvas`}
            >
              <span className={`kind-dot ${kind.toLowerCase()}`} aria-hidden="true" />
              <div className="entity-result-text">
                <strong className="entity-result-label">{entity.label}</strong>
                <div className="entity-result-sub">
                  <span className="entity-type-tag">{formatKind(entity)}</span>
                  <span className="entity-iri-tag" title={entity.id}>
                    {entity.id}
                  </span>
                </div>
                {entity.description && (
                  <p className="entity-result-desc">{entity.description}</p>
                )}
              </div>
              <span className="add-action-icon" aria-hidden="true">
                <Plus size={15} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SearchPanel
