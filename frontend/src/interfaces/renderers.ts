import type { GraphEntity, GraphExpansion, ExpansionRequest, ActiveProfile } from './models'

import type { ExplorerGraph } from '../graph/state'


/**
 * Contract for a bounded rich neighborhood renderer (e.g. Cytoscape).
 */
export interface DetailGraphRenderer {
  graph: ExplorerGraph
  selectedId: string | null
  categoryColors?: Record<string, string>
  onSelectEntity(id: string): void
}

/**
 * Contract for an aggregate/sample graph renderer (e.g. cosmos.gl).
 */
export interface OverviewGraphRenderer {
  graph: ExplorerGraph
  onSelectCluster(clusterId: string): void
  onSelectEntity(entityId: string): void
}

/**
 * Contract for class/property/individual metadata and bounded navigation.
 */
export interface OntologyDataProvider {
  fetchProfile(): Promise<ActiveProfile>
  searchEntities(query: string): Promise<GraphEntity[]>
  expandGraph(request: ExpansionRequest): Promise<GraphExpansion>
}
