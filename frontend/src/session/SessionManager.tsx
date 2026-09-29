import React, { useState, useEffect, useRef } from 'react'
import {
  Save,
  Download,
  Upload,
  FolderOpen,
  Share2,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type {
  ActiveProfile,
  ExplorerSession,
  SessionCompatibility,
  TraversalDirection,
} from '../interfaces/models'
import type { ExplorerGraph } from '../graph/state'
import {
  serializeSession,
  CURRENT_SESSION_VERSION,
} from './sessionSchema'
import {
  loadFromLocalStorage,
  clearLocalStorage,
  listSavedSessions,
  saveNamedSession,
  deleteSavedSession,
} from './sessionStorage'
import { downloadSession, uploadSession } from './sessionFile'
import {
  checkCompatibility,
  filterSessionForPartialRestore,
} from './sessionCompatibility'
import {
  generateDeepLinkUrl,
  copyDeepLink,
} from './deepLinks'
import './SessionManager.css'

export interface SessionManagerProps {
  isOpen: boolean
  onClose: () => void
  currentProfile?: ActiveProfile | null
  currentBuildId?: string | null
  currentGraph: ExplorerGraph
  selectedId: string | null
  layoutName: string
  direction: TraversalDirection
  includeInferred: boolean
  pinnedNodeIds: string[]
  camera?: { zoom: number; pan: { x: number; y: number } }
  nodePositions?: Record<string, { x: number; y: number }>
  autoSaveEnabled: boolean
  onToggleAutoSave: (enabled: boolean) => void
  onRestoreSession: (session: ExplorerSession) => void
  onClearSession: () => void
  initialTab?: 'save' | 'restore' | 'share'
}

type TabType = 'save' | 'restore' | 'share'

export const SessionManager: React.FC<SessionManagerProps> = ({
  isOpen,
  onClose,
  currentProfile,
  currentBuildId,
  currentGraph,
  selectedId,
  layoutName,
  direction,
  includeInferred,
  pinnedNodeIds,
  camera,
  nodePositions,
  autoSaveEnabled,
  onToggleAutoSave,
  onRestoreSession,
  onClearSession,
  initialTab = 'save',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [sessionName, setSessionName] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [recentSessions, setRecentSessions] = useState<ExplorerSession[]>([])

  // State for inspecting/restoring a candidate session
  const [candidateSession, setCandidateSession] = useState<ExplorerSession | null>(null)
  const [compatibility, setCompatibility] = useState<SessionCompatibility | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const modalContainerRef = useRef<HTMLDivElement | null>(null)

  const nodeCount = Object.keys(currentGraph.entities).length
  const edgeCount = Object.keys(currentGraph.relationships).length

  // Refresh recent sessions and sync initial tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setFeedback(null)
      setCandidateSession(null)
      setCompatibility(null)
      setRecentSessions(listSavedSessions())
    }
  }, [isOpen, initialTab])

  // Keyboard accessibility: Escape to close
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

  const buildCurrentSession = (customName?: string): ExplorerSession => {
    return serializeSession({
      profile_id: currentProfile?.metadata?.package_id || 'unknown-profile',
      build_id: currentBuildId ?? currentProfile?.build_id ?? null,
      entities: currentGraph.entities,
      relationships: currentGraph.relationships,
      selected_id: selectedId,
      camera,
      pinned_nodes: pinnedNodeIds,
      layout_name: layoutName,
      direction,
      include_inferred: includeInferred,
      node_positions: nodePositions,
      name: customName || sessionName,
    })
  }

  // Save to browser
  const handleSaveToBrowser = () => {
    const session = buildCurrentSession(sessionName || `Session ${new Date().toLocaleTimeString()}`)
    const res = saveNamedSession(session, session.name || 'Saved Session')
    if (res.success) {
      setFeedback({ type: 'success', message: `Session "${session.name}" saved to browser storage.` })
      setRecentSessions(listSavedSessions())
      setSessionName('')
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to save session.' })
    }
  }

  // Export to file download
  const handleExportToFile = () => {
    const session = buildCurrentSession()
    downloadSession(session)
    setFeedback({ type: 'success', message: 'Session exported to file.' })
  }

  // Prepare a session for restore by checking compatibility
  const inspectAndCheckSession = (session: ExplorerSession) => {
    const comp = checkCompatibility(session, currentProfile, currentBuildId)
    setCandidateSession(session)
    setCompatibility(comp)
    setFeedback(null)
  }

  // Load from browser active session
  const handleLoadActiveFromBrowser = () => {
    const session = loadFromLocalStorage()
    if (!session) {
      setFeedback({ type: 'error', message: 'No active session found in browser storage.' })
      return
    }
    inspectAndCheckSession(session)
  }

  // Upload from file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const session = await uploadSession(file)
      inspectAndCheckSession(session)
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to parse session file.',
      })
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Confirm restore (full)
  const handleConfirmRestoreFull = () => {
    if (!candidateSession) return
    onRestoreSession(candidateSession)
    setFeedback({ type: 'success', message: 'Session restored successfully.' })
    setCandidateSession(null)
    setCompatibility(null)
    onClose()
  }

  // Confirm restore (partial, skipping missing IRIs)
  const handleConfirmRestorePartial = () => {
    if (!candidateSession || !compatibility) return
    const filtered = filterSessionForPartialRestore(candidateSession, compatibility.missing_iris)
    onRestoreSession(filtered)
    setFeedback({
      type: 'success',
      message: `Restored ${Object.keys(filtered.entities).length} entities (skipped ${compatibility.missing_iris.length} missing).`,
    })
    setCandidateSession(null)
    setCompatibility(null)
    onClose()
  }

  // Delete saved session
  const handleDeleteSaved = (createdAt: string) => {
    deleteSavedSession(createdAt)
    setRecentSessions(listSavedSessions())
    if (candidateSession?.created_at === createdAt) {
      setCandidateSession(null)
      setCompatibility(null)
    }
  }

  // Deep Link URL for share tab
  const deepLinkState = {
    entities: Object.keys(currentGraph.entities),
    selected: selectedId,
    layout: layoutName,
    direction: direction !== 'BOTH' ? direction : undefined,
    inferred: includeInferred ? undefined : false,
    profile: currentProfile?.metadata?.package_id,
    build: currentBuildId ?? currentProfile?.build_id ?? null,
  }
  const shareableUrl = generateDeepLinkUrl(deepLinkState)

  const handleCopyLink = async () => {
    const success = await copyDeepLink(deepLinkState)
    if (success) {
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 2500)
    }
  }

  return (
    <div
      className="session-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="session-modal-container" ref={modalContainerRef}>
        {/* Header */}
        <div className="session-modal-header">
          <div className="session-modal-title-group">
            <div className="session-modal-icon-badge" aria-hidden="true">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 id="session-modal-title" className="session-modal-title">
                Session Manager
              </h2>
              <p className="session-modal-subtitle">
                Save, restore, export, and share graph exploration sessions
              </p>
            </div>
          </div>
          <button
            type="button"
            className="session-modal-close-btn"
            onClick={onClose}
            aria-label="Close session manager"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="session-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'save'}
            className={`session-tab-btn ${activeTab === 'save' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('save')
              setFeedback(null)
            }}
          >
            <Save size={16} />
            <span>Save & Export</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'restore'}
            className={`session-tab-btn ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('restore')
              setFeedback(null)
            }}
          >
            <RotateCcw size={16} />
            <span>Restore & Import</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'share'}
            className={`session-tab-btn ${activeTab === 'share' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('share')
              setFeedback(null)
            }}
          >
            <Share2 size={16} />
            <span>Share & Deep Link</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="session-modal-body">
          {feedback && (
            <div
              className={`session-compat-card ${feedback.type === 'success' ? 'success' : 'error'}`}
              role="alert"
            >
              <div className="session-compat-header">
                {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{feedback.message}</span>
              </div>
            </div>
          )}

          {/* TAB 1: SAVE & EXPORT */}
          {activeTab === 'save' && (
            <>
              <div className="session-stat-card">
                <div className="session-stat-item">
                  <span className="session-stat-label">Entities</span>
                  <span className="session-stat-value">{nodeCount}</span>
                </div>
                <div className="session-stat-item">
                  <span className="session-stat-label">Relationships</span>
                  <span className="session-stat-value">{edgeCount}</span>
                </div>
                <div className="session-stat-item">
                  <span className="session-stat-label">Schema Ver</span>
                  <span className="session-stat-value">v{CURRENT_SESSION_VERSION}</span>
                </div>
              </div>

              <div className="session-form-group">
                <label htmlFor="session-name-input" className="session-form-label">
                  Session Name (optional)
                </label>
                <input
                  id="session-name-input"
                  type="text"
                  className="session-input-text"
                  placeholder="e.g., Bordeaux Red Wine Classification"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>

              <div className="session-action-row">
                <button
                  type="button"
                  className="session-btn-primary"
                  onClick={handleSaveToBrowser}
                >
                  <Save size={16} />
                  <span>Save to Browser</span>
                </button>
                <button
                  type="button"
                  className="session-btn-secondary"
                  onClick={handleExportToFile}
                >
                  <Download size={16} />
                  <span>Export to File (.fkg-session.json)</span>
                </button>
              </div>

              <div className="session-autosave-box">
                <div className="session-autosave-info">
                  <span className="session-autosave-title">Auto-Save to Local Storage</span>
                  <span className="session-autosave-desc">
                    Automatically saves canvas changes after 2 seconds of inactivity
                  </span>
                </div>
                <label className="session-toggle-label" title="Toggle Auto-Save">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(e) => onToggleAutoSave(e.target.checked)}
                    aria-label="Toggle auto-save to browser storage"
                  />
                  <span className="session-toggle-slider" />
                </label>
              </div>
            </>
          )}

          {/* TAB 2: RESTORE & IMPORT */}
          {activeTab === 'restore' && (
            <>
              <div className="session-action-row">
                <button
                  type="button"
                  className="session-btn-secondary"
                  onClick={handleLoadActiveFromBrowser}
                >
                  <FolderOpen size={16} />
                  <span>Load from Browser</span>
                </button>
                <button
                  type="button"
                  className="session-btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  <span>Import from File</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.fkg-session.json"
                  style={{ display: 'none' }}
                  onChange={(e) => void handleFileUpload(e)}
                />
              </div>

              {/* Compatibility Check Card if candidate session selected */}
              {candidateSession && compatibility && (
                <div
                  className={`session-compat-card ${
                    !compatibility.compatible
                      ? 'error'
                      : compatibility.warnings.length > 0
                        ? 'warning'
                        : 'success'
                  }`}
                  role="region"
                  aria-label="Session compatibility report"
                >
                  <div className="session-compat-header">
                    {!compatibility.compatible ? (
                      <AlertCircle size={18} />
                    ) : compatibility.warnings.length > 0 ? (
                      <AlertTriangle size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    <span>
                      {!compatibility.compatible
                        ? 'Session is Incompatible'
                        : compatibility.warnings.length > 0
                          ? 'Session Compatible with Warnings'
                          : 'Session Fully Compatible'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8125rem' }}>
                    <strong>Session:</strong> {candidateSession.name || 'Untitled'} (
                    {Object.keys(candidateSession.entities).length} entities,{' '}
                    {Object.keys(candidateSession.relationships).length} relationships)
                  </div>

                  {compatibility.errors.length > 0 && (
                    <ul className="session-compat-list">
                      {compatibility.errors.map((err, idx) => (
                        <li key={idx}><strong>Error:</strong> {err}</li>
                      ))}
                    </ul>
                  )}

                  {compatibility.warnings.length > 0 && (
                    <ul className="session-compat-list">
                      {compatibility.warnings.map((warn, idx) => (
                        <li key={idx}>{warn}</li>
                      ))}
                    </ul>
                  )}

                  <div className="session-action-row" style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="session-btn-primary"
                      onClick={handleConfirmRestoreFull}
                      disabled={!compatibility.compatible}
                    >
                      <span>Restore Full Session</span>
                    </button>

                    {compatibility.missing_iris.length > 0 && (
                      <button
                        type="button"
                        className="session-btn-secondary"
                        onClick={handleConfirmRestorePartial}
                      >
                        <Sparkles size={15} />
                        <span>Partial Restore (Skip Missing)</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="session-btn-secondary"
                      onClick={() => {
                        setCandidateSession(null)
                        setCompatibility(null)
                      }}
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Saved Sessions in LocalStorage */}
              <div>
                <p className="session-form-label" style={{ marginBottom: '0.5rem' }}>
                  Saved Sessions in Browser ({recentSessions.length})
                </p>
                {recentSessions.length === 0 ? (
                  <p className="session-modal-subtitle">No saved sessions found in browser storage.</p>
                ) : (
                  <div className="session-saved-list">
                    {recentSessions.map((session) => (
                      <div key={session.created_at} className="session-saved-item">
                        <div>
                          <div className="session-saved-name">{session.name || 'Untitled Session'}</div>
                          <div className="session-saved-meta">
                            <span>{new Date(session.updated_at).toLocaleDateString()} {new Date(session.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{Object.keys(session.entities).length} nodes, {Object.keys(session.relationships).length} edges</span>
                            <span>•</span>
                            <span>{session.profile_id}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="session-btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => inspectAndCheckSession(session)}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="session-btn-danger"
                            style={{ padding: '0.35rem 0.5rem' }}
                            title="Delete saved session"
                            onClick={() => handleDeleteSaved(session.created_at)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone: Clear Session */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#b91c1c' }}>Reset Workspace</span>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Clear current graph canvas and active browser session</p>
                </div>
                <button
                  type="button"
                  className="session-btn-danger"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear the current graph and stored active session?')) {
                      clearLocalStorage()
                      onClearSession()
                      onClose()
                    }
                  }}
                >
                  <Trash2 size={14} />
                  <span>Clear Session</span>
                </button>
              </div>
            </>
          )}

          {/* TAB 3: SHARE & DEEP LINK */}
          {activeTab === 'share' && (
            <>
              <p className="session-modal-subtitle">
                Share this link to reproduce the current visible graph, selected entity, active layout,
                and filters without embedding private data.
              </p>

              <div className="session-form-group">
                <label htmlFor="session-deeplink-input" className="session-form-label">
                  Shareable Deep Link URL
                </label>
                <div className="session-deeplink-box">
                  <input
                    id="session-deeplink-input"
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="session-deeplink-input"
                  />
                  <button
                    type="button"
                    className="session-btn-primary"
                    onClick={() => void handleCopyLink()}
                  >
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              <div className="session-stat-card" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="session-stat-item">
                  <span className="session-stat-label">Encoded Nodes</span>
                  <span className="session-stat-value">{deepLinkState.entities.length}</span>
                </div>
                <div className="session-stat-item">
                  <span className="session-stat-label">Active Layout</span>
                  <span className="session-stat-value">{layoutName}</span>
                </div>
                <div className="session-stat-item">
                  <span className="session-stat-label">Direction</span>
                  <span className="session-stat-value">{direction}</span>
                </div>
                <div className="session-stat-item">
                  <span className="session-stat-label">Profile</span>
                  <span className="session-stat-value">{currentProfile?.metadata?.package_id || 'default'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
