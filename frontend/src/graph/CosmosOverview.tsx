import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Graph as CosmosGraph } from '@cosmos.gl/graph'
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Info,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import type { OverviewGraphRenderer } from '../interfaces/renderers'
import type { OverviewCluster, OverviewData } from '../interfaces/models'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import './CosmosOverview.css'

export interface CosmosOverviewProps extends OverviewGraphRenderer {
  className?: string
  onDrillDown?: (classIri: string) => void
  onFallbackRequested?: () => void
}

/**
 * Convert hex color string to normalized RGBA float array [0..1]
 */
function hexToRgba(
  hex: string | null | undefined,
  alpha = 1.0,
  fallback: [number, number, number, number] = [0.42, 0.48, 0.58, 1.0],
): [number, number, number, number] {
  if (!hex) return fallback
  let clean = hex.replace('#', '')
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('')
  }
  if (clean.length === 6) {
    const num = parseInt(clean, 16)
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255,
      alpha,
    ]
  }
  return fallback
}

/**
 * Fallback palette for clusters without explicit profile colors
 */
const DEFAULT_PALETTE = [
  '#b83c50',
  '#287b73',
  '#6c5ca4',
  '#d7972f',
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#06b6d4',
]

export const CosmosOverview: React.FC<CosmosOverviewProps> = ({
  overviewData,
  selectedClusterIri,
  categoryColors,
  onSelectCluster,
  onDrillDown,
  onFallbackRequested,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const cosmosRef = useRef<CosmosGraph | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const [initError, setInitError] = useState<string | null>(null)
  const [hoveredCluster, setHoveredCluster] = useState<OverviewCluster | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const [searchFilter, setSearchFilter] = useState('')

  // Map of class IRI to cluster index and object
  const clusterIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    overviewData.clusters.forEach((c, idx) => {
      map.set(c.class_iri, idx)
    })
    return map
  }, [overviewData.clusters])

  // Count relationships per cluster for tooltips and badges
  const relationshipCountByClass = useMemo(() => {
    const counts = new Map<string, number>()
    for (const edge of overviewData.edges) {
      counts.set(edge.source_class, (counts.get(edge.source_class) || 0) + edge.count)
      counts.set(edge.target_class, (counts.get(edge.target_class) || 0) + edge.count)
    }
    return counts
  }, [overviewData.edges])

  // Filtered clusters for quick access bar
  const displayedClusters = useMemo(() => {
    if (!searchFilter.trim()) {
      return overviewData.clusters.slice(0, 12)
    }
    const needle = searchFilter.toLowerCase()
    return overviewData.clusters.filter(
      (c) => c.label.toLowerCase().includes(needle) || c.class_iri.toLowerCase().includes(needle),
    )
  }, [overviewData.clusters, searchFilter])

  // Resolve color for a cluster
  const getClusterColorHex = useCallback(
    (cluster: OverviewCluster, index: number): string => {
      if (cluster.color) return cluster.color
      if (categoryColors && categoryColors[cluster.label]) return categoryColors[cluster.label]
      return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
    },
    [categoryColors],
  )

  // Initialize and update cosmos.gl instance
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let isDisposed = false
    let graphInstance: CosmosGraph | null = null

    async function initCosmos() {
      try {
        setInitError(null)

        // Clear existing container children
        container!.innerHTML = ''

        const clusterCount = overviewData.clusters.length
        if (clusterCount === 0) return

        // Compute precomputed phyllotaxis layout (spiral galaxy pattern)
        const positions = new Float32Array(clusterCount * 2)
        const radius = Math.min(450, 60 + Math.sqrt(clusterCount) * 40)
        overviewData.clusters.forEach((_, i) => {
          const phi = i * 2.39996323 // Golden angle in radians
          const r = Math.sqrt(i + 1) * (radius / Math.sqrt(clusterCount + 1))
          positions[i * 2] = r * Math.cos(phi)
          positions[i * 2 + 1] = r * Math.sin(phi)
        })

        // Compute point sizes (scaled by instance count)
        const sizes = new Float32Array(clusterCount)
        const colors = new Float32Array(clusterCount * 4)

        overviewData.clusters.forEach((cluster, i) => {
          // Bounded sizing: min 10px, max 38px
          const isSelected = selectedClusterIri === cluster.class_iri
          const baseSize = Math.min(38, Math.max(10, 10 + Math.sqrt(cluster.instance_count) * 3.2))
          sizes[i] = isSelected ? baseSize * 1.35 : baseSize

          const colorHex = getClusterColorHex(cluster, i)
          const rgba = hexToRgba(colorHex, isSelected ? 1.0 : 0.85)
          colors[i * 4] = rgba[0]
          colors[i * 4 + 1] = rgba[1]
          colors[i * 4 + 2] = rgba[2]
          colors[i * 4 + 3] = rgba[3]
        })

        // Compute edges
        const linkIndices: number[] = []
        const linkWidths: number[] = []
        const linkColors: number[] = []

        overviewData.edges.forEach((edge) => {
          const srcIdx = clusterIndexMap.get(edge.source_class)
          const tgtIdx = clusterIndexMap.get(edge.target_class)
          if (srcIdx !== undefined && tgtIdx !== undefined) {
            linkIndices.push(srcIdx, tgtIdx)
            // Width bounded by count: min 1px, max 7px
            const width = Math.min(7, Math.max(1, 1 + Math.log2(edge.count + 1)))
            linkWidths.push(width)

            const isConnectedToSelected =
              selectedClusterIri === edge.source_class || selectedClusterIri === edge.target_class
            const alpha = isConnectedToSelected ? 0.8 : 0.25
            linkColors.push(0.5, 0.58, 0.7, alpha)
          }
        })

        // Configure cosmos.gl graph
        const config = {
          enableSimulation: !prefersReducedMotion,
          simulationGravity: 0.15,
          simulationRepulsion: 0.8,
          simulationFriction: 0.85,
          simulationLinkSpring: 0.05,
          simulationLinkDistance: 50,
          rescalePositions: true,
          fitViewOnInit: true,
          fitViewDelay: 50,
          pointDefaultSize: 14,
          linkDefaultWidth: 1.5,
          linkOpacity: 0.35,
          backgroundColor: '#0d131f', // Premium sleek dark mode background
          onPointClick: (index: number) => {
            const target = overviewData.clusters[index]
            if (target) {
              onSelectCluster(target.class_iri)
            }
          },
          onPointMouseOver: (index: number, _pos: [number, number], event?: MouseEvent) => {
            const target = overviewData.clusters[index]
            if (target) {
              setHoveredCluster(target)
              if (event && container) {
                const rect = container.getBoundingClientRect()
                setTooltipPos({
                  x: Math.min(rect.width - 240, Math.max(12, event.clientX - rect.left + 16)),
                  y: Math.min(rect.height - 140, Math.max(12, event.clientY - rect.top + 16)),
                })
              }
            }
          },
          onPointMouseOut: () => {
            setHoveredCluster(null)
            setTooltipPos(null)
          },
          onBackgroundClick: () => {
            onSelectCluster('')
          },
        }

        graphInstance = new CosmosGraph(container!, config)
        await graphInstance.ready

        if (isDisposed) {
          graphInstance.destroy()
          return
        }

        graphInstance.setPointPositions(positions)
        graphInstance.setPointSizes(sizes)
        graphInstance.setPointColors(colors)

        if (linkIndices.length > 0) {
          graphInstance.setLinks(new Float32Array(linkIndices))
          graphInstance.setLinkWidths(new Float32Array(linkWidths))
          graphInstance.setLinkColors(new Float32Array(linkColors))
        }

        graphInstance.create()
        cosmosRef.current = graphInstance
      } catch (err) {
        console.error('Failed to initialize cosmos.gl overview:', err)
        const errMsg = err instanceof Error ? err.message : String(err)
        setInitError(errMsg)
      }
    }

    void initCosmos()

    return () => {
      isDisposed = true
      if (cosmosRef.current) {
        try {
          cosmosRef.current.destroy()
        } catch {
          // ignore cleanup errors
        }
        cosmosRef.current = null
      }
    }
  }, [
    overviewData,
    selectedClusterIri,
    prefersReducedMotion,
    clusterIndexMap,
    getClusterColorHex,
    onSelectCluster,
  ])

  // Canvas zoom/fit controls
  const handleZoomIn = () => {
    if (cosmosRef.current) {
      cosmosRef.current.zoomIn?.()
    }
  }

  const handleZoomOut = () => {
    if (cosmosRef.current) {
      cosmosRef.current.zoomOut?.()
    }
  }

  const handleFitView = () => {
    if (cosmosRef.current) {
      cosmosRef.current.fitView?.()
    }
  }

  // Active selected cluster object
  const selectedCluster = useMemo(() => {
    if (!selectedClusterIri) return null
    return overviewData.clusters.find((c) => c.class_iri === selectedClusterIri) || null
  }, [overviewData.clusters, selectedClusterIri])

  return (
    <div
      className={`cosmos-overview-wrapper ${className}`}
      data-testid="cosmos-overview"
      role="region"
      aria-label="GPU-accelerated ontology class overview"
    >
      {/* Top Overview Toolbar */}
      <header className="cosmos-toolbar">
        <div className="cosmos-toolbar-left">
          <span className="cosmos-badge">
            <Sparkles size={14} className="badge-icon" aria-hidden="true" />
            <span>GPU Overview</span>
          </span>
          <div className="cosmos-stats" aria-live="polite">
            <span className="stat-pill">
              <strong>{overviewData.clusters.length}</strong> classes
            </span>
            <span className="stat-pill">
              <strong>{overviewData.total_instances}</strong> instances
            </span>
            <span className="stat-pill">
              <strong>{overviewData.total_relationships}</strong> relationships
            </span>
          </div>
        </div>

        <div className="cosmos-toolbar-center">
          <div className="cosmos-search-box">
            <Search size={14} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Find class cluster..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Filter class clusters"
              className="cosmos-search-input"
            />
          </div>
        </div>

        <div className="cosmos-toolbar-right">
          <button
            type="button"
            className="cosmos-ctrl-btn"
            onClick={handleZoomIn}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            className="cosmos-ctrl-btn"
            onClick={handleZoomOut}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            className="cosmos-ctrl-btn"
            onClick={handleFitView}
            title="Fit view to all clusters"
            aria-label="Fit view to all clusters"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </header>

      {/* Main Canvas Container */}
      <div className="cosmos-canvas-container">
        <div
          ref={containerRef}
          className="cosmos-canvas"
          data-testid="cosmos-canvas"
          tabIndex={0}
          aria-label="Interactive WebGL graph showing ontology class clusters"
        />

        {/* Selected Cluster Info Card */}
        {selectedCluster && (
          <aside
            className="cosmos-selection-card"
            data-testid="cosmos-selected-cluster"
            aria-label={`Selected cluster ${selectedCluster.label}`}
          >
            <div className="selection-card-header">
              <span
                className="selection-color-dot"
                style={{
                  backgroundColor:
                    selectedCluster.color ||
                    categoryColors?.[selectedCluster.label] ||
                    '#3b82f6',
                }}
                aria-hidden="true"
              />
              <div className="selection-title-box">
                <h4 className="selection-title">{selectedCluster.label}</h4>
                <span className="selection-iri" title={selectedCluster.class_iri}>
                  {selectedCluster.class_iri}
                </span>
              </div>
            </div>

            <div className="selection-stats-row">
              <div className="selection-stat-item">
                <span className="stat-label">Instances</span>
                <span className="stat-val">{selectedCluster.instance_count}</span>
              </div>
              <div className="selection-stat-item">
                <span className="stat-label">Relationships</span>
                <span className="stat-val">
                  {relationshipCountByClass.get(selectedCluster.class_iri) || 0}
                </span>
              </div>
            </div>

            <div className="selection-actions">
              <button
                type="button"
                className="drilldown-btn"
                onClick={() => onDrillDown?.(selectedCluster.class_iri)}
                data-testid="drilldown-button"
              >
                <span>Drill down to Detail</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </div>
          </aside>
        )}

        {/* Hover Tooltip */}
        {hoveredCluster && tooltipPos && (
          <div
            className="cosmos-tooltip"
            data-testid="cosmos-tooltip"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
            role="tooltip"
          >
            <div className="tooltip-header">
              <span
                className="tooltip-dot"
                style={{
                  backgroundColor:
                    hoveredCluster.color || categoryColors?.[hoveredCluster.label] || '#3b82f6',
                }}
                aria-hidden="true"
              />
              <strong className="tooltip-title">{hoveredCluster.label}</strong>
            </div>
            <div className="tooltip-body">
              <div>
                <span className="tooltip-key">Instances:</span>{' '}
                <span className="tooltip-value">{hoveredCluster.instance_count}</span>
              </div>
              <div>
                <span className="tooltip-key">Connected edges:</span>{' '}
                <span className="tooltip-value">
                  {relationshipCountByClass.get(hoveredCluster.class_iri) || 0}
                </span>
              </div>
            </div>
            <div className="tooltip-hint">Click to select and drill down</div>
          </div>
        )}

        {/* GPU Initialization Failure Fallback */}
        {initError && (
          <div className="cosmos-error-overlay" role="alert">
            <AlertTriangle size={32} className="error-icon" aria-hidden="true" />
            <h3>GPU Overview Unavailable</h3>
            <p>WebGL initialization failed: {initError}</p>
            {onFallbackRequested && (
              <button
                type="button"
                className="fallback-btn"
                onClick={onFallbackRequested}
                data-testid="fallback-button"
              >
                Switch to Table and Cytoscape Detail View
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cluster Navigation Pill Bar */}
      <footer className="cosmos-cluster-footer">
        <span className="footer-label">
          <Layers size={13} aria-hidden="true" />
          <span>Quick Clusters:</span>
        </span>
        <div className="cosmos-pills-list">
          {displayedClusters.map((cluster) => {
            const isSelected = selectedClusterIri === cluster.class_iri
            const color =
              cluster.color || categoryColors?.[cluster.label] || DEFAULT_PALETTE[0]
            return (
              <button
                key={cluster.class_iri}
                type="button"
                className={`cluster-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectCluster(cluster.class_iri)}
                title={`${cluster.label} (${cluster.instance_count} instances)`}
              >
                <span
                  className="pill-dot"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="pill-name">{cluster.label}</span>
                <span className="pill-count">{cluster.instance_count}</span>
              </button>
            )
          })}
        </div>
      </footer>
    </div>
  )
}

export default CosmosOverview
