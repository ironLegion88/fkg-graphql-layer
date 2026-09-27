import React from 'react'
import {
  AlertTriangle,
  HelpCircle,
  RotateCw,
  Cpu,
  Layers,
  CheckCircle2,
  AlertOctagon,
  ExternalLink,
  LoaderCircle,
  FileCheck,
} from 'lucide-react'
import type { BuildStatus } from '../interfaces/models'
import './ConsistencyPanel.css'

export interface ConsistencyPanelProps {
  buildStatus?: BuildStatus | null
  isLoading?: boolean
  error?: Error | null
  onRefresh?: () => void
  onNavigate?: (iri: string) => void
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

export const ConsistencyPanel: React.FC<ConsistencyPanelProps> = ({
  buildStatus,
  isLoading = false,
  error = null,
  onRefresh,
  onNavigate,
}) => {
  if (isLoading) {
    return (
      <div className="consistency-panel" data-testid="consistency-panel-loading">
        <div className="clean-status-box" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}>
          <LoaderCircle size={16} className="spin" />
          <span>Verifying active build consistency and reasoning status...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="consistency-panel" data-testid="consistency-panel-error">
        <div className="consistency-status-card inconsistent">
          <AlertTriangle size={24} className="status-icon" aria-hidden="true" />
          <div className="status-details">
            <h4>Build Status Unavailable</h4>
            <p>{error.message || 'Unable to fetch ontology build consistency data.'}</p>
          </div>
        </div>
        {onRefresh && (
          <button type="button" className="action-btn-primary" onClick={onRefresh} style={{ width: 'fit-content' }}>
            <RotateCw size={13} />
            <span>Retry Check</span>
          </button>
        )}
      </div>
    )
  }

  const isConsistent = buildStatus?.consistency.toLowerCase() === 'consistent'
  const isInconsistent = buildStatus?.consistency.toLowerCase() === 'inconsistent'

  const inferredCount = buildStatus?.inferred_count ?? 0
  const totalCount = buildStatus?.triple_count ?? 0
  const inferredRatio = totalCount > 0 ? Math.round((inferredCount / totalCount) * 100) : 0

  return (
    <div className="consistency-panel" data-testid="consistency-panel">
      {/* Header */}
      <div className="consistency-header">
        <div className="consistency-title-wrap">
          <p className="eyebrow">Verification</p>
          <h3 className="consistency-title">Ontology Build Consistency</h3>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="refresh-btn"
            onClick={onRefresh}
            title="Refresh build consistency check"
            aria-label="Refresh build consistency check"
          >
            <RotateCw size={14} />
          </button>
        )}
      </div>

      {/* Primary Consistency Card with Non-Color Cues (GE-012, AC-106) */}
      <div
        className={`consistency-status-card ${
          isConsistent ? 'consistent' : isInconsistent ? 'inconsistent' : 'unknown'
        }`}
        data-testid="consistency-status-card"
      >
        {isConsistent ? (
          <CheckCircle2 size={24} className="status-icon" aria-hidden="true" />
        ) : isInconsistent ? (
          <AlertOctagon size={24} className="status-icon" aria-hidden="true" />
        ) : (
          <HelpCircle size={24} className="status-icon" aria-hidden="true" />
        )}
        <div className="status-details">
          <h4>
            {isConsistent
              ? 'Ontology is Consistent'
              : isInconsistent
              ? 'Logical Inconsistency Detected'
              : `Status: ${buildStatus?.consistency || 'Unknown'}`}
          </h4>
          <p>
            {isConsistent
              ? `Axioms classified by ${buildStatus?.reasoner_name || 'HermiT'}. No contradictions found.`
              : isInconsistent
              ? 'Ontology contains logical contradictions. Materialized facts may be suppressed.'
              : 'Consistency evaluation has not been recorded for this build.'}
          </p>
        </div>
      </div>

      {/* Triple Metrics Grid */}
      <div className="metrics-grid" aria-label="Build Metrics">
        <div className="metric-tile">
          <span className="metric-number">{totalCount.toLocaleString()}</span>
          <span className="metric-label">Total Triples</span>
        </div>
        <div className="metric-tile">
          <span className="metric-number">{inferredCount.toLocaleString()}</span>
          <span className="metric-label">Inferred Triples ({inferredRatio}%)</span>
        </div>
      </div>

      {/* Reasoner & Profile Details */}
      <div className="consistency-section">
        <span className="section-label">
          <Cpu size={13} aria-hidden="true" />
          <span>Reasoner Configuration</span>
        </span>
        <div className="reasoning-info-card">
          <div className="info-row">
            <span className="info-key">Active Build ID:</span>
            <span className="info-val">{buildStatus?.build_id || 'unknown'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Reasoner Profile:</span>
            <span className="info-val">{buildStatus?.reasoner_name || buildStatus?.semantic_profile || 'hermit'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Reasoner Status:</span>
            <span className="info-val">{buildStatus?.reasoner_status || 'completed'}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Validation Summary:</span>
            <span className="info-val">{buildStatus?.validation_summary || 'Passed'}</span>
          </div>
        </div>
      </div>

      {/* Unsatisfiable Classes */}
      <div className="consistency-section">
        <span className="section-label">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>Unsatisfiable Classes ({buildStatus?.unsatisfiable_classes.length || 0})</span>
        </span>

        {(!buildStatus?.unsatisfiable_classes || buildStatus.unsatisfiable_classes.length === 0) ? (
          <div className="clean-status-box" data-testid="no-unsatisfiable-classes">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>All classes are satisfiable (0 unsatisfiable classes)</span>
          </div>
        ) : (
          <div className="findings-list" aria-label="Unsatisfiable classes list">
            {buildStatus.unsatisfiable_classes.map((clsIri) => (
              <button
                key={clsIri}
                type="button"
                className="warning-item-box"
                onClick={() => onNavigate?.(clsIri)}
                title={`Inspect unsatisfiable class: ${clsIri}`}
              >
                <span>{compactIri(clsIri)}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unsupported Constructs */}
      <div className="consistency-section">
        <span className="section-label">
          <Layers size={13} aria-hidden="true" />
          <span>Unsupported Semantic Constructs</span>
        </span>

        {(!buildStatus?.unsupported_constructs || buildStatus.unsupported_constructs.length === 0) ? (
          <div className="clean-status-box">
            <CheckCircle2 size={15} aria-hidden="true" />
            <span>All OWL 2 constructs in profile are supported</span>
          </div>
        ) : (
          <div className="findings-list">
            {buildStatus.unsupported_constructs.map((construct, idx) => (
              <div key={`${construct}-${idx}`} className="finding-card severity-warning">
                <span className="finding-severity" style={{ background: '#fef3c7', color: '#b45309' }}>
                  Unsupported
                </span>
                <span>{construct}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Findings */}
      {buildStatus?.findings && buildStatus.findings.length > 0 && (
        <div className="consistency-section">
          <span className="section-label">
            <FileCheck size={13} aria-hidden="true" />
            <span>Validation Findings ({buildStatus.findings.length})</span>
          </span>
          <div className="findings-list">
            {buildStatus.findings.map((f, idx) => (
              <div
                key={`${f.message}-${idx}`}
                className={`finding-card severity-${f.severity.toLowerCase()}`}
              >
                <span
                  className="finding-severity"
                  style={{
                    background:
                      f.severity.toLowerCase() === 'error'
                        ? '#fee2e2'
                        : f.severity.toLowerCase() === 'warning'
                        ? '#fef3c7'
                        : '#e0f2fe',
                    color:
                      f.severity.toLowerCase() === 'error'
                        ? '#991b1b'
                        : f.severity.toLowerCase() === 'warning'
                        ? '#92400e'
                        : '#0369a1',
                  }}
                >
                  {f.severity}
                </span>
                <p style={{ margin: 0 }}>{f.message}</p>
                {f.focus_node && (
                  <button
                    type="button"
                    className="iri-link"
                    onClick={() => onNavigate?.(f.focus_node!)}
                    style={{ textAlign: 'left', padding: 0 }}
                  >
                    <span>Focus: {compactIri(f.focus_node)}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ConsistencyPanel
