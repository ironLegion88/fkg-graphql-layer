import type {
  ExplorerSession,
  GraphEntity,
  GraphRelationship,
  TraversalDirection,
} from '../interfaces/models'

export const CURRENT_SESSION_VERSION = '1.0.0'

export interface SerializeSessionParams {
  profile_id: string
  build_id: string | null
  entities: Record<string, GraphEntity>
  relationships: Record<string, GraphRelationship>
  selected_id: string | null
  camera?: { zoom: number; pan: { x: number; y: number } }
  pinned_nodes?: string[]
  layout_name?: string
  direction?: TraversalDirection
  include_inferred?: boolean
  node_positions?: Record<string, { x: number; y: number }>
  name?: string
  created_at?: string
  updated_at?: string
}

export type DeserializationResult =
  | { success: true; session: ExplorerSession }
  | { success: false; error: string }

/**
 * Serializes current application state into a renderer-neutral ExplorerSession object.
 * Satisfies requirements SE-001 and GQ-114.
 */
export function serializeSession(params: SerializeSessionParams): ExplorerSession {
  const now = new Date().toISOString()
  return {
    version: CURRENT_SESSION_VERSION,
    profile_id: params.profile_id,
    build_id: params.build_id ?? null,
    created_at: params.created_at ?? now,
    updated_at: params.updated_at ?? now,
    entities: { ...params.entities },
    relationships: { ...params.relationships },
    selected_id: params.selected_id ?? null,
    camera: params.camera
      ? {
          zoom: typeof params.camera.zoom === 'number' && !isNaN(params.camera.zoom) ? params.camera.zoom : 1,
          pan: {
            x: typeof params.camera.pan?.x === 'number' && !isNaN(params.camera.pan.x) ? params.camera.pan.x : 0,
            y: typeof params.camera.pan?.y === 'number' && !isNaN(params.camera.pan.y) ? params.camera.pan.y : 0,
          },
        }
      : { zoom: 1, pan: { x: 0, y: 0 } },
    pinned_nodes: Array.isArray(params.pinned_nodes) ? [...params.pinned_nodes] : [],
    layout_name: params.layout_name ?? 'breadthfirst',
    direction: params.direction ?? 'BOTH',
    include_inferred: params.include_inferred ?? true,
    node_positions: params.node_positions ? { ...params.node_positions } : undefined,
    name: params.name?.trim() ? params.name.trim() : undefined,
  }
}

/**
 * Validates and deserializes raw JSON or object into a validated ExplorerSession.
 * Performs rigorous shape checking to guarantee graph integrity (SE-001, SE-002).
 */
