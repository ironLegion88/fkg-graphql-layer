import React, { useState, useEffect, useRef, useDeferredValue } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  Command,
  X,
  Plus,
  LoaderCircle,
  CornerDownLeft,
} from 'lucide-react'
import { searchEntities, entityKind } from '../api/graph'
import type { GraphEntity } from '../interfaces/models'
import './CommandPalette.css'

export interface CommandPaletteAction {
  id: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
  shortcut?: string
  onSelect: () => void
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectEntity?: (entity: GraphEntity) => void
  actions?: CommandPaletteAction[]
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectEntity,
  actions = [],
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const deferredQuery = useDeferredValue(query.trim())

  // Entity search query
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['cmd-palette-search', deferredQuery],
    queryFn: () => searchEntities(deferredQuery),
    enabled: isOpen && deferredQuery.length >= 2,
  })

  // Filter actions based on search query
  const filteredActions = React.useMemo(() => {
    if (!deferredQuery) return actions
    const lower = deferredQuery.toLowerCase()
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(lower) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(lower)),
    )
  }, [actions, deferredQuery])

  // Total list items: filtered actions + search results
  const combinedItems = React.useMemo(() => {
    const items: Array<
      | { type: 'action'; action: CommandPaletteAction }
      | { type: 'entity'; entity: GraphEntity }
    > = []

    for (const action of filteredActions) {
      items.push({ type: 'action', action })
    }

    for (const entity of searchResults) {
      items.push({ type: 'entity', entity })
    }

    return items
  }, [filteredActions, searchResults])

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          // If parent is listening, it will open
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Autofocus input on open and reset state
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Reset selected index when combinedItems change
  useEffect(() => {
    setSelectedIndex(0)
  }, [combinedItems.length])

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (combinedItems.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % combinedItems.length)
      scrollActiveItemIntoView((selectedIndex + 1) % combinedItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + combinedItems.length) % combinedItems.length)
      scrollActiveItemIntoView((selectedIndex - 1 + combinedItems.length) % combinedItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = combinedItems[selectedIndex]
      if (selected) {
        if (selected.type === 'action') {
          selected.action.onSelect()
          onClose()
        } else if (selected.type === 'entity' && onSelectEntity) {
          onSelectEntity(selected.entity)
          onClose()
        }
      }
    }
  }

  const scrollActiveItemIntoView = (index: number) => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('.palette-item')
    const item = items[index] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="palette-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Palette Search Input */}
        <div className="palette-input-bar">
          <Search size={18} className="palette-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search entities (e.g. Wine, Reset, Fit)..."
            aria-autocomplete="list"
            aria-controls="palette-items-list"
          />
          {isFetching && <LoaderCircle size={16} className="spin text-accent" />}
          <button
            type="button"
            className="palette-close-btn"
            onClick={onClose}
            title="Close command palette (Esc)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Palette Content List */}
        <div ref={listRef} id="palette-items-list" className="palette-items-list" role="listbox">
          {filteredActions.length > 0 && (
            <div className="palette-section-title">Commands & Actions</div>
          )}

          {filteredActions.map((action, idx) => {
            const isSelected = selectedIndex === idx
            return (
              <div
                key={action.id}
                role="option"
                aria-selected={isSelected}
                className={`palette-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  action.onSelect()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="palette-item-icon">
                  {action.icon ?? <Command size={14} />}
                </div>
                <div className="palette-item-text">
                  <span className="palette-item-title">{action.title}</span>
                  {action.subtitle && (
                    <span className="palette-item-subtitle">{action.subtitle}</span>
                  )}
                </div>
                {action.shortcut && (
                  <kbd className="palette-shortcut">{action.shortcut}</kbd>
                )}
                {isSelected && (
                  <span className="palette-enter-hint">
                    <CornerDownLeft size={12} />
                  </span>
                )}
              </div>
            )
          })}

          {searchResults.length > 0 && (
            <div className="palette-section-title">Entities Found</div>
          )}

          {searchResults.map((entity, idx) => {
            const itemIndex = filteredActions.length + idx
            const isSelected = selectedIndex === itemIndex
            const kind = entityKind(entity)
            return (
              <div
                key={entity.id}
                role="option"
                aria-selected={isSelected}
                className={`palette-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  onSelectEntity?.(entity)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(itemIndex)}
              >
                <span className={`kind-dot ${kind.toLowerCase()}`} aria-hidden="true" />
                <div className="palette-item-text">
                  <span className="palette-item-title">{entity.label}</span>
                  <span className="palette-item-subtitle">
                    {kind} • {entity.id}
                  </span>
                </div>
                <span className="palette-add-action">
                  <Plus size={14} /> Add to graph
                </span>
                {isSelected && (
                  <span className="palette-enter-hint">
                    <CornerDownLeft size={12} />
                  </span>
                )}
              </div>
            )
          })}

          {combinedItems.length === 0 && (
            <div className="palette-empty">
              <p>No matching commands or entities found.</p>
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span>
            <kbd>↵</kbd> to select
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
