import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Boxes,
  Tag,
  Circle,
  Search,
  Route,
  GitCompare,
  FileText,
  Zap,
  Check,
  RotateCcw,
} from 'lucide-react'
import type { ClassInfo, GraphEntity, GraphRelationship } from '../interfaces/models'
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
    return new Set<string>()
  })
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Auto expand all when requested or when nodes load if autoExpandAll is true
  useEffect(() => {
    if (autoExpandAll && nodes.length > 0) {
      const allIds = new Set<string>()
      const collect = (list: TreeNode<T>[]) => {
        for (const item of list) {
          if (item.children && item.children.length > 0) {
            allIds.add(item.id)
            collect(item.children)
          }
        }
      }
      collect(nodes)
      setExpandedIds(allIds)
    }
  }, [autoExpandAll, nodes])

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

  // When filtering, expand matching branches
  const activeExpandedIds = useMemo(() => {
    if (filterText.trim()) {
      return new Set([...expandedIds, ...matchingExpandedIds])
    }
    return expandedIds
  }, [expandedIds, matchingExpandedIds, filterText])

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

/* ========================================================================= */
/* Helper builders for reusable hierarchy tree structures (AX-002)           */
/* ========================================================================= */

/**
 * Builds a hierarchical class tree from ClassInfo objects.
 */
export function buildClassHierarchyTree(
  classes: ClassInfo[],
): TreeNode<ClassInfo>[] {
  const map = new Map<string, ClassInfo>()
  for (const c of classes) {
    map.set(c.iri, c)
  }

  // Find root classes: classes with no direct parents or only owl:Thing
  const rootIris: string[] = []
  for (const c of classes) {
    const validParents = c.direct_parents.filter(
      (p) => p !== c.iri && map.has(p),
    )
    if (validParents.length === 0) {
      rootIris.push(c.iri)
    }
  }

  // Recursive tree constructor with cycle prevention
  function buildNode(iri: string, visited: Set<string>): TreeNode<ClassInfo> | null {
    const classInfo = map.get(iri)
    if (!classInfo || visited.has(iri)) return null

    visited.add(iri)
    const childrenNodes: TreeNode<ClassInfo>[] = []

    for (const childIri of classInfo.direct_children) {
      if (map.has(childIri) && !visited.has(childIri)) {
        const childNode = buildNode(childIri, new Set(visited))
        if (childNode) {
          childrenNodes.push(childNode)
        }
      }
    }

    return {
      id: classInfo.iri,
      label: classInfo.label || classInfo.compact_iri?.local_name || classInfo.iri,
      subtitle: classInfo.compact_iri?.prefix ? `${classInfo.compact_iri.prefix}:${classInfo.compact_iri.local_name}` : undefined,
      icon: <Boxes size={14} className="tree-class-icon" />,
      badge: classInfo.instance_count > 0 ? `${classInfo.instance_count} instances` : undefined,
      badgeVariant: 'info',
      children: childrenNodes.length > 0 ? childrenNodes : undefined,
      data: classInfo,
    }
  }

  const roots: TreeNode<ClassInfo>[] = []
  for (const rootIri of rootIris) {
    const rootNode = buildNode(rootIri, new Set())
    if (rootNode) {
      roots.push(rootNode)
    }
  }

  // Fallback: If no roots detected, list all classes flatly
  if (roots.length === 0 && classes.length > 0) {
    return classes.map((c) => ({
      id: c.iri,
      label: c.label || c.iri,
      icon: <Boxes size={14} className="tree-class-icon" />,
      badge: c.instance_count > 0 ? `${c.instance_count} instances` : undefined,
      badgeVariant: 'info',
      data: c,
    }))
  }

  return roots
}

/**
 * Builds a path sequence tree from entities and connecting relations.
 */
