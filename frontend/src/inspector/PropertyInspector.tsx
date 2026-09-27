import React, { useState } from 'react'
import {
  Binary,
  ExternalLink,
  Copy,
  Check,
  Tag,
  ArrowRightLeft,
  Sparkles,
  Database,
  Layers,
  Maximize2,
  Filter,
} from 'lucide-react'
import type { PropertyInfo } from '../interfaces/models'
import './PropertyInspector.css'

export interface PropertyInspectorProps {
  propertyInfo: PropertyInfo
  onNavigate?: (iri: string) => void
  onExpand?: (iri: string) => void
  onFilterByProperty?: (iri: string) => void
}

function compactIri(iri: string): string {
  try {
    if (iri.includes('#')) {
      const parts = iri.split('#')
      return parts[1] || iri
    }
    const lastSlash = iri.lastIndexOf('/')
    if (lastSlash >= 0 && lastSlash < iri.length - 1) {
      return iri.slice(lastSlash + 1)
    }
  } catch {
    // fallback
  }
  return iri
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  propertyInfo,
  onNavigate,
  onExpand,
  onFilterByProperty,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 1500)
  }

  const displayCompactIri = propertyInfo.compact_iri?.prefix
    ? `${propertyInfo.compact_iri.prefix}:${propertyInfo.compact_iri.local_name}`
    : propertyInfo.compact_iri?.local_name || compactIri(propertyInfo.iri)

  const normalizedKind = propertyInfo.property_kind.toLowerCase()

  return (
    <div className="property-inspector" data-testid="property-inspector">
      {/* Header */}
      <div className="property-header">
        <div className="property-header-top">
          <span
            className={`property-kind-badge ${normalizedKind}`}
            title={`Property Kind: ${propertyInfo.property_kind}`}
          >
            <Binary size={12} aria-hidden="true" />
            <span>{propertyInfo.property_kind}</span>
          </span>

          <span
            className="usage-counter-badge"
            title={`${propertyInfo.usage_count} occurrences in RDF knowledge base`}
          >
            <Database size={12} aria-hidden="true" />
            <span>{propertyInfo.usage_count} uses</span>
          </span>
        </div>

        <h3 className="property-title">{propertyInfo.label || displayCompactIri}</h3>

        {/* Compact IRI */}
        <div className="iri-box" title={`Compact IRI: ${displayCompactIri}`}>
          <span className="iri-text">{displayCompactIri}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(displayCompactIri, 'compact')}
            title="Copy compact IRI"
            aria-label="Copy compact IRI"
          >
            {copiedKey === 'compact' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Full IRI */}
        <div className="iri-box" title={`Full IRI: ${propertyInfo.iri}`}>
          <span className="iri-text">{propertyInfo.iri}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(propertyInfo.iri, 'full')}
            title="Copy full IRI"
            aria-label="Copy full IRI"
          >
            {copiedKey === 'full' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Quick Action Toolbar */}
        <div className="class-actions-bar">
          {onExpand && (
            <button
              type="button"
              className="action-btn-small"
              onClick={() => onExpand(propertyInfo.iri)}
              title="Expand property node in graph"
              aria-label={`Expand ${propertyInfo.label} in graph`}
            >
              <Maximize2 size={12} aria-hidden="true" />
              <span>Expand Node</span>
            </button>
          )}
          {onFilterByProperty && (
            <button
              type="button"
              className="action-btn-small"
              onClick={() => onFilterByProperty(propertyInfo.iri)}
              title="Filter graph traversal to this property"
              aria-label={`Filter by ${propertyInfo.label}`}
            >
              <Filter size={12} aria-hidden="true" />
              <span>Filter by Predicate</span>
            </button>
          )}
        </div>
      </div>

      {/* Domain and Range Section */}
      <div className="property-section">
        <span className="section-label">
          <Layers size={13} aria-hidden="true" />
          <span>Domain & Range Signature</span>
        </span>

        <div className="domain-range-grid">
          {/* Domain */}
          <div className="domain-range-card domain-card">
            <span className="dr-label">Domain ({propertyInfo.domains.length})</span>
            {propertyInfo.domains.length === 0 ? (
              <p className="empty-muted-text">Unconstrained (any resource)</p>
            ) : (
              <div className="dr-items-list" aria-label="Domain Classes">
                {propertyInfo.domains.map((domIri) => (
                  <button
                    key={domIri}
                    type="button"
                    className="dr-pill"
                    onClick={() => onNavigate?.(domIri)}
                    title={`Navigate to domain class: ${domIri}`}
                  >
                    <span className="dr-pill-name">{compactIri(domIri)}</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Range */}
          <div className="domain-range-card range-card">
            <span className="dr-label">Range ({propertyInfo.ranges.length})</span>
            {propertyInfo.ranges.length === 0 ? (
              <p className="empty-muted-text">Unconstrained (any value/literal)</p>
            ) : (
              <div className="dr-items-list" aria-label="Range Types">
                {propertyInfo.ranges.map((rngIri) => (
                  <button
                    key={rngIri}
                    type="button"
                    className="dr-pill"
                    onClick={() => onNavigate?.(rngIri)}
                    title={`Navigate to range: ${rngIri}`}
                  >
                    <span className="dr-pill-name">{compactIri(rngIri)}</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logical Characteristics */}
      <div className="property-section">
        <span className="section-label">
          <Sparkles size={13} aria-hidden="true" />
          <span>Logical Characteristics ({propertyInfo.characteristics.length})</span>
        </span>

        {propertyInfo.characteristics.length === 0 ? (
          <p className="empty-muted-text">No special characteristics asserted.</p>
        ) : (
          <div className="characteristics-wrap" aria-label="Property characteristics">
            {propertyInfo.characteristics.map((char) => (
              <span key={char} className="characteristic-chip" title={`OWL Axiom: ${char}`}>
                <span>{char}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inverse Property */}
      {propertyInfo.inverse_of && (
        <div className="property-section">
          <span className="section-label">
            <ArrowRightLeft size={13} aria-hidden="true" />
            <span>Inverse Property</span>
          </span>
          <button
            type="button"
            className="inverse-card"
            onClick={() => onNavigate?.(propertyInfo.inverse_of!)}
            title={`Navigate to inverse property: ${propertyInfo.inverse_of}`}
          >
            <span className="inverse-title">{compactIri(propertyInfo.inverse_of)}</span>
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Sub and Super Properties */}
      {((propertyInfo.super_properties && propertyInfo.super_properties.length > 0) ||
        (propertyInfo.sub_properties && propertyInfo.sub_properties.length > 0)) && (
        <div className="property-section">
          <span className="section-label">
            <Layers size={13} aria-hidden="true" />
            <span>Property Hierarchy</span>
          </span>

          {propertyInfo.super_properties && propertyInfo.super_properties.length > 0 && (
            <div className="dr-items-list" style={{ marginBottom: 6 }}>
              <span className="hierarchy-label">Super-properties</span>
              {propertyInfo.super_properties.map((superIri) => (
                <button
                  key={superIri}
                  type="button"
                  className="dr-pill"
                  onClick={() => onNavigate?.(superIri)}
                  title={`Navigate to super-property: ${superIri}`}
                >
                  <span className="dr-pill-name">{compactIri(superIri)}</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {propertyInfo.sub_properties && propertyInfo.sub_properties.length > 0 && (
            <div className="dr-items-list">
              <span className="hierarchy-label">Sub-properties</span>
              {propertyInfo.sub_properties.map((subIri) => (
                <button
                  key={subIri}
                  type="button"
                  className="dr-pill"
                  onClick={() => onNavigate?.(subIri)}
                  title={`Navigate to sub-property: ${subIri}`}
                >
                  <span className="dr-pill-name">{compactIri(subIri)}</span>
                  <ExternalLink size={11} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Annotations */}
      {propertyInfo.annotations.length > 0 && (
        <div className="property-section">
          <span className="section-label">
            <Tag size={13} aria-hidden="true" />
            <span>Annotations ({propertyInfo.annotations.length})</span>
          </span>
          <table className="annotations-table" aria-label="Property annotations">
            <tbody>
              {propertyInfo.annotations.map((ann, idx) => (
                <tr key={`${ann.predicate_iri}-${idx}`}>
                  <td className="annotation-key">{compactIri(ann.predicate_iri)}</td>
                  <td className="annotation-val">
                    {ann.value}
                    {ann.language && (
                      <span className="lang-tag" style={{ marginLeft: 6 }}>
                        @{ann.language}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default PropertyInspector
