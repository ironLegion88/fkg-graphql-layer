import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Binary,
  Tag,
  ArrowRightLeft,
  Search,
  Filter,
  LoaderCircle,
  AlertCircle,
  Hash,
} from 'lucide-react'
import { listProperties } from '../api/graph'
import type { PropertyInfo } from '../interfaces/models'
import './PropertyBrowser.css'

export interface PropertyBrowserProps {
  onSelectProperty: (iri: string, label: string, property?: PropertyInfo) => void
  selectedIri?: string | null
}

export const PropertyBrowser: React.FC<PropertyBrowserProps> = ({
  onSelectProperty,
  selectedIri,
}) => {
  const [filterText, setFilterText] = useState('')
  const [kindFilter, setKindFilter] = useState<string>('ALL')
  const [selectedNamespace, setSelectedNamespace] = useState<string>('ALL')

  const {
    data: properties = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['list-properties'],
    queryFn: () => listProperties(250, 0),
  })

  // Extract unique namespaces
  const namespaces = useMemo(() => {
    const set = new Set<string>()
    for (const p of properties) {
      if (p.compact_iri?.prefix) {
        set.add(p.compact_iri.prefix)
      } else if (p.compact_iri?.namespace) {
        set.add(p.compact_iri.namespace)
      } else {
        const hashIdx = p.iri.lastIndexOf('#')
        const slashIdx = p.iri.lastIndexOf('/')
        const splitIdx = Math.max(hashIdx, slashIdx)
        if (splitIdx > 0) {
          set.add(p.iri.slice(0, splitIdx + 1))
        }
      }
    }
    return Array.from(set).sort()
  }, [properties])

  // Extract unique kinds
  const kinds = useMemo(() => {
    const set = new Set<string>()
    for (const p of properties) {
      if (p.property_kind) set.add(p.property_kind)
    }
    return Array.from(set).sort()
  }, [properties])

  // Filtered properties
  const filteredProperties = useMemo(() => {
    return properties.filter((p) => {
      // Kind filter
      if (kindFilter !== 'ALL' && p.property_kind.toLowerCase() !== kindFilter.toLowerCase()) {
        return false
      }

      // Namespace filter
      if (selectedNamespace !== 'ALL') {
        const matchesNs =
          p.compact_iri?.prefix === selectedNamespace ||
          p.compact_iri?.namespace === selectedNamespace ||
          p.iri.startsWith(selectedNamespace)
        if (!matchesNs) return false
      }

      // Text filter
      if (filterText.trim()) {
        const lower = filterText.toLowerCase()
        const matchesText =
          p.label.toLowerCase().includes(lower) ||
          p.iri.toLowerCase().includes(lower) ||
          (p.compact_iri?.local_name.toLowerCase().includes(lower) ?? false) ||
          p.domains.some((d) => d.toLowerCase().includes(lower)) ||
          p.ranges.some((r) => r.toLowerCase().includes(lower))
        if (!matchesText) return false
      }

      return true
    })
  }, [properties, kindFilter, selectedNamespace, filterText])

  const formatIriShort = (iri: string) => {
    return iri.split(/[#/]/).pop() || iri
  }

  if (isLoading) {
    return (
      <div className="property-browser-loading">
        <LoaderCircle size={22} className="spin text-accent" />
        <span>Loading ontology properties...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="property-browser-error">
        <AlertCircle size={20} className="text-danger" />
        <p>Failed to load properties: {error instanceof Error ? error.message : 'Unknown error'}</p>
        <button type="button" className="retry-btn" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="property-browser-container" aria-label="Ontology Properties Browser">
      <div className="property-browser-header">
        <div className="property-browser-title">
          <Binary size={16} />
          <h3>Properties ({filteredProperties.length}/{properties.length})</h3>
        </div>
      </div>

      <div className="property-browser-controls">
        <div className="prop-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            placeholder="Search properties, domains, ranges..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Filter properties"
          />
        </div>

        <div className="prop-filter-row">
          <div className="prop-kind-selector">
            <button
              type="button"
              className={`kind-tab ${kindFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setKindFilter('ALL')}
            >
              All
            </button>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className={`kind-tab ${kindFilter === k ? 'active' : ''}`}
                onClick={() => setKindFilter(k)}
              >
                {k.replace('Property', '')}
              </button>
            ))}
          </div>

          {namespaces.length > 1 && (
            <div className="prop-ns-select">
              <Filter size={12} aria-hidden="true" />
              <select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                aria-label="Filter properties by namespace"
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
      </div>

      <div className="property-list" role="list">
        {filteredProperties.length === 0 ? (
          <div className="property-browser-empty">
            <p>No properties match the selected criteria.</p>
          </div>
        ) : (
          filteredProperties.map((p) => {
            const isSelected = selectedIri === p.iri
            const displayName =
              p.label || p.compact_iri?.local_name || formatIriShort(p.iri)
            const kindKey = p.property_kind.toLowerCase()

            return (
              <div
                key={p.iri}
                className={`property-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectProperty(p.iri, displayName, p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectProperty(p.iri, displayName, p)
                  }
                }}
              >
                <div className="property-card-header">
                  <div className="property-card-title">
                    <span className={`property-kind-badge kind-${kindKey}`} title={p.property_kind}>
                      {p.property_kind === 'ObjectProperty' ? (
                        <ArrowRightLeft size={12} />
                      ) : (
                        <Tag size={12} />
                      )}
                      <span>{p.property_kind.replace('Property', '')}</span>
                    </span>
                    <strong className="property-name">{displayName}</strong>
                  </div>

                  {p.usage_count > 0 && (
                    <span className="prop-usage-badge" title={`${p.usage_count} uses in store`}>
                      <Hash size={10} />
                      {p.usage_count}
                    </span>
                  )}
                </div>

                <div className="property-card-body">
                  <span className="property-iri-text" title={p.iri}>
                    {p.compact_iri?.prefix ? `${p.compact_iri.prefix}:${p.compact_iri.local_name}` : p.iri}
                  </span>

                  {(p.domains.length > 0 || p.ranges.length > 0) && (
                    <div className="property-signature">
                      {p.domains.length > 0 && (
                        <span className="signature-part domain-part" title={`Domain: ${p.domains.join(', ')}`}>
                          <span className="sig-label">domain:</span> {p.domains.map(formatIriShort).join(', ')}
                        </span>
                      )}
                      {p.ranges.length > 0 && (
                        <span className="signature-part range-part" title={`Range: ${p.ranges.join(', ')}`}>
                          <span className="sig-label">range:</span> {p.ranges.map(formatIriShort).join(', ')}
                        </span>
                      )}
                    </div>
                  )}

                  {p.characteristics.length > 0 && (
                    <div className="property-characteristics">
                      {p.characteristics.map((char) => (
                        <span key={char} className="char-badge">
                          {char}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default PropertyBrowser
