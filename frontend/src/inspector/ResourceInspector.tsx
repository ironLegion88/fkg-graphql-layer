import React, { useState } from 'react'
import {
  Copy,
  Check,
  CheckCircle2,
  Sparkles,
  Layers,
  Globe,
  Tag,
  ExternalLink,
  Image as ImageIcon,
  FolderTree,
  Binary,
  Maximize2,
  Database,
} from 'lucide-react'
import type { ResourceMetadata } from '../interfaces/models'
import './ResourceInspector.css'

export interface ResourceInspectorProps {
  metadata: ResourceMetadata
  onNavigate?: (iri: string) => void
  onExpand?: (iri: string) => void
  onInspectClass?: (iri: string) => void
  onInspectProperty?: (iri: string) => void
  traversalControls?: React.ReactNode
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

function findImageUri(metadata: ResourceMetadata): string | null {
  for (const ann of metadata.annotations) {
    const pred = ann.predicate_iri.toLowerCase()
    const val = ann.value.toLowerCase()
    if (
      pred.includes('depiction') ||
      pred.includes('image') ||
      pred.includes('thumbnail') ||
      pred.includes('logo') ||
      val.endsWith('.jpg') ||
      val.endsWith('.jpeg') ||
      val.endsWith('.png') ||
      val.endsWith('.svg') ||
      val.endsWith('.webp')
    ) {
      return ann.value
    }
  }
  return null
}

export const ResourceInspector: React.FC<ResourceInspectorProps> = ({
  metadata,
  onNavigate,
  onExpand,
  onInspectClass,
  onInspectProperty,
  traversalControls,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 1500)
  }

  const isClass =
    metadata.semantic_kind.toLowerCase() === 'class' ||
    metadata.asserted_types.some((t) => t.toLowerCase().includes('class'))

  const isProperty =
    metadata.semantic_kind.toLowerCase().includes('property') ||
    metadata.asserted_types.some((t) => t.toLowerCase().includes('property'))

  const imageUri = findImageUri(metadata)
  const displayCompactIri = metadata.compact_iri?.prefix
    ? `${metadata.compact_iri.prefix}:${metadata.compact_iri.local_name}`
    : metadata.compact_iri?.local_name || compactIri(metadata.iri)

