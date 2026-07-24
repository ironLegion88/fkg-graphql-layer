import type {
  GraphEntity,
  GraphExpansion,
  GraphRelationship,
} from '../api/graph'

export interface ExplorerGraph {
  entities: Record<string, GraphEntity>
  relationships: Record<string, GraphRelationship>
}

export interface VisibleGraphLimits {
  maxNodes: number
  maxEdges: number
}

export interface ExpansionRecord {
  centerId: string
  addedNodeIds: string[]
  addedRelationshipIds: string[]
}

export interface MergeExpansionResult {
  graph: ExplorerGraph
  record: ExpansionRecord
  rejectedNodes: number
  rejectedRelationships: number
  limitReached: boolean
}

export const DEFAULT_VISIBLE_LIMITS: VisibleGraphLimits = {
  maxNodes: 500,
  maxEdges: 1_000,
}

export const emptyGraph: ExplorerGraph = {
  entities: {},
  relationships: {},
}

export function relationshipKey(relationship: GraphRelationship): string {
  return `${relationship.source.id}|${relationship.relation}|${relationship.target.id}`
}

export function addStandaloneEntity(
  graph: ExplorerGraph,
  entity: GraphEntity,
  limits: VisibleGraphLimits = DEFAULT_VISIBLE_LIMITS,
): ExplorerGraph {
  if (graph.entities[entity.id]) {
    return {
      ...graph,
      entities: { ...graph.entities, [entity.id]: entity },
    }
  }
  if (Object.keys(graph.entities).length >= limits.maxNodes) {
    return graph
  }
  return {
    ...graph,
    entities: { ...graph.entities, [entity.id]: entity },
  }
}

export function mergeExpansion(
  graph: ExplorerGraph,
  expansion: GraphExpansion,
  limits: VisibleGraphLimits = DEFAULT_VISIBLE_LIMITS,
): MergeExpansionResult {
  const entities = { ...graph.entities }
  const relationships = { ...graph.relationships }
  const addedNodeIds: string[] = []
  const addedRelationshipIds: string[] = []
  let rejectedNodes = 0
  let rejectedRelationships = 0

  const candidates = uniqueEntities([
    expansion.center,
    ...expansion.nodes,
    ...expansion.relationships.flatMap((relationship) => [
      relationship.source,
      relationship.target,
    ]),
  ])
  for (const entity of candidates) {
    if (entities[entity.id]) {
      entities[entity.id] = entity
    } else if (Object.keys(entities).length < limits.maxNodes) {
      entities[entity.id] = entity
      addedNodeIds.push(entity.id)
    } else {
      rejectedNodes += 1
    }
  }

  for (const relationship of expansion.relationships) {
    const key = relationshipKey(relationship)
    if (relationships[key]) {
      relationships[key] = relationship
    } else if (!entities[relationship.source.id] || !entities[relationship.target.id]) {
      rejectedRelationships += 1
    } else if (Object.keys(relationships).length < limits.maxEdges) {
      relationships[key] = relationship
      addedRelationshipIds.push(key)
    } else {
      rejectedRelationships += 1
    }
  }

  return {
    graph: { entities, relationships },
    record: {
      centerId: expansion.center.id,
      addedNodeIds,
      addedRelationshipIds,
    },
    rejectedNodes,
    rejectedRelationships,
    limitReached: rejectedNodes > 0 || rejectedRelationships > 0,
  }
}

export function collapseExpansion(
  graph: ExplorerGraph,
  record: ExpansionRecord,
): ExplorerGraph {
  const relationships = { ...graph.relationships }
  for (const relationshipId of record.addedRelationshipIds) {
    delete relationships[relationshipId]
  }

  const entities = { ...graph.entities }
  for (const entityId of record.addedNodeIds) {
    const remainsConnected = Object.values(relationships).some(
      (relationship) =>
        relationship.source.id === entityId || relationship.target.id === entityId,
    )
    if (!remainsConnected) {
      delete entities[entityId]
    }
  }
  return { entities, relationships }
}

export function relationshipsForEntity(
  graph: ExplorerGraph,
  entityId: string,
): GraphRelationship[] {
  return Object.values(graph.relationships)
    .filter(
      (relationship) =>
        relationship.source.id === entityId || relationship.target.id === entityId,
    )
    .sort((left, right) => {
      const relationOrder = left.relation.localeCompare(right.relation)
      if (relationOrder !== 0) {
        return relationOrder
      }
      return relationshipKey(left).localeCompare(relationshipKey(right))
    })
}

function uniqueEntities(entities: GraphEntity[]): GraphEntity[] {
  const unique: Record<string, GraphEntity> = {}
  for (const entity of entities) {
    unique[entity.id] = entity
  }
  return Object.values(unique)
}