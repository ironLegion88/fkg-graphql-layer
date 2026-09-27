import React, { useState } from 'react'
import {
  FolderTree,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Tag,
  AlertCircle,
  Equal,
  Sliders,
  Users,
  Maximize2,
} from 'lucide-react'
import type { ClassInfo } from '../interfaces/models'
import './ClassInspector.css'

export interface ClassInspectorProps {
  classInfo: ClassInfo
  onNavigate?: (iri: string) => void
  onShowInstances?: (iri: string) => void
  onShowSubclasses?: (iri: string) => void
  onExpand?: (iri: string) => void
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

export const ClassInspector: React.FC<ClassInspectorProps> = ({
  classInfo,
  onNavigate,
  onShowInstances,
  onShowSubclasses,
  onExpand,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showAncestors, setShowAncestors] = useState(false)
  const [showDescendants, setShowDescendants] = useState(false)

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => {
      setCopiedKey(null)
    }, 1500)
  }

  const displayCompactIri = classInfo.compact_iri?.prefix
    ? `${classInfo.compact_iri.prefix}:${classInfo.compact_iri.local_name}`
    : classInfo.compact_iri?.local_name || compactIri(classInfo.iri)

  return (
    <div className="class-inspector" data-testid="class-inspector">
      {/* Header */}
      <div className="class-header">
        <div className="class-header-top">
          <span className="class-badge">
            <FolderTree size={12} aria-hidden="true" />
            <span>OWL Class</span>
          </span>

          <span
            className="instance-counter-badge"
            title={`${classInfo.instance_count} asserted or inferred instances`}
          >
            <Users size={12} aria-hidden="true" />
            <span>{classInfo.instance_count} instances</span>
          </span>
        </div>

        <h3 className="class-title">{classInfo.label || displayCompactIri}</h3>

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
        <div className="iri-box" title={`Full IRI: ${classInfo.iri}`}>
          <span className="iri-text">{classInfo.iri}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={() => handleCopy(classInfo.iri, 'full')}
            title="Copy full IRI"
            aria-label="Copy full IRI"
          >
            {copiedKey === 'full' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Quick Action Toolbar */}
        <div className="class-actions-bar">
          {onShowInstances && (
            <button
              type="button"
              className="action-btn-primary"
              onClick={() => onShowInstances(classInfo.iri)}
              title="Show instances of this class"
              aria-label={`Show instances of ${classInfo.label}`}
            >
              <Users size={12} aria-hidden="true" />
              <span>Show Instances ({classInfo.instance_count})</span>
            </button>
          )}
          {onExpand && (
            <button
              type="button"
              className="action-btn-small"
              onClick={() => onExpand(classInfo.iri)}
              title="Expand in graph canvas"
              aria-label={`Expand ${classInfo.label} in graph`}
            >
              <Maximize2 size={12} aria-hidden="true" />
              <span>Expand</span>
            </button>
          )}
          {classInfo.direct_children.length > 0 && onShowSubclasses && (
            <button
              type="button"
              className="action-btn-small"
              onClick={() => onShowSubclasses(classInfo.iri)}
              title="Show subclasses in class tree"
              aria-label={`Show subclasses for ${classInfo.label}`}
            >
              <FolderTree size={12} aria-hidden="true" />
              <span>Show Subclasses</span>
            </button>
          )}
        </div>
      </div>

      {/* Class Hierarchy Section */}
      <div className="class-section">
        <span className="section-label">
          <FolderTree size={13} aria-hidden="true" />
          <span>Class Hierarchy</span>
        </span>

        {/* Superclasses / Parents */}
        <div className="hierarchy-group">
          <span className="hierarchy-label">
            Superclasses ({classInfo.direct_parents.length})
          </span>
          {classInfo.direct_parents.length === 0 ? (
            <p className="empty-muted-text">Root class (no declared parents)</p>
          ) : (
            <div className="hierarchy-list" aria-label="Superclasses">
              {classInfo.direct_parents.map((parentIri) => (
                <button
                  key={parentIri}
                  type="button"
                  className="hierarchy-pill"
                  onClick={() => onNavigate?.(parentIri)}
                  title={`Navigate to parent: ${parentIri}`}
                >
                  <span className="hierarchy-pill-name">{compactIri(parentIri)}</span>
                  <span className="hierarchy-pill-iri">{parentIri}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {classInfo.all_ancestors.length > classInfo.direct_parents.length && (
            <div>
              <span
                role="button"
                tabIndex={0}
                className="details-toggle"
                onClick={() => setShowAncestors((prev) => !prev)}
                onKeyDown={(e) => e.key === 'Enter' && setShowAncestors((prev) => !prev)}
              >
                {showAncestors ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>
                  {showAncestors ? 'Hide all ancestors' : `View all ${classInfo.all_ancestors.length} ancestors`}
                </span>
              </span>
              {showAncestors && (
                <div className="ancestors-box">
                  {classInfo.all_ancestors.map((ancIri) => (
                    <button
                      key={ancIri}
                      type="button"
                      className="ancestor-chip"
                      onClick={() => onNavigate?.(ancIri)}
                      title={ancIri}
                    >
                      {compactIri(ancIri)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subclasses / Children */}
        <div className="hierarchy-group" style={{ marginTop: 8 }}>
          <span className="hierarchy-label">
            Direct Subclasses ({classInfo.direct_children.length})
          </span>
          {classInfo.direct_children.length === 0 ? (
            <p className="empty-muted-text">Leaf class (no direct subclasses)</p>
          ) : (
            <div className="hierarchy-list" aria-label="Subclasses">
              {classInfo.direct_children.map((childIri) => (
                <button
                  key={childIri}
                  type="button"
                  className="hierarchy-pill"
                  onClick={() => onNavigate?.(childIri)}
                  title={`Navigate to subclass: ${childIri}`}
                >
                  <span className="hierarchy-pill-name">{compactIri(childIri)}</span>
                  <span className="hierarchy-pill-iri">{childIri}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {classInfo.all_descendants.length > classInfo.direct_children.length && (
            <div>
              <span
                role="button"
                tabIndex={0}
                className="details-toggle"
                onClick={() => setShowDescendants((prev) => !prev)}
                onKeyDown={(e) => e.key === 'Enter' && setShowDescendants((prev) => !prev)}
              >
                {showDescendants ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>
                  {showDescendants
                    ? 'Hide all descendants'
                    : `View all ${classInfo.all_descendants.length} descendants`}
                </span>
              </span>
              {showDescendants && (
                <div className="ancestors-box">
                  {classInfo.all_descendants.map((descIri) => (
                    <button
                      key={descIri}
                      type="button"
                      className="ancestor-chip"
                      onClick={() => onNavigate?.(descIri)}
                      title={descIri}
                    >
                      {compactIri(descIri)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Semantic Axioms: Equivalent and Disjoint Classes */}
      <div className="class-section">
        <span className="section-label">
          <Equal size={13} aria-hidden="true" />
          <span>Semantic Axioms</span>
        </span>

        {/* Equivalent Classes */}
        <div className="semantic-relation-card equivalent">
          <span className="hierarchy-label">
            Equivalent Classes ({classInfo.equivalent_classes.length})
          </span>
          {classInfo.equivalent_classes.length === 0 ? (
            <p className="empty-muted-text">No equivalent classes defined.</p>
          ) : (
            <div className="hierarchy-list">
              {classInfo.equivalent_classes.map((eqIri) => (
                <button
                  key={eqIri}
                  type="button"
                  className="hierarchy-pill"
                  onClick={() => onNavigate?.(eqIri)}
                  title={`Navigate to ${eqIri}`}
                >
                  <span className="hierarchy-pill-name">{compactIri(eqIri)}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Disjoint Classes */}
        <div className="semantic-relation-card disjoint">
          <span className="hierarchy-label">
            Disjoint Classes ({classInfo.disjoint_classes.length})
          </span>
          {classInfo.disjoint_classes.length === 0 ? (
            <p className="empty-muted-text">No disjoint classes asserted.</p>
          ) : (
            <div className="hierarchy-list">
              {classInfo.disjoint_classes.map((disjIri) => (
                <button
                  key={disjIri}
                  type="button"
                  className="hierarchy-pill"
                  onClick={() => onNavigate?.(disjIri)}
                  title={`Disjoint with ${disjIri}`}
                >
                  <span className="hierarchy-pill-name">{compactIri(disjIri)}</span>
                  <AlertCircle size={12} className="text-warning" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Class Expressions & Restrictions */}
      <div className="class-section">
        <span className="section-label">
          <Sliders size={13} aria-hidden="true" />
          <span>Restrictions & Expressions ({classInfo.restrictions.length})</span>
        </span>

        {classInfo.restrictions.length === 0 ? (
          <p className="empty-muted-text">No OWL restrictions recorded for this class.</p>
        ) : (
          <div className="restrictions-list">
            {classInfo.restrictions.map((expr, idx) => (
              <div key={`${expr}-${idx}`} className="restriction-item">
                <span className="restriction-tag">Restriction</span>
                <span>{expr}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annotations */}
      {classInfo.annotations.length > 0 && (
        <div className="class-section">
          <span className="section-label">
            <Tag size={13} aria-hidden="true" />
            <span>Annotations ({classInfo.annotations.length})</span>
          </span>
          <table className="annotations-table" aria-label="Class annotations">
            <tbody>
              {classInfo.annotations.map((ann, idx) => (
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

export default ClassInspector
