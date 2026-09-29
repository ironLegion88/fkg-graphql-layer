import React, { useEffect, useState, useRef } from 'react'
import {
  HelpCircle,
  X,
  Zap,
  Info,
  Cpu,
  FileText,
  RotateCw,
  LoaderCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import type { GraphRelationship, ExplanationResult } from '../interfaces/models'
import { getExplanation } from '../api/graph'
import { HierarchyTreeView } from '../views/HierarchyTreeView'
import { buildProofTree } from '../views/treeBuilders'
import './ExplanationPanel.css'

export interface ExplanationPanelProps {
  isOpen: boolean
  handle: string | null
  relationship?: GraphRelationship | null
  onClose: () => void
  onNavigate?: (iri: string) => void
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  isOpen,
  handle,
  relationship,
  onClose,
  onNavigate,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<ExplanationResult | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !handle) {
      setExplanation(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)
    setError(null)

    getExplanation(handle)
      .then((res) => {
        if (isMounted) {
          setExplanation(res)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve inference explanation.')
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, handle])

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleRetry = () => {
    if (!handle) return
    setIsLoading(true)
    setError(null)
    getExplanation(handle)
      .then((res) => {
        setExplanation(res)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to retrieve inference explanation.')
        setIsLoading(false)
      })
  }

  return (
    <div
      className="explanation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explanation-dialog-title"
      data-testid="explanation-panel"
    >
      <div className="explanation-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="explanation-slideover" ref={panelRef}>
        {/* Header */}
        <div className="explanation-header">
          <div className="header-title-box">
            <HelpCircle size={20} className="header-icon text-accent" aria-hidden="true" />
            <div>
              <h3 id="explanation-dialog-title" className="explanation-title">
                Inference Justification
              </h3>
              <p className="explanation-subtitle">Proof trace for inferred relationship (UW-006, GQ-112)</p>
            </div>
          </div>
          <button
            type="button"
            className="explanation-close-btn"
            onClick={onClose}
            aria-label="Close explanation panel"
            title="Close explanation panel (Escape)"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Fact Summary Card */}
        {relationship && (
          <div className="fact-summary-card">
            <div className="fact-badge-row">
              <span className="inferred-badge">
                <Zap size={12} aria-hidden="true" />
                <span>Inferred Fact</span>
              </span>
              {relationship.source_graph && (
                <span className="source-graph-badge" title={relationship.source_graph}>
                  {relationship.source_graph.includes('#')
                    ? relationship.source_graph.split('#')[1]
                    : relationship.source_graph.split('/').pop() || relationship.source_graph}
                </span>
              )}
            </div>

            <div className="fact-statement">
              <button
                type="button"
                className="entity-link"
                onClick={() => onNavigate?.(relationship.source.id)}
                title={`Inspect source entity ${relationship.source.label || relationship.source.id}`}
              >
                {relationship.source.label || relationship.source.id}
              </button>
              <span className="predicate-pill">
                —[{relationship.predicate_label || relationship.relation}]→
              </span>
              <button
                type="button"
                className="entity-link"
                onClick={() => onNavigate?.(relationship.target.id)}
                title={`Inspect target entity ${relationship.target.label || relationship.target.id}`}
              >
                {relationship.target.label || relationship.target.id}
              </button>
            </div>

            {handle && (
              <p className="handle-text">
                <strong>Handle:</strong> <code>{handle}</code>
              </p>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="explanation-body">
          {isLoading && (
            <div className="explanation-loading" aria-live="polite">
              <LoaderCircle size={32} className="spin text-accent" />
              <h4>Retrieving Proof Trace...</h4>
              <p>Fetching derivation axioms and justification tree from the reasoning engine.</p>
            </div>
          )}

          {error && (
            <div className="explanation-error-card" role="alert">
              <ShieldAlert size={24} className="text-danger" aria-hidden="true" />
              <h4>Explanation Retrieval Failed</h4>
              <p>{error}</p>
              <button type="button" className="retry-btn" onClick={handleRetry}>
                <RotateCw size={14} />
                <span>Retry Query</span>
              </button>
            </div>
          )}

          {!isLoading && !error && explanation && (
            <>
              {explanation.available ? (
                /* Available Proof Steps */
                <div className="proof-available-view" data-testid="proof-available">
                  <div className="proof-meta-banner">
                    <Cpu size={16} aria-hidden="true" />
                    <span>
                      Reasoner: <strong>{explanation.reasoner || 'Configured OWL 2 DL Reasoner'}</strong>
                    </span>
                  </div>

                  <div className="proof-steps-container">
                    <h4 className="proof-heading">
                      <FileText size={16} aria-hidden="true" />
                      <span>Deduction Steps ({explanation.proof_steps.length})</span>
                    </h4>
                    <HierarchyTreeView
                      nodes={buildProofTree(explanation.proof_steps)}
                    />
                  </div>
                </div>
              ) : (
                /* Unavailable Explanation Message */
                <div className="proof-unavailable-card" data-testid="proof-unavailable">
                  <Info size={28} className="info-icon" aria-hidden="true" />
                  <h4>Explanation Not Available</h4>
                  <p className="unavailable-message">
                    {explanation.message ||
                      'Explanation service is not yet available. The inference was produced by the configured reasoner.'}
                  </p>

                  <div className="reasoner-details-box">
                    <div className="detail-row">
                      <span className="detail-label">Status:</span>
                      <span className="status-badge unavailable">UNAVAILABLE</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Reasoning Engine:</span>
                      <span>{explanation.reasoner || 'Offline HermiT Reasoner (Build Materialized)'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Inference Model:</span>
                      <span>Materialized entailment via TBox classification and property axioms.</span>
                    </div>
                  </div>

                  <p className="unavailable-help-copy">
                    Proof explanations will become available when the online explanation service
                    is connected to the HermiT justification extraction pipeline.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExplanationPanel
