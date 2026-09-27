import React, { useState } from 'react'
import {
  CheckCircle2,
  Sparkles,
  Database,
  Layers,
  Cpu,
  HelpCircle,
  ExternalLink,
  GitBranch,
} from 'lucide-react'
import type { GraphRelationship } from '../interfaces/models'
import './ProvenancePanel.css'

export interface ProvenancePanelProps {
  selectedRelationship?: GraphRelationship | null
  relationships?: GraphRelationship[]
  onSelectRelationship?: (rel: GraphRelationship) => void
  onWhyClick?: (handle: string) => void
  onNavigate?: (iri: string) => void
  activeBuildId?: string | null
  reasonerName?: string | null
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

export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  selectedRelationship,
  relationships = [],
  onSelectRelationship,
  onWhyClick,
  onNavigate,
  activeBuildId,
  reasonerName,
}) => {
  // If no relationship explicitly selected, default to first available
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0)

  const activeRel =
    selectedRelationship ||
    (relationships.length > 0 ? relationships[internalSelectedIndex] || relationships[0] : null)

  if (!activeRel) {
    return (
      <div className="provenance-panel" data-testid="provenance-panel-empty">
        <div className="provenance-header">
          <p className="eyebrow">Provenance</p>
          <h3 className="provenance-title">Fact Lineage & Inferences</h3>
        </div>
        <div className="detail-empty" style={{ padding: 24, textAlign: 'center' }}>
          <GitBranch size={32} style={{ color: '#8fa59d', margin: '0 auto 10px' }} />
          <p className="empty-copy">
            Select a relationship or connected entity to inspect its source graph, assertion state,
            and inference provenance.
          </p>
        </div>
      </div>
    )
  }

  const isInferred = activeRel.is_inferred
  const sourceGraph = activeRel.source_graph || 'urn:fkg:graph:asserted'
  const predicateIri = activeRel.predicate_iri || activeRel.relation
  const predicateDisplay = activeRel.predicate_label || activeRel.relation

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10)
    setInternalSelectedIndex(idx)
    if (relationships[idx] && onSelectRelationship) {
      onSelectRelationship(relationships[idx])
    }
  }

  return (
    <div className="provenance-panel" data-testid="provenance-panel">
      {/* Header */}
      <div className="provenance-header">
        <p className="eyebrow">Provenance</p>
        <h3 className="provenance-title">Fact Lineage & Inferences</h3>
      </div>

      {/* Selector if multiple relationships exist */}
      {relationships.length > 1 && (
        <div className="fact-selector-box">
          <label htmlFor="provenance-rel-select" className="section-label">
            <span>Select Visible Relationship ({relationships.length})</span>
          </label>
          <select
            id="provenance-rel-select"
            className="fact-select"
            value={internalSelectedIndex}
            onChange={handleSelectChange}
            aria-label="Select visible relationship to inspect provenance"
          >
            {relationships.map((rel, idx) => (
              <option key={`${rel.source.id}-${rel.relation}-${rel.target.id}-${idx}`} value={idx}>
                {rel.source.label} --[{rel.predicate_label || rel.relation}]--&gt; {rel.target.label}
                {rel.is_inferred ? ' [Inferred]' : ' [Asserted]'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Non-Color Cues for Inference Status (AC-106, GE-010) */}
      <div
        className={`provenance-status-card ${isInferred ? 'inferred' : 'asserted'}`}
        data-testid={isInferred ? 'provenance-inferred' : 'provenance-asserted'}
      >
        {isInferred ? (
          <Sparkles size={22} className="prov-icon" aria-hidden="true" />
        ) : (
          <CheckCircle2 size={22} className="prov-icon" aria-hidden="true" />
        )}
        <div className="prov-status-details">
          <h4>{isInferred ? 'Inferred Fact (Derived Semantic)' : 'Asserted Fact (Direct Axiom)'}</h4>
          <p>
            {isInferred
              ? `Derived by ${reasonerName || 'reasoner'} during ontology classification. Verified consistent.`
              : 'Explicitly asserted in the source ontology file or dataset.'}
          </p>
        </div>
      </div>

      {/* Triple Component Details */}
      <div className="triple-summary-card">
        {/* Subject */}
        <div className="triple-component">
          <span className="component-role">Subject</span>
          <button
            type="button"
            className="component-btn"
            onClick={() => onNavigate?.(activeRel.source.id)}
            title={`Navigate to subject: ${activeRel.source.id}`}
          >
            <span>{activeRel.source.label}</span>
            <ExternalLink size={11} aria-hidden="true" />
          </button>
          <span className="component-iri">{activeRel.source.id}</span>
        </div>

        {/* Predicate */}
        <div className="predicate-arrow">
          <span title={predicateIri}>--[ {predicateDisplay} ]--&gt;</span>
        </div>

        {/* Object */}
        <div className="triple-component">
          <span className="component-role">Object</span>
          <button
            type="button"
            className="component-btn"
            onClick={() => onNavigate?.(activeRel.target.id)}
            title={`Navigate to object: ${activeRel.target.id}`}
          >
            <span>{activeRel.target.label}</span>
            <ExternalLink size={11} aria-hidden="true" />
          </button>
          <span className="component-iri">{activeRel.target.id}</span>
        </div>
      </div>

      {/* Lineage & Storage Details */}
      <div className="lineage-card">
        <div className="lineage-row">
          <span className="lineage-key">
            <Database size={13} aria-hidden="true" />
            <span>Source Graph:</span>
          </span>
          <span className="lineage-val" title={sourceGraph}>
            {compactIri(sourceGraph)}
          </span>
        </div>

        <div className="lineage-row">
          <span className="lineage-key">
            <Layers size={13} aria-hidden="true" />
            <span>Store Build ID:</span>
          </span>
          <span className="lineage-val">
            {activeBuildId ? `bld:${activeBuildId.slice(0, 10)}` : 'active'}
          </span>
        </div>

        <div className="lineage-row">
          <span className="lineage-key">
            <Cpu size={13} aria-hidden="true" />
            <span>Inference Engine:</span>
          </span>
          <span className="lineage-val">
            {isInferred ? reasonerName || 'HermiT 1.4.3' : 'N/A (Asserted)'}
          </span>
        </div>
      </div>

      {/* "Why?" Explanation Action (GE-011, Batch 2E integration) */}
      <div className="why-action-box">
        {isInferred ? (
          <>
            <button
              type="button"
              className="why-btn"
              onClick={() => {
                if (activeRel.explanation_handle && onWhyClick) {
                  onWhyClick(activeRel.explanation_handle)
                }
              }}
              title="Open justification proof for this inferred fact"
              aria-label="Why is this fact inferred? View proof justification"
            >
              <HelpCircle size={15} aria-hidden="true" />
              <span>Why is this inferred? (View Proof)</span>
            </button>
            <p className="why-explainer-copy">
              {activeRel.explanation_handle
                ? `Explanation handle: ${activeRel.explanation_handle}`
                : 'Rule-based entailment derived from ontology TBox hierarchy and property characteristics.'}
            </p>
          </>
        ) : (
          <p className="why-explainer-copy" style={{ color: '#166534' }}>
            <CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            This is an asserted fact directly declared in the ontology. No deduction proof is required.
          </p>
        )}
      </div>
    </div>
  )
}

export default ProvenancePanel
