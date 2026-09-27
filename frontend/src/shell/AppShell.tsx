import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  LoaderCircle,
  AlertTriangle,
  Command,
  Layers,
  Cpu,
} from 'lucide-react'
import type { ActiveProfile } from '../interfaces/models'
import { SkipLinks } from '../accessibility/FocusManager'
import './AppShell.css'

export interface AppShellProps {
  profile?: ActiveProfile
  isLoading?: boolean
  error?: Error | null
  nodeCount: number
  edgeCount: number
  navigationContent: React.ReactNode
  canvasContent: React.ReactNode
  inspectorContent: React.ReactNode
  onOpenCommandPalette?: () => void
  headerActions?: React.ReactNode
}

export const AppShell: React.FC<AppShellProps> = ({
  profile,
  isLoading = false,
  error = null,
  nodeCount,
  edgeCount,
  navigationContent,
  canvasContent,
  inspectorContent,
  onOpenCommandPalette,
  headerActions,
}) => {
  const [navWidth, setNavWidth] = useState(320)
  const [inspectorWidth, setInspectorWidth] = useState(340)
  const [isNavOpen, setIsNavOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true)

  // Resizing state
  const isResizingNav = useRef(false)
  const isResizingInspector = useRef(false)

  const handleNavMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingNav.current = true
    document.body.classList.add('resizing-col')
  }

  const handleInspectorMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingInspector.current = true
    document.body.classList.add('resizing-col')
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingNav.current) {
      const newWidth = Math.min(Math.max(e.clientX, 220), 550)
      setNavWidth(newWidth)
    } else if (isResizingInspector.current) {
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 240), 600)
      setInspectorWidth(newWidth)
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    if (isResizingNav.current || isResizingInspector.current) {
      isResizingNav.current = false
      isResizingInspector.current = false
      document.body.classList.remove('resizing-col')
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  if (isLoading) {
    return (
      <main className="explorer-shell shell-loading" role="main" aria-label="Ontology Explorer Loading">
        <div className="shell-state-card">
          <LoaderCircle size={36} className="spin text-accent" />
          <h2>Loading Knowledge Graph</h2>
          <p>Connecting to backend and fetching ontology profile...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="explorer-shell shell-error" role="main" aria-label="Ontology Explorer Error">
        <div className="shell-state-card error-card">
          <AlertTriangle size={36} className="text-danger" />
          <h2>Unable to Load Profile</h2>
          <p>{error.message || 'An unexpected error occurred while loading the graph profile.'}</p>
          <button type="button" className="retry-button" onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </main>
    )
  }

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `
      ${isNavOpen ? `${navWidth}px` : '0px'}
      ${isNavOpen ? '6px' : '0px'}
      minmax(380px, 1fr)
      ${isInspectorOpen ? '6px' : '0px'}
      ${isInspectorOpen ? `${inspectorWidth}px` : '0px'}
    `,
  }

  return (
    <div className="explorer-shell">
      <SkipLinks />
      {profile && (
        <style>
          {profile.categories
            .map((cat) =>
              cat.color ? `.${cat.name.toLowerCase()} { background: ${cat.color} !important; }` : '',
            )
            .join('\n')}
        </style>
      )}

      {/* Main App Header */}
      <header className="app-header" role="banner">
        <div className="header-left">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              <Network size={22} />
            </div>
            <div>
              <p className="eyebrow" title={profile?.metadata.description}>
                {profile?.metadata.description ?? 'Knowledge Graph Explorer'}
              </p>
              <h1 className="ontology-title">
                {profile?.metadata.title ?? 'Graph Explorer'}
                {profile?.metadata.version && (
                  <span className="version-tag">v{profile.metadata.version}</span>
                )}
              </h1>
            </div>
          </div>

          <div className="ontology-metadata-badges" aria-label="Ontology profile metadata">
            {profile?.build_id && (
              <span className="meta-badge build-badge" title={`Store Build: ${profile.build_id}`}>
                <Layers size={13} aria-hidden="true" />
                <span>build:{profile.build_id.slice(0, 8)}</span>
              </span>
            )}
            {profile?.reasoning_profile && (
              <span className="meta-badge reasoner-badge" title={`Reasoning: ${profile.reasoning_profile}`}>
                <Cpu size={13} aria-hidden="true" />
                <span>{profile.reasoning_profile}</span>
              </span>
            )}
          </div>
        </div>

        <div className="header-center">
          {onOpenCommandPalette && (
            <button
              type="button"
              className="command-palette-trigger"
              onClick={onOpenCommandPalette}
              title="Open Command Palette (Ctrl+K or Cmd+K)"
              aria-label="Open Command Palette"
            >
              <Command size={14} aria-hidden="true" />
              <span>Quick jump or action...</span>
              <kbd className="cmd-kbd">Ctrl+K</kbd>
            </button>
          )}
        </div>

        <div className="header-right">
          {headerActions}

          <div className="graph-stats" aria-label="Current graph size">
            <span title="Rendered nodes">{nodeCount} nodes</span>
            <span title="Rendered edges">{edgeCount} edges</span>
          </div>

          <div className="panel-toggles" aria-label="Toggle Panels">
            <button
              type="button"
              className={`panel-toggle-btn ${isNavOpen ? 'active' : ''}`}
              title={isNavOpen ? 'Collapse Navigation Panel' : 'Expand Navigation Panel'}
              aria-label={isNavOpen ? 'Collapse Navigation' : 'Expand Navigation'}
              aria-pressed={isNavOpen}
              onClick={() => setIsNavOpen((prev) => !prev)}
            >
              {isNavOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <button
              type="button"
              className={`panel-toggle-btn ${isInspectorOpen ? 'active' : ''}`}
              title={isInspectorOpen ? 'Collapse Inspector Panel' : 'Expand Inspector Panel'}
              aria-label={isInspectorOpen ? 'Collapse Inspector' : 'Expand Inspector'}
              aria-pressed={isInspectorOpen}
              onClick={() => setIsInspectorOpen((prev) => !prev)}
            >
              {isInspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Three-Panel Layout Workspace */}
      <div className="explorer-layout-container" style={gridStyle}>
        {/* Left Navigation Panel */}
        <aside
          id="navigation-panel"
          className={`shell-panel nav-panel ${isNavOpen ? 'open' : 'collapsed'}`}
          aria-label="Ontology Navigation"
          aria-hidden={!isNavOpen}
        >
          {isNavOpen && <div className="panel-content-scroll">{navigationContent}</div>}
        </aside>

        {/* Left Resizer Handle */}
        {isNavOpen && (
          <div
            className="panel-resizer resizer-left"
            onMouseDown={handleNavMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize navigation panel"
            tabIndex={0}
          />
        )}
        {!isNavOpen && <div className="resizer-placeholder" />}

        {/* Center Canvas Panel */}
        <main
          id="main-canvas"
          className="shell-panel canvas-panel-wrapper"
          role="main"
          aria-label="Graph Canvas"
        >
          {canvasContent}
        </main>

        {/* Right Resizer Handle */}
        {isInspectorOpen && (
          <div
            className="panel-resizer resizer-right"
            onMouseDown={handleInspectorMouseDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inspector panel"
            tabIndex={0}
          />
        )}
        {!isInspectorOpen && <div className="resizer-placeholder" />}

        {/* Right Inspector Panel */}
        <aside
          id="inspector-panel"
          className={`shell-panel inspector-panel ${isInspectorOpen ? 'open' : 'collapsed'}`}
          aria-label="Semantic Inspector"
          aria-hidden={!isInspectorOpen}
        >
          {isInspectorOpen && <div className="panel-content-scroll">{inspectorContent}</div>}
        </aside>
      </div>
    </div>
  )
}

export default AppShell
