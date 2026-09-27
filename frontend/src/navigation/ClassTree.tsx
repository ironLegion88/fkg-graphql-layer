import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronRight,
  ChevronDown,
  FolderTree,
  LoaderCircle,
  AlertCircle,
  Search,
  Filter,
  Layers,
  ChevronUp,
} from 'lucide-react'
import { listClasses } from '../api/graph'
import type { ClassInfo } from '../interfaces/models'
import './ClassTree.css'

export interface ClassTreeProps {
  onSelectClass: (iri: string, label: string) => void
  selectedIri?: string | null
}

interface TreeNode {
  classInfo: ClassInfo
  children: TreeNode[]
}

export const ClassTree: React.FC<ClassTreeProps> = ({ onSelectClass, selectedIri }) => {
  const [filterText, setFilterText] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState<string>('ALL')
  const [expandedIris, setExpandedIris] = useState<Set<string>>(new Set())

  const {
    data: classes = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['list-classes'],
    queryFn: () => listClasses(200, 0),
  })

  // Extract unique namespaces from compact_iri prefix or full iri
  const namespaces = useMemo(() => {
    const set = new Set<string>()
    for (const c of classes) {
      if (c.compact_iri?.prefix) {
        set.add(c.compact_iri.prefix)
      } else if (c.compact_iri?.namespace) {
        set.add(c.compact_iri.namespace)
      } else {
        const hashIdx = c.iri.lastIndexOf('#')
        const slashIdx = c.iri.lastIndexOf('/')
        const splitIdx = Math.max(hashIdx, slashIdx)
        if (splitIdx > 0) {
          set.add(c.iri.slice(0, splitIdx + 1))
        }
      }
    }
    return Array.from(set).sort()
  }, [classes])

  // Build hierarchy tree
  const { rootNodes } = useMemo(() => {
    const map = new Map<string, ClassInfo>()
    for (const c of classes) {
      map.set(c.iri, c)
    }

    // Filter by namespace if selected
    const filteredClasses = classes.filter((c) => {
      if (selectedNamespace === 'ALL') return true
      if (c.compact_iri?.prefix === selectedNamespace) return true
      if (c.compact_iri?.namespace === selectedNamespace) return true
      return c.iri.startsWith(selectedNamespace)
    })

    const filteredMap = new Map<string, ClassInfo>()
    for (const c of filteredClasses) {
      filteredMap.set(c.iri, c)
    }

    // Determine root classes: direct_parents is empty or none of direct_parents are in the list (except owl:Thing)
    const roots: ClassInfo[] = []
    for (const c of filteredClasses) {
      const hasParentInList = c.direct_parents.some(
        (pIri) =>
          filteredMap.has(pIri) &&
          !pIri.endsWith('#Thing') &&
          !pIri.endsWith('/Thing'),
      )
      if (!hasParentInList) {
        roots.push(c)
      }
    }

    // Build recursive nodes preventing cycles
    function buildNode(c: ClassInfo, visited: Set<string>): TreeNode {
      visited.add(c.iri)
      // Children can come from c.direct_children or children whose direct_parents contain c.iri
      const childIris = new Set<string>(c.direct_children)
      for (const other of filteredClasses) {
        if (other.direct_parents.includes(c.iri)) {
          childIris.add(other.iri)
        }
      }

      const childNodes: TreeNode[] = []
      for (const childIri of childIris) {
        const childInfo = filteredMap.get(childIri)
        if (childInfo && !visited.has(childIri)) {
          childNodes.push(buildNode(childInfo, new Set(visited)))
        }
      }

      // Sort children by label
      childNodes.sort((a, b) => a.classInfo.label.localeCompare(b.classInfo.label))
      return { classInfo: c, children: childNodes }
    }

    roots.sort((a, b) => a.label.localeCompare(b.label))
    const builtRoots = roots.map((r) => buildNode(r, new Set()))

    return { rootNodes: builtRoots }
  }, [classes, selectedNamespace])

  // Filter tree by search term
  const displayedNodes = useMemo(() => {
    if (!filterText.trim()) return rootNodes
    const lower = filterText.toLowerCase()

    function filterNode(node: TreeNode): TreeNode | null {
      const matches =
        node.classInfo.label.toLowerCase().includes(lower) ||
        node.classInfo.iri.toLowerCase().includes(lower) ||
        (node.classInfo.compact_iri?.local_name.toLowerCase().includes(lower) ?? false)

      const matchedChildren: TreeNode[] = []
      for (const child of node.children) {
        const filteredChild = filterNode(child)
        if (filteredChild) {
          matchedChildren.push(filteredChild)
        }
      }

      if (matches || matchedChildren.length > 0) {
        return {
          classInfo: node.classInfo,
          children: matchedChildren,
        }
      }
      return null
    }

    const result: TreeNode[] = []
    for (const root of rootNodes) {
      const filtered = filterNode(root)
      if (filtered) result.push(filtered)
    }
    return result
  }, [rootNodes, filterText])

  const toggleExpand = (iri: string) => {
    setExpandedIris((prev) => {
      const next = new Set(prev)
      if (next.has(iri)) {
        next.delete(iri)
      } else {
        next.add(iri)
      }
      return next
    })
  }

  const expandAll = () => {
    const all = new Set<string>()
    for (const c of classes) {
      all.add(c.iri)
    }
    setExpandedIris(all)
  }

  const collapseAll = () => {
    setExpandedIris(new Set())
  }

  const renderNode = (node: TreeNode, depth = 0) => {
    const { classInfo, children } = node
    const isExpanded = expandedIris.has(classInfo.iri) || filterText.trim().length > 0
    const hasChildren = children.length > 0
    const isSelected = selectedIri === classInfo.iri

    const displayName =
      classInfo.label || classInfo.compact_iri?.local_name || classInfo.iri.split(/[#/]/).pop() || classInfo.iri

    return (
      <div key={classInfo.iri} className="tree-node-wrapper">
        <div
          className={`tree-node-row ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="tree-toggle-btn"
              onClick={() => toggleExpand(classInfo.iri)}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              title={isExpanded ? 'Collapse class node' : 'Expand class node'}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="tree-toggle-spacer" />
          )}

          <button
            type="button"
            className="tree-label-btn"
            onClick={() => onSelectClass(classInfo.iri, displayName)}
            title={`Select ${displayName} (${classInfo.iri})`}
          >
            <span className="class-icon" aria-hidden="true">
              <Layers size={13} />
            </span>
            <span className="class-label-text">{displayName}</span>
            {classInfo.compact_iri?.prefix && (
              <span className="prefix-badge">{classInfo.compact_iri.prefix}</span>
            )}
          </button>

          {classInfo.instance_count > 0 && (
            <span className="instance-badge" title={`${classInfo.instance_count} instances`}>
              {classInfo.instance_count}
            </span>
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="tree-children">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="class-tree-loading">
        <LoaderCircle size={22} className="spin text-accent" />
        <span>Loading class hierarchy...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="class-tree-error">
        <AlertCircle size={20} className="text-danger" />
        <p>Failed to load classes: {error instanceof Error ? error.message : 'Unknown error'}</p>
        <button type="button" className="retry-btn" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="class-tree-container" aria-label="Ontology Class Hierarchy">
      <div className="class-tree-header">
        <div className="class-tree-title">
          <FolderTree size={16} />
          <h3>Classes ({classes.length})</h3>
        </div>
        <div className="tree-actions">
          <button type="button" className="tree-btn-sm" onClick={expandAll} title="Expand all classes">
            <ChevronDown size={13} /> All
          </button>
          <button type="button" className="tree-btn-sm" onClick={collapseAll} title="Collapse all classes">
            <ChevronUp size={13} /> None
          </button>
        </div>
      </div>

      <div className="class-tree-controls">
        <div className="tree-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            placeholder="Filter classes..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Filter classes by name"
          />
        </div>

        {namespaces.length > 1 && (
          <div className="tree-namespace-filter">
            <Filter size={13} aria-hidden="true" />
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              aria-label="Filter by namespace"
            >
              <option value="ALL">All namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="class-tree-list" role="tree">
        {displayedNodes.length === 0 ? (
          <div className="class-tree-empty">
            <p>No classes match current filters.</p>
          </div>
        ) : (
          displayedNodes.map((root) => renderNode(root, 0))
        )}
      </div>
    </div>
  )
}

export default ClassTree
