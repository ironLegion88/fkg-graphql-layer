import { useEffect, useState, useMemo } from 'react'
import {
  X,
  Network,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  CheckSquare,
  Square,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react'
import type { ExpansionPreview, PreviewGroup, TraversalDirection } from '../interfaces/models'
import './ExpansionPreviewDialog.css'

export interface ExpansionPreviewDialogProps {
  isOpen: boolean
  entityLabel: string
  entityId: string
  preview: ExpansionPreview | null
  isLoading?: boolean
  error?: string | null
  onExpand(selectedGroups: PreviewGroup[]): void
  onCancel(): void
}

function getGroupKey(group: PreviewGroup): string {
  return `${group.relation}|${group.direction}`
}

export function ExpansionPreviewDialog({
  isOpen,
  entityLabel,
  entityId,
  preview,
  isLoading = false,
  error = null,
  onExpand,
  onCancel,
}: ExpansionPreviewDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // Initialize selected keys when preview data changes
  useEffect(() => {
    if (preview?.groups) {
      setSelectedKeys(new Set(preview.groups.map(getGroupKey)))
    } else {
      setSelectedKeys(new Set())
    }
  }, [preview])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  const groups = useMemo(() => preview?.groups || [], [preview])

  const totalSelectedCount = useMemo(() => {
    return groups
      .filter((g) => selectedKeys.has(getGroupKey(g)))
      .reduce((sum, g) => sum + g.count, 0)
  }, [groups, selectedKeys])

  const allSelected = groups.length > 0 && selectedKeys.size === groups.length

  const handleToggleGroup = (group: PreviewGroup) => {
    const key = getGroupKey(group)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedKeys(new Set(groups.map(getGroupKey)))
  }

  const handleDeselectAll = () => {
    setSelectedKeys(new Set())
  }

  const handleConfirm = () => {
    const selected = groups.filter((g) => selectedKeys.has(getGroupKey(g)))
    onExpand(selected)
  }

  if (!isOpen) return null

  return (
    <div
      className="expansion-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="expansion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expansion-dialog-title"
      >
        <div className="expansion-dialog-header">
          <div className="dialog-title-group">
            <div className="dialog-icon-badge">
              <Network size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="expansion-dialog-title">Expansion Preview</h2>
              <p className="dialog-entity-name" title={entityId}>
                <strong>{entityLabel}</strong>
                <span className="dialog-entity-id">{entityId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onCancel}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="expansion-dialog-body">
          {isLoading && (
            <div className="expansion-dialog-loading" role="status">
              <LoaderCircle size={28} className="spin" />
              <p>Analyzing entity relationships...</p>
            </div>
          )}

          {error && (
            <div className="expansion-dialog-error" role="alert">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && preview && (
            <>
              <div className="dialog-stats-banner">
                <div>
                  <span className="stats-label">Total Connections Available:</span>
                  <span className="stats-value">{preview.total_count}</span>
                </div>
                <div className="dialog-group-actions">
                  <button
                    type="button"
                    className="action-link-btn"
                    onClick={handleSelectAll}
                    disabled={allSelected}
                  >
                    <CheckSquare size={14} />
                    Select All
                  </button>
                  <button
                    type="button"
                    className="action-link-btn"
                    onClick={handleDeselectAll}
                    disabled={selectedKeys.size === 0}
                  >
                    <Square size={14} />
                    Deselect All
                  </button>
                </div>
              </div>

              {groups.length === 0 ? (
                <div className="empty-groups-notice">
                  <p>No connections available for this entity.</p>
                </div>
              ) : (
                <div className="preview-groups-list" role="group" aria-label="Relationship groups">
                  {groups.map((group) => {
                    const key = getGroupKey(group)
                    const isChecked = selectedKeys.has(key)
                    return (
                      <label
                        key={key}
                        className={`preview-group-item ${isChecked ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleGroup(group)}
                          aria-label={`Expand ${group.relation} (${group.direction.toLowerCase()}): ${group.count} connections`}
                        />
                        <div className="group-info">
                          <span className="group-relation-name">{group.relation}</span>
                          <span className={`direction-tag dir-${group.direction.toLowerCase()}`}>
                            {getDirectionIcon(group.direction)}
                            <span>{getDirectionLabel(group.direction)}</span>
                          </span>
                        </div>
                        <span className="group-count-badge">
                          {group.count} {group.count === 1 ? 'edge' : 'edges'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="expansion-dialog-footer">
          <div className="selection-summary">
            {selectedKeys.size > 0 ? (
              <span>
                <strong>{totalSelectedCount}</strong> relationships across{' '}
                <strong>{selectedKeys.size}</strong>{' '}
                {selectedKeys.size === 1 ? 'predicate' : 'predicates'} selected
              </span>
            ) : (
              <span className="none-selected-warning">No relationships selected</span>
            )}
          </div>
          <div className="dialog-buttons">
            <button type="button" className="dialog-btn secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="dialog-btn primary"
              onClick={handleConfirm}
              disabled={isLoading || selectedKeys.size === 0}
            >
              Expand Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getDirectionIcon(direction: TraversalDirection | string) {
  const normalized = (direction || '').toUpperCase()
  switch (normalized) {
    case 'OUTGOING':
      return <ArrowRight size={13} aria-hidden="true" />
    case 'INCOMING':
      return <ArrowLeft size={13} aria-hidden="true" />
    case 'BOTH':
    default:
      return <ArrowLeftRight size={13} aria-hidden="true" />
  }
}

function getDirectionLabel(direction: TraversalDirection | string): string {
  const normalized = (direction || '').toUpperCase()
  switch (normalized) {
    case 'OUTGOING':
      return 'Outgoing'
    case 'INCOMING':
      return 'Incoming'
    case 'BOTH':
    default:
      return 'Both'
  }
}