export function buildPathTree(
  entities: GraphEntity[],
  relations: string[] = [],
): TreeNode<GraphEntity>[] {
  if (entities.length === 0) return []

  return entities.map((entity, index) => {
    const isSource = index === 0
    const isTarget = index === entities.length - 1
    const incomingRelation = index > 0 ? relations[index - 1] : undefined

    return {
      id: `${entity.id}_step_${index}`,
      label: entity.label || entity.id,
      subtitle: incomingRelation
        ? `← [${incomingRelation}] from step ${index}`
        : isSource
          ? 'Start Node (Source)'
          : undefined,
      icon: isSource ? (
        <Circle size={14} style={{ color: '#059669' }} />
      ) : isTarget ? (
        <Circle size={14} style={{ color: '#dc2626' }} />
      ) : (
        <Route size={14} style={{ color: '#0284c7' }} />
      ),
      badge: isSource ? 'Start' : isTarget ? 'Goal' : `Step ${index}`,
      badgeVariant: isSource ? 'success' : isTarget ? 'warning' : 'default',
      data: entity,
    }
  })
}

/**
 * Builds comparison hierarchy tree showing shared and unique relationships.
 */
export function buildComparisonTree(
  shared: GraphRelationship[],
  uniqueA: GraphRelationship[],
  uniqueB: GraphRelationship[],
  labelA: string = 'Entity A',
  labelB: string = 'Entity B',
): TreeNode[] {
  const result: TreeNode[] = []

  // Shared Group
  result.push({
    id: 'group_shared',
    label: `Shared Facts (${shared.length})`,
    subtitle: `Relationships present in both ${labelA} and ${labelB}`,
    icon: <GitCompare size={15} style={{ color: '#059669' }} />,
    badge: `${shared.length} shared`,
    badgeVariant: 'success',
    children: shared.map((rel, idx) => ({
      id: `shared_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred fact' : '✓ Directly asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  // Unique A Group
  result.push({
    id: 'group_unique_a',
    label: `Unique to ${labelA} (${uniqueA.length})`,
    subtitle: `Relationships present only for ${labelA}`,
    icon: <Tag size={15} style={{ color: '#2563eb' }} />,
    badge: `${uniqueA.length} unique`,
    badgeVariant: 'info',
    children: uniqueA.map((rel, idx) => ({
      id: `unique_a_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred' : '✓ Asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  // Unique B Group
  result.push({
    id: 'group_unique_b',
    label: `Unique to ${labelB} (${uniqueB.length})`,
    subtitle: `Relationships present only for ${labelB}`,
    icon: <Tag size={15} style={{ color: '#d97706' }} />,
    badge: `${uniqueB.length} unique`,
    badgeVariant: 'warning',
    children: uniqueB.map((rel, idx) => ({
      id: `unique_b_${idx}_${rel.relation}`,
      label: `${rel.source.label} —[${rel.relation}]→ ${rel.target.label}`,
      subtitle: rel.is_inferred ? '⚡ Inferred' : '✓ Asserted',
      icon: rel.is_inferred ? <Zap size={13} /> : <Check size={13} />,
      badge: rel.is_inferred ? 'Inferred' : 'Asserted',
      badgeVariant: rel.is_inferred ? 'inferred' : 'asserted',
    })),
  })

  return result
}

/**
 * Builds proof steps explanation tree.
 */
export function buildProofTree(
  proofSteps: {
    step: number
    conclusion: string
    premises: string[]
    rule?: string
  }[],
): TreeNode[] {
  return proofSteps.map((step) => ({
    id: `proof_step_${step.step}`,
    label: `Step ${step.step}: ${step.conclusion}`,
    subtitle: step.rule ? `Rule: ${step.rule}` : undefined,
    icon: <FileText size={14} style={{ color: '#7c3aed' }} />,
    badge: step.rule || `Step ${step.step}`,
    badgeVariant: 'info',
    children: step.premises.map((premise, pIdx) => ({
      id: `proof_step_${step.step}_premise_${pIdx}`,
      label: premise,
      icon: <Check size={13} style={{ color: '#059669' }} />,
      badge: 'Premise',
      badgeVariant: 'default',
    })),
  }))
}

export default HierarchyTreeView
