import React, { useMemo } from 'react'
import type { GraphEntity, GraphRelationship } from '../interfaces/models'
import './GraphSummary.css'

export interface GraphSummaryFilters {
  direction?: string
  selectedRelations?: string[]
  totalAvailableRelations?: number
  includeInferred?: boolean
  layoutName?: string
  textFilter?: string
}

export interface GraphSummaryProps {
  nodeCount: number
  edgeCount: number
  inferredCount: number
  selectedEntity?: GraphEntity | null
  selectedRelationship?: GraphRelationship | null
  filters?: GraphSummaryFilters
  isTruncated?: boolean
  limitReached?: boolean
  viewMode?: 'canvas' | 'overview' | 'table'
  className?: string
  showVisualDisclosure?: boolean
}

/**
 * Screen-reader accessible graph summary with polite ARIA live region (AX-004, AX-005).
 * Announces graph size, inferred relationships, selection, active filters, and truncation.
 */
export const GraphSummary: React.FC<GraphSummaryProps> = ({
  nodeCount,
  edgeCount,
  inferredCount,
  selectedEntity,
  selectedRelationship,
  filters,
  isTruncated = false,
  limitReached = false,
  viewMode = 'canvas',
  className = '',
  showVisualDisclosure = false,
}) => {
  const summaryMessage = useMemo(() => {
    const parts: string[] = []

    // 1. Graph Size & Inferred counts
    parts.push(`Showing ${nodeCount} node${nodeCount === 1 ? '' : 's'}, ${edgeCount} edge${edgeCount === 1 ? '' : 's'}.`)
    parts.push(`${inferredCount} inferred.`)

    // 2. View Mode
    parts.push(`Current view: ${viewMode === 'table' ? 'whole-graph table' : viewMode === 'overview' ? 'GPU class overview' : 'graph canvas'}.`)

    // 3. Selection
    if (selectedRelationship) {
      parts.push(
        `Selected relationship: ${selectedRelationship.source.label || selectedRelationship.source.id} ${
          selectedRelationship.relation
        } ${selectedRelationship.target.label || selectedRelationship.target.id} (${
          selectedRelationship.is_inferred ? 'inferred' : 'asserted'
        }).`,
      )
    } else if (selectedEntity) {
      parts.push(`Selected entity: ${selectedEntity.label || selectedEntity.id}.`)
    } else {
      parts.push('No entity selected.')
    }

    // 4. Filters
    const filterParts: string[] = []
    if (filters?.direction && filters.direction !== 'BOTH') {
      filterParts.push(`Direction: ${filters.direction}`)
    }
    if (filters?.selectedRelations && filters.totalAvailableRelations) {
      if (filters.selectedRelations.length < filters.totalAvailableRelations) {
        filterParts.push(`${filters.selectedRelations.length} of ${filters.totalAvailableRelations} relations`)
      }
    }
    if (filters?.includeInferred === false) {
      filterParts.push('inferred facts excluded')
    }
    if (filters?.textFilter?.trim()) {
      filterParts.push(`search: "${filters.textFilter.trim()}"`)
    }

    if (filterParts.length > 0) {
      parts.push(`Active filters: ${filterParts.join(', ')}.`)
    } else {
      parts.push('No active filters.')
    }

    // 5. Truncation or Limits
    if (limitReached) {
      parts.push('Warning: visible graph limit reached (500 nodes / 1000 edges).')
    } else if (isTruncated) {
      parts.push('Notice: more relationships available to expand.')
    }

    return parts.join(' ')
  }, [
    nodeCount,
    edgeCount,
    inferredCount,
    selectedEntity,
    selectedRelationship,
    filters,
    isTruncated,
    limitReached,
    viewMode,
  ])

  return (
    <div className={`graph-summary-component ${className}`}>
      {/* Visually hidden live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="graph-summary-announcer"
      >
        {summaryMessage}
      </div>

      {/* Optional visible summary for low-vision and keyboard users */}
      {showVisualDisclosure && (
        <details className="graph-summary-disclosure">
          <summary className="summary-disclosure-title">
            <span>Graph State Overview</span>
          </summary>
          <div className="summary-disclosure-content">
            <p>{summaryMessage}</p>
          </div>
        </details>
      )}
    </div>
  )
}

export default GraphSummary