  return (
    <div className="resource-inspector" data-testid="resource-inspector">
      {/* Header with Title, Badges, and Quick Actions */}
      <div className="resource-header">
        <div className="resource-header-top">
          <span
            className={`resource-kind-badge ${metadata.semantic_kind.toLowerCase()}`}
            title={`Semantic Kind: ${metadata.semantic_kind}`}
          >
            <Tag size={12} aria-hidden="true" />
            <span>{metadata.semantic_kind}</span>
          </span>

          <div className="resource-actions-bar">
            {onExpand && (
              <button
                type="button"
                className="action-btn-small"
                onClick={() => onExpand(metadata.iri)}
                title="Expand relationships in canvas"
                aria-label={`Expand ${metadata.preferred_label} in graph`}
              >
                <Maximize2 size={12} aria-hidden="true" />
                <span>Expand</span>
              </button>
            )}
            {isClass && onInspectClass && (
              <button
                type="button"
                className="action-btn-small"
                onClick={() => onInspectClass(metadata.iri)}
                title="View in Class Inspector"
                aria-label={`View class hierarchy for ${metadata.preferred_label}`}
              >
                <FolderTree size={12} aria-hidden="true" />
                <span>Class View</span>
              </button>
            )}
            {isProperty && onInspectProperty && (
              <button
                type="button"
                className="action-btn-small"
                onClick={() => onInspectProperty(metadata.iri)}
                title="View in Property Inspector"
                aria-label={`View property details for ${metadata.preferred_label}`}
              >
                <Binary size={12} aria-hidden="true" />
                <span>Property View</span>
              </button>
            )}
          </div>
        </div>

        <h3 className="resource-title">{metadata.preferred_label}</h3>

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

        {/* Canonical Full IRI */}
        <div className="iri-box" title={`Full IRI: ${metadata.iri}`}>
          <span className="iri-text">{metadata.iri}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(metadata.iri, 'full')}
            title="Copy full IRI"
            aria-label="Copy full IRI"
          >
            {copiedKey === 'full' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Optional Resource Image */}
      {imageUri && !imageError && (
        <div className="resource-section">
          <span className="section-label">
            <ImageIcon size={13} aria-hidden="true" />
            <span>Depiction</span>
          </span>
          <div className="resource-image-card">
            <img
              src={imageUri}
              alt={metadata.preferred_label}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* Asserted vs Inferred Types (AC-106 Non-Color Cues) */}
      <div className="resource-section">
        <span className="section-label">
          <Layers size={13} aria-hidden="true" />
          <span>Types & Classification</span>
        </span>

        <div className="types-container" aria-label="Resource Types">
          {metadata.asserted_types.length === 0 && metadata.inferred_types.length === 0 && (
            <p className="empty-muted-text">No type assertions recorded.</p>
          )}

          {/* Asserted Types: Solid border, Check icon, Text label */}
          {metadata.asserted_types.map((typeIri) => (
            <div
              key={`asserted-${typeIri}`}
              className="type-row asserted-row"
              data-testid="asserted-type"
            >
              <span className="type-cue asserted">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>Asserted Type</span>
              </span>
              <button
                type="button"
                className="iri-link"
                onClick={() => onNavigate?.(typeIri)}
                title={`Navigate to ${typeIri}`}
              >
                <span>{compactIri(typeIri)}</span>
                <ExternalLink size={11} aria-hidden="true" />
              </button>
            </div>
          ))}

          {/* Inferred Types: Dashed border, Sparkles icon, Text label */}
          {metadata.inferred_types.map((typeIri) => (
            <div
              key={`inferred-${typeIri}`}
              className="type-row inferred-row"
              data-testid="inferred-type"
            >
              <span className="type-cue inferred">
                <Sparkles size={13} aria-hidden="true" />
                <span>Inferred Type</span>
              </span>
              <button
                type="button"
                className="iri-link"
                onClick={() => onNavigate?.(typeIri)}
                title={`Navigate to ${typeIri}`}
              >
                <span>{compactIri(typeIri)}</span>
                <ExternalLink size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Multilingual Labels */}
      {metadata.labels.length > 0 && (
        <div className="resource-section">
          <span className="section-label">
            <Globe size={13} aria-hidden="true" />
            <span>Multilingual Labels ({metadata.labels.length})</span>
          </span>
          <div className="multilingual-list">
            {metadata.labels.map((label, idx) => (
              <div key={`${label.value}-${label.language || 'none'}-${idx}`} className="multilingual-item">
                <span className="lang-tag">@{label.language || 'und'}</span>
                <span className="multilingual-val">{label.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multilingual Descriptions */}
      {metadata.descriptions.length > 0 && (
        <div className="resource-section">
          <span className="section-label">
            <Globe size={13} aria-hidden="true" />
            <span>Descriptions</span>
          </span>
          <div className="multilingual-list">
            {metadata.descriptions.map((desc, idx) => (
              <div key={`${desc.language || 'none'}-${idx}`} className="multilingual-item">
                <span className="lang-tag">@{desc.language || 'und'}</span>
                <span className="multilingual-val">{desc.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Annotations & Typed Values */}
      {metadata.annotations.length > 0 && (
        <div className="resource-section">
          <span className="section-label">
            <Tag size={13} aria-hidden="true" />
            <span>Annotations ({metadata.annotations.length})</span>
          </span>
          <table className="annotations-table" aria-label="Annotations table">
            <tbody>
              {metadata.annotations.map((ann, idx) => (
                <tr key={`${ann.predicate_iri}-${idx}`}>
                  <td className="annotation-key" title={ann.predicate_iri}>
                    {compactIri(ann.predicate_iri)}
                  </td>
                  <td className="annotation-val">
                    {ann.value}
                    {ann.language && <span className="lang-tag" style={{ marginLeft: 6 }}>@{ann.language}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provenance & Store Metadata */}
      <div className="resource-section">
        <span className="section-label">
          <Database size={13} aria-hidden="true" />
          <span>Provenance & Build</span>
        </span>
        <div className="meta-chips-row">
          {metadata.build_id && (
            <span className="meta-chip" title={`Store Build: ${metadata.build_id}`}>
              <Layers size={11} aria-hidden="true" />
              <span>build:{metadata.build_id.slice(0, 10)}</span>
            </span>
          )}
          {metadata.source_graphs.map((graph) => (
            <span key={graph} className="meta-chip" title={`Source Graph: ${graph}`}>
              <Database size={11} aria-hidden="true" />
              <span>{compactIri(graph)}</span>
            </span>
          ))}
          {metadata.source_graphs.length === 0 && !metadata.build_id && (
            <span className="empty-muted-text">Default store graph</span>
          )}
        </div>
      </div>

      {traversalControls && (
        <div className="resource-section" style={{ marginTop: 8 }}>
          {traversalControls}
        </div>
      )}
    </div>
  )
}

export default ResourceInspector
