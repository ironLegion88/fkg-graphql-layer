import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Boxes,
  Search,
  RotateCcw,
} from 'lucide-react'
import './HierarchyTreeView.css'

export type NodeBadgeVariant =
  | 'default'
  | 'inferred'
  | 'asserted'
  | 'warning'
  | 'info'
  | 'success'

export interface TreeNode<T = unknown> {
  id: string
  label: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: string | number
  badgeVariant?: NodeBadgeVariant
  children?: TreeNode<T>[]
  data?: T
  disabled?: boolean
}

export interface HierarchyTreeViewProps<T = unknown> {
  nodes: TreeNode<T>[]
  selectedId?: string | null
  onSelect?: (node: TreeNode<T>) => void
  onToggleExpand?: (nodeId: string, expanded: boolean) => void
  ariaLabel?: string
  enableFilter?: boolean
  filterPlaceholder?: string
  initialExpandedIds?: string[]
  autoExpandAll?: boolean
  emptyMessage?: string
}

interface FlattenedNode<T = unknown> {
  node: TreeNode<T>
  depth: number
  parentId: string | null
  hasChildren: boolean
  isExpanded: boolean
  indexInSiblings: number
  siblingsCount: number
}

export function HierarchyTreeView<T = unknown>({
  nodes,
  selectedId,
  onSelect,
  onToggleExpand,
  ariaLabel = 'Hierarchy Tree',
  enableFilter = true,
  filterPlaceholder = 'Filter tree nodes...',
  initialExpandedIds,
  autoExpandAll = false,
  emptyMessage = 'No items in tree hierarchy.',
}: HierarchyTreeViewProps<T>) {
  const [filterText, setFilterText] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (initialExpandedIds) return new Set(initialExpandedIds)
    if (autoExpandAll && nodes.length > 0) {
      const all = new Set<string>()
      const collect = (list: TreeNode<T>[]) => {
        for (const item of list) {
          if (item.children && item.children.length > 0) {
            all.add(item.id)
            collect(item.children)
          }
        }
      }
      collect(nodes)
      return all
    }
    return new Set<string>()
  })
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Filter nodes recursively and track which parent nodes must be expanded
  const { filteredNodes, matchingExpandedIds } = useMemo(() => {
    if (!filterText.trim()) {
      return { filteredNodes: nodes, matchingExpandedIds: new Set<string>() }
    }

    const query = filterText.toLowerCase().trim()
    const expandedToMatch = new Set<string>()

    function filterBranch(list: TreeNode<T>[]): TreeNode<T>[] {
      const result: TreeNode<T>[] = []
      for (const item of list) {
        const matchesCurrent =
          item.label.toLowerCase().includes(query) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
          item.id.toLowerCase().includes(query)

        const filteredChildren = item.children ? filterBranch(item.children) : []

        if (matchesCurrent || filteredChildren.length > 0) {
          if (filteredChildren.length > 0) {
            expandedToMatch.add(item.id)
          }
          result.push({
            ...item,
            children: filteredChildren.length > 0 ? filteredChildren : item.children,
          })
        }
      }
      return result
    }

    return {
      filteredNodes: filterBranch(nodes),
      matchingExpandedIds: expandedToMatch,
    }
  }, [nodes, filterText])

  // When filtering or autoExpandAll, expand matching branches
  const activeExpandedIds = useMemo(() => {
    if (autoExpandAll) {
      const all = new Set<string>(expandedIds)
      const collect = (list: TreeNode<T>[]) => {
        for (const item of list) {
          if (item.children && item.children.length > 0) {
            all.add(item.id)
            collect(item.children)
          }
        }
      }
      collect(nodes)
      return all
    }
    if (filterText.trim()) {
      return new Set([...expandedIds, ...matchingExpandedIds])
    }
    return expandedIds
  }, [autoExpandAll, nodes, expandedIds, matchingExpandedIds, filterText])

  // Flatten visible nodes for keyboard navigation
  const flattenedVisibleNodes = useMemo(() => {
    const list: FlattenedNode<T>[] = []

    function traverse(
      branch: TreeNode<T>[],
      depth: number,
      parentId: string | null,
    ) {
      branch.forEach((node, idx) => {
        const hasChildren = Boolean(node.children && node.children.length > 0)
        const isExpanded = activeExpandedIds.has(node.id)

        list.push({
          node,
          depth,
          parentId,
          hasChildren,
          isExpanded,
          indexInSiblings: idx,
          siblingsCount: branch.length,
        })

        if (hasChildren && isExpanded && node.children) {
          traverse(node.children, depth + 1, node.id)
        }
      })
    }

    traverse(filteredNodes, 1, null)
    return list
  }, [filteredNodes, activeExpandedIds])

  // Ensure there is always a valid focused node in visible items
  const effectiveFocusedId = useMemo(() => {
    if (focusedId && flattenedVisibleNodes.some((item) => item.node.id === focusedId)) {
      return focusedId
    }
    if (selectedId && flattenedVisibleNodes.some((item) => item.node.id === selectedId)) {
      return selectedId
    }
    return flattenedVisibleNodes[0]?.node.id || null
  }, [focusedId, selectedId, flattenedVisibleNodes])

  const toggleExpand = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        const willExpand = !next.has(nodeId)
        if (willExpand) {
          next.add(nodeId)
        } else {
          next.delete(nodeId)
        }
        onToggleExpand?.(nodeId, willExpand)
        return next
      })
    },
    [onToggleExpand],
  )

  const expandAll = () => {
    const all = new Set<string>()
    const collect = (list: TreeNode<T>[]) => {
      for (const item of list) {
        if (item.children && item.children.length > 0) {
          all.add(item.id)
          collect(item.children)
        }
      }
    }
    collect(filteredNodes)
    setExpandedIds(all)
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  // Keyboard navigation handler (AX-001, WCAG Tree View spec)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flattenedVisibleNodes.length === 0) return

    const currentIndex = flattenedVisibleNodes.findIndex(
      (item) => item.node.id === effectiveFocusedId,
    )
    if (currentIndex === -1) return

    const currentItem = flattenedVisibleNodes[currentIndex]

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const nextIdx = Math.min(flattenedVisibleNodes.length - 1, currentIndex + 1)
        const nextId = flattenedVisibleNodes[nextIdx].node.id
        setFocusedId(nextId)
        scrollNodeIntoView(nextId)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevIdx = Math.max(0, currentIndex - 1)
        const prevId = flattenedVisibleNodes[prevIdx].node.id
        setFocusedId(prevId)
        scrollNodeIntoView(prevId)
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        if (currentItem.hasChildren) {
          if (!currentItem.isExpanded) {
            toggleExpand(currentItem.node.id)
          } else if (currentIndex + 1 < flattenedVisibleNodes.length) {
            // Move to first child
            const nextId = flattenedVisibleNodes[currentIndex + 1].node.id
            setFocusedId(nextId)
            scrollNodeIntoView(nextId)
          }
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        if (currentItem.hasChildren && currentItem.isExpanded) {
          toggleExpand(currentItem.node.id)
        } else if (currentItem.parentId) {
          // Move to parent
          setFocusedId(currentItem.parentId)
          scrollNodeIntoView(currentItem.parentId)
        }
        break
      }
      case 'Home': {
        e.preventDefault()
        const firstId = flattenedVisibleNodes[0].node.id
        setFocusedId(firstId)
        scrollNodeIntoView(firstId)
        break
      }
      case 'End': {
        e.preventDefault()
        const lastId = flattenedVisibleNodes[flattenedVisibleNodes.length - 1].node.id
        setFocusedId(lastId)
        scrollNodeIntoView(lastId)
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (!currentItem.node.disabled) {
          onSelect?.(currentItem.node)
        }
        break
      }
      case ' ': {
        e.preventDefault()
        if (currentItem.hasChildren) {
          toggleExpand(currentItem.node.id)
        } else if (!currentItem.node.disabled) {
          onSelect?.(currentItem.node)
        }
        break
      }
      case '*': {
        e.preventDefault()
        // Expand all siblings at this level
        const siblingNodes = flattenedVisibleNodes.filter(
          (item) => item.parentId === currentItem.parentId && item.hasChildren,
        )
        setExpandedIds((prev) => {
          const next = new Set(prev)
          siblingNodes.forEach((s) => next.add(s.node.id))
          return next
        })
        break
      }
    }
  }

  const scrollNodeIntoView = (id: string) => {
    if (!treeContainerRef.current) return
    const el = treeContainerRef.current.querySelector<HTMLElement>(`[data-node-id="${id}"]`)
    if (el) {
      el.focus()
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' })
    }
  }

  return (
    <div className="hierarchy-tree-wrapper" aria-label={`${ariaLabel} Container`}>
      {/* Filter and expansion toolbar */}
      {enableFilter && (
        <div className="hierarchy-tree-toolbar">
          <div className="tree-filter-box">
            <Search size={14} className="tree-filter-icon" aria-hidden="true" />
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={filterPlaceholder}
              aria-label={`Search and filter ${ariaLabel}`}
              className="tree-filter-input"
            />
            {filterText && (
              <button
                type="button"
                className="clear-tree-filter"
                onClick={() => setFilterText('')}
                aria-label="Clear tree search filter"
              >
                ×
              </button>
            )}
          </div>

          <div className="tree-quick-actions" role="group" aria-label="Expand or collapse tree nodes">
            <button
              type="button"
              className="tree-action-btn"
              onClick={expandAll}
              title="Expand all tree branches"
              aria-label="Expand all nodes"
            >
              Expand All
            </button>
            <button
              type="button"
              className="tree-action-btn"
              onClick={collapseAll}
              title="Collapse all tree branches"
              aria-label="Collapse all nodes"
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* ARIA Tree Container */}
      <div
        ref={treeContainerRef}
        className="hierarchy-tree-content"
        role="tree"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {flattenedVisibleNodes.length > 0 ? (
          flattenedVisibleNodes.map((item) => {
            const { node, depth, hasChildren, isExpanded, indexInSiblings, siblingsCount } = item
            const isSelected = selectedId === node.id
            const isFocused = effectiveFocusedId === node.id

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                role="treeitem"
                tabIndex={isFocused ? 0 : -1}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-selected={isSelected}
                aria-level={depth}
                aria-setsize={siblingsCount}
                aria-posinset={indexInSiblings + 1}
                aria-disabled={node.disabled}
                className={`tree-node-row ${isSelected ? 'selected' : ''} ${
                  isFocused ? 'focused' : ''
                } ${node.disabled ? 'disabled' : ''}`}
                style={{ paddingLeft: `${(depth - 1) * 18 + 8}px` }}
                onClick={() => {
                  setFocusedId(node.id)
                  if (!node.disabled) {
                    onSelect?.(node)
                  }
                }}
              >
                {/* Expand / Collapse Chevron */}
                {hasChildren ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    className="tree-chevron-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(node.id)
                    }}
                    aria-label={isExpanded ? `Collapse ${node.label}` : `Expand ${node.label}`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={14} aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span className="tree-chevron-placeholder" aria-hidden="true" />
                )}

                {/* Node Type Icon */}
                <span className="tree-node-icon" aria-hidden="true">
                  {node.icon || <Boxes size={14} />}
                </span>

                {/* Node Label & Subtitle */}
                <div className="tree-node-text">
                  <span className="tree-node-title" title={node.id}>
                    {node.label}
                  </span>
                  {node.subtitle && (
                    <span className="tree-node-subtitle" title={node.subtitle}>
                      {node.subtitle}
                    </span>
                  )}
                </div>

                {/* Redundant Badge / Tag */}
                {node.badge !== undefined && (
                  <span
                    className={`tree-node-badge badge-${node.badgeVariant || 'default'}`}
                    title={String(node.badge)}
                  >
                    {node.badge}
                  </span>
                )}
              </div>
            )
          })
        ) : (
          <div className="tree-empty-state">
            <p className="tree-empty-text">{filterText ? 'No matching nodes found.' : emptyMessage}</p>
            {filterText && (
              <button
                type="button"
                className="tree-reset-filter-btn"
                onClick={() => setFilterText('')}
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Reset filter</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HierarchyTreeView
