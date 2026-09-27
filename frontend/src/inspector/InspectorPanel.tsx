import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Info,
  FolderTree,
  Binary,
  GitBranch,
  ShieldCheck,
  LoaderCircle,
  AlertTriangle,
  RotateCw,
  Search,
} from 'lucide-react'
import type { GraphRelationship } from '../interfaces/models'
import {
  getResourceMetadata,
  getClassInfo,
  getPropertyInfo,
  getBuildStatus,
} from '../api/graph'
import { ResourceInspector } from './ResourceInspector'
import { ClassInspector } from './ClassInspector'
import { PropertyInspector } from './PropertyInspector'
import { ConsistencyPanel } from './ConsistencyPanel'
import { ProvenancePanel } from './ProvenancePanel'
import './InspectorPanel.css'

export type InspectorTab = 'resource' | 'class' | 'property' | 'provenance' | 'consistency'

export interface InspectorPanelProps {
  selectedId: string | null
  selectedRelationship?: GraphRelationship | null
  visibleRelationships?: GraphRelationship[]
  activeBuildId?: string | null
  reasonerName?: string | null
  onNavigate?: (iri: string) => void
  onExpand?: (iri: string) => void
  onShowInstances?: (iri: string) => void
  onShowSubclasses?: (iri: string) => void
  onWhyClick?: (handle: string) => void
  onFilterByProperty?: (iri: string) => void
  traversalControls?: React.ReactNode
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedId,
  selectedRelationship,
  visibleRelationships = [],
  activeBuildId,
  reasonerName,
  onNavigate,
  onExpand,
  onShowInstances,
  onShowSubclasses,
  onWhyClick,
  onFilterByProperty,
  traversalControls,
}) => {
  const [activeTab, setActiveTab] = useState<InspectorTab>('resource')

  // Query resource metadata for selected entity
  const {
    data: metadata,
    isLoading: isMetaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ['resource-metadata', selectedId],
    queryFn: () => (selectedId ? getResourceMetadata(selectedId) : Promise.resolve(null)),
    enabled: !!selectedId,
  })

  // Detect semantic kind
  const semanticKind = metadata?.semantic_kind?.toLowerCase() || ''
  const isClass =
    semanticKind === 'class' ||
    metadata?.asserted_types.some((t) => t.toLowerCase().includes('class')) ||
    false

  const isProperty =
    semanticKind.includes('property') ||
    metadata?.asserted_types.some((t) => t.toLowerCase().includes('property')) ||
    false

  // Query class info if selected item is a class
  const {
    data: classInfo,
    isLoading: isClassLoading,
    refetch: refetchClass,
  } = useQuery({
    queryKey: ['class-info', selectedId],
    queryFn: () => (selectedId ? getClassInfo(selectedId) : Promise.resolve(null)),
    enabled: !!selectedId && (isClass || activeTab === 'class'),
  })

  // Query property info if selected item is a property
  const {
    data: propertyInfo,
    isLoading: isPropertyLoading,
    refetch: refetchProperty,
  } = useQuery({
    queryKey: ['property-info', selectedId],
    queryFn: () => (selectedId ? getPropertyInfo(selectedId) : Promise.resolve(null)),
    enabled: !!selectedId && (isProperty || activeTab === 'property'),
  })

  // Query build status for consistency panel
  const {
    data: buildStatus,
    isLoading: isStatusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['build-status', activeBuildId],
    queryFn: () => getBuildStatus(),
  })

  // Synchronize tab selection with selection type changes
  useEffect(() => {
    if (selectedRelationship) {
      setActiveTab('provenance')
    } else if (selectedId && isClass && activeTab !== 'class' && activeTab !== 'resource') {
      setActiveTab('class')
    } else if (selectedId && isProperty && activeTab !== 'property' && activeTab !== 'resource') {
      setActiveTab('property')
    }
  }, [selectedRelationship, selectedId, isClass, isProperty])

  return (
    <div className="inspector-container" data-testid="inspector-panel">
      {/* 5-Tab Bar Header */}
      <div className="inspector-tabs" role="tablist" aria-label="Semantic Inspector Tabs">
        <button
          type="button"
          role="tab"
          id="tab-resource"
          aria-selected={activeTab === 'resource'}
          aria-controls="panel-resource"
          className={`inspector-tab-btn ${activeTab === 'resource' ? 'active' : ''}`}
          onClick={() => setActiveTab('resource')}
          disabled={!selectedId}
        >
          <Info size={13} aria-hidden="true" />
          <span>Resource</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-class"
          aria-selected={activeTab === 'class'}
          aria-controls="panel-class"
          className={`inspector-tab-btn ${activeTab === 'class' ? 'active' : ''} ${
            !isClass ? 'tab-muted' : ''
          }`}
          onClick={() => setActiveTab('class')}
          disabled={!selectedId}
        >
          <FolderTree size={13} aria-hidden="true" />
          <span>Class</span>
          {isClass && <span className="tab-smart-dot" title="Active class selected" />}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-property"
          aria-selected={activeTab === 'property'}
          aria-controls="panel-property"
          className={`inspector-tab-btn ${activeTab === 'property' ? 'active' : ''} ${
            !isProperty ? 'tab-muted' : ''
          }`}
          onClick={() => setActiveTab('property')}
          disabled={!selectedId}
        >
          <Binary size={13} aria-hidden="true" />
          <span>Property</span>
          {isProperty && <span className="tab-smart-dot" title="Active property selected" />}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-provenance"
          aria-selected={activeTab === 'provenance'}
          aria-controls="panel-provenance"
          className={`inspector-tab-btn ${activeTab === 'provenance' ? 'active' : ''}`}
          onClick={() => setActiveTab('provenance')}
        >
          <GitBranch size={13} aria-hidden="true" />
          <span>Provenance</span>
          {(selectedRelationship || visibleRelationships.length > 0) && (
            <span className="tab-smart-dot" title="Fact relationships available" />
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-consistency"
          aria-selected={activeTab === 'consistency'}
          aria-controls="panel-consistency"
          className={`inspector-tab-btn ${activeTab === 'consistency' ? 'active' : ''}`}
          onClick={() => setActiveTab('consistency')}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          <span>Consistency</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="inspector-body">
        {/* Consistency Tab (Always viewable even without entity selection) */}
        {activeTab === 'consistency' && (
          <div id="panel-consistency" role="tabpanel" aria-labelledby="tab-consistency">
            <ConsistencyPanel
              buildStatus={buildStatus}
              isLoading={isStatusLoading}
              error={statusError as Error | null}
              onRefresh={() => void refetchStatus()}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* Provenance Tab */}
        {activeTab === 'provenance' && (
          <div id="panel-provenance" role="tabpanel" aria-labelledby="tab-provenance">
            <ProvenancePanel
              selectedRelationship={selectedRelationship}
              relationships={visibleRelationships}
              onWhyClick={onWhyClick}
              onNavigate={onNavigate}
              activeBuildId={activeBuildId}
              reasonerName={reasonerName}
            />
          </div>
        )}

        {/* Empty state when no entity is selected and not viewing Consistency or Provenance */}
        {!selectedId && activeTab !== 'consistency' && activeTab !== 'provenance' && (
          <div className="inspector-empty-state" data-testid="inspector-empty">
            <div className="inspector-empty-icon" aria-hidden="true">
              <Search size={26} />
            </div>
            <h3>No Entity Selected</h3>
            <p>
              Select any node in the graph canvas, class tree, or search results to inspect its
              detailed semantic metadata.
            </p>
            <div className="inspector-empty-action">
              <button
                type="button"
                className="action-btn-small"
                onClick={() => setActiveTab('consistency')}
              >
                <ShieldCheck size={13} />
                <span>View Build Consistency</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading state for entity metadata */}
        {selectedId && isMetaLoading && activeTab !== 'consistency' && activeTab !== 'provenance' && (
          <div className="inspector-loading-card" data-testid="inspector-loading">
            <LoaderCircle size={28} className="spin text-accent" />
            <p>Fetching semantic metadata for selected resource...</p>
          </div>
        )}

        {/* Error state for entity metadata */}
        {selectedId && metaError && activeTab !== 'consistency' && activeTab !== 'provenance' && (
          <div className="inspector-error-card" data-testid="inspector-error">
            <AlertTriangle size={24} aria-hidden="true" />
            <p>{metaError.message || 'Unable to retrieve resource metadata from the graph service.'}</p>
            <button
              type="button"
              className="action-btn-primary"
              onClick={() => void refetchMeta()}
              style={{ width: 'fit-content', marginTop: 4 }}
            >
              <RotateCw size={12} />
              <span>Retry Query</span>
            </button>
          </div>
        )}

        {/* Resource Inspector Tab */}
        {selectedId && metadata && activeTab === 'resource' && (
          <div id="panel-resource" role="tabpanel" aria-labelledby="tab-resource">
            <ResourceInspector
              metadata={metadata}
              onNavigate={onNavigate}
              onExpand={onExpand}
              onInspectClass={() => setActiveTab('class')}
              onInspectProperty={() => setActiveTab('property')}
              traversalControls={traversalControls}
            />
          </div>
        )}

        {/* Class Inspector Tab */}
        {selectedId && activeTab === 'class' && (
          <div id="panel-class" role="tabpanel" aria-labelledby="tab-class">
            {isClassLoading ? (
              <div className="inspector-loading-card">
                <LoaderCircle size={24} className="spin text-accent" />
                <p>Loading class hierarchy and restrictions...</p>
              </div>
            ) : classInfo ? (
              <ClassInspector
                classInfo={classInfo}
                onNavigate={onNavigate}
                onShowInstances={onShowInstances}
                onShowSubclasses={onShowSubclasses}
                onExpand={onExpand}
              />
            ) : (
              <div className="inspector-error-card">
                <AlertTriangle size={20} />
                <p>No ClassInfo found for this resource.</p>
                <button
                  type="button"
                  className="action-btn-small"
                  onClick={() => void refetchClass()}
                  style={{ marginTop: 6 }}
                >
                  <RotateCw size={12} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Property Inspector Tab */}
        {selectedId && activeTab === 'property' && (
          <div id="panel-property" role="tabpanel" aria-labelledby="tab-property">
            {isPropertyLoading ? (
              <div className="inspector-loading-card">
                <LoaderCircle size={24} className="spin text-accent" />
                <p>Loading property domain, range, and characteristics...</p>
              </div>
            ) : propertyInfo ? (
              <PropertyInspector
                propertyInfo={propertyInfo}
                onNavigate={onNavigate}
                onExpand={onExpand}
                onFilterByProperty={onFilterByProperty}
              />
            ) : (
              <div className="inspector-error-card">
                <AlertTriangle size={20} />
                <p>No PropertyInfo found for this resource.</p>
                <button
                  type="button"
                  className="action-btn-small"
                  onClick={() => void refetchProperty()}
                  style={{ marginTop: 6 }}
                >
                  <RotateCw size={12} />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default InspectorPanel