export function deserializeSession(raw: unknown): DeserializationResult {
  let data: Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch (e) {
      return { success: false, error: `Invalid JSON format: ${e instanceof Error ? e.message : 'Parse error'}` }
    }
  } else if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    data = raw as Record<string, unknown>
  } else {
    return { success: false, error: 'Session data must be a valid JSON object' }
  }

  // Check version
  if (typeof data.version !== 'string' || !data.version.trim()) {
    return { success: false, error: 'Missing or invalid schema version' }
  }

  // Check profile_id
  if (typeof data.profile_id !== 'string') {
    return { success: false, error: 'Missing or invalid profile_id' }
  }

  // Check entities
  if (!data.entities || typeof data.entities !== 'object' || Array.isArray(data.entities)) {
    return { success: false, error: 'Session entities must be a dictionary keyed by IRI' }
  }

  const entities: Record<string, GraphEntity> = {}
  for (const [id, entity] of Object.entries(data.entities as Record<string, unknown>)) {
    if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
      return { success: false, error: `Invalid entity payload for IRI "${id}"` }
    }
    const e = entity as Record<string, unknown>
    if (typeof e.id !== 'string' || !e.id) {
      return { success: false, error: `Entity under key "${id}" is missing required "id"` }
    }
    if (typeof e.label !== 'string') {
      return { success: false, error: `Entity "${id}" is missing required "label"` }
    }
    entities[id] = {
      __typename: typeof e.__typename === 'string' ? e.__typename : 'OntologyEntity',
      id: e.id,
      label: e.label,
      description: typeof e.description === 'string' ? e.description : null,
      kind: typeof e.kind === 'string' ? e.kind : undefined,
    }
  }

  // Check relationships
  if (!data.relationships || typeof data.relationships !== 'object' || Array.isArray(data.relationships)) {
    return { success: false, error: 'Session relationships must be a dictionary' }
  }

  const relationships: Record<string, GraphRelationship> = {}
  for (const [key, rel] of Object.entries(data.relationships as Record<string, unknown>)) {
    if (!rel || typeof rel !== 'object' || Array.isArray(rel)) {
      return { success: false, error: `Invalid relationship payload for key "${key}"` }
    }
    const r = rel as Record<string, unknown>
    if (typeof r.relation !== 'string' || !r.relation) {
      return { success: false, error: `Relationship "${key}" is missing required "relation"` }
    }
    if (!r.source || typeof r.source !== 'object' || typeof (r.source as Record<string, unknown>).id !== 'string') {
      return { success: false, error: `Relationship "${key}" is missing valid source entity` }
    }
    if (!r.target || typeof r.target !== 'object' || typeof (r.target as Record<string, unknown>).id !== 'string') {
      return { success: false, error: `Relationship "${key}" is missing valid target entity` }
    }
    const sourceObj = r.source as Record<string, unknown>
    const targetObj = r.target as Record<string, unknown>

    relationships[key] = {
      relation: r.relation,
      source: {
        __typename: typeof sourceObj.__typename === 'string' ? sourceObj.__typename : 'OntologyEntity',
        id: sourceObj.id as string,
        label: typeof sourceObj.label === 'string' ? sourceObj.label : (sourceObj.id as string),
        description: typeof sourceObj.description === 'string' ? sourceObj.description : null,
        kind: typeof sourceObj.kind === 'string' ? sourceObj.kind : undefined,
      },
      target: {
        __typename: typeof targetObj.__typename === 'string' ? targetObj.__typename : 'OntologyEntity',
        id: targetObj.id as string,
        label: typeof targetObj.label === 'string' ? targetObj.label : (targetObj.id as string),
        description: typeof targetObj.description === 'string' ? targetObj.description : null,
        kind: typeof targetObj.kind === 'string' ? targetObj.kind : undefined,
      },
      predicate_iri: typeof r.predicate_iri === 'string' ? r.predicate_iri : null,
      predicate_label: typeof r.predicate_label === 'string' ? r.predicate_label : null,
      is_inferred: Boolean(r.is_inferred),
      source_graph: typeof r.source_graph === 'string' ? r.source_graph : null,
      explanation_handle: typeof r.explanation_handle === 'string' ? r.explanation_handle : null,
    }
  }

  // Camera validation
  let camera = { zoom: 1, pan: { x: 0, y: 0 } }
  if (data.camera && typeof data.camera === 'object') {
    const cam = data.camera as Record<string, unknown>
    const zoom = typeof cam.zoom === 'number' && !isNaN(cam.zoom) ? cam.zoom : 1
    const panObj = cam.pan && typeof cam.pan === 'object' ? (cam.pan as Record<string, unknown>) : {}
    const panX = typeof panObj.x === 'number' && !isNaN(panObj.x) ? panObj.x : 0
    const panY = typeof panObj.y === 'number' && !isNaN(panObj.y) ? panObj.y : 0
    camera = { zoom, pan: { x: panX, y: panY } }
  }

  // Pinned nodes validation
  const pinned_nodes: string[] = []
  if (Array.isArray(data.pinned_nodes)) {
    for (const id of data.pinned_nodes) {
      if (typeof id === 'string') {
        pinned_nodes.push(id)
      }
    }
  }

  // Node positions validation (optional)
  let node_positions: Record<string, { x: number; y: number }> | undefined
  if (data.node_positions && typeof data.node_positions === 'object' && !Array.isArray(data.node_positions)) {
    node_positions = {}
    for (const [id, pos] of Object.entries(data.node_positions as Record<string, unknown>)) {
      if (pos && typeof pos === 'object') {
        const p = pos as Record<string, unknown>
        if (typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)) {
          node_positions[id] = { x: p.x, y: p.y }
        }
      }
    }
  }

  // Direction validation
  let direction: TraversalDirection = 'BOTH'
  if (data.direction === 'OUTGOING' || data.direction === 'INCOMING' || data.direction === 'BOTH') {
    direction = data.direction
  }

  const session: ExplorerSession = {
    version: data.version,
    profile_id: data.profile_id,
    build_id: typeof data.build_id === 'string' ? data.build_id : null,
    created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString(),
    entities,
    relationships,
    selected_id: typeof data.selected_id === 'string' ? data.selected_id : null,
    camera,
    pinned_nodes,
    layout_name: typeof data.layout_name === 'string' ? data.layout_name : 'breadthfirst',
    direction,
    include_inferred: data.include_inferred !== undefined ? Boolean(data.include_inferred) : true,
    node_positions,
    name: typeof data.name === 'string' ? data.name : undefined,
  }

  return { success: true, session }
}
