import type {
  GraphEntity,
  GraphExpansion,
  GraphRelationship,
} from '../interfaces/models'

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
  addedEntities?: Record<string, GraphEntity>
  addedRelationships?: Record<string, GraphRelationship>
}

export interface MergeExpansionResult {
  graph: ExplorerGraph
  record: ExpansionRecord
  rejectedNodes: number
  rejectedRelationships: number
  limitReached: boolean
}

export interface UndoRedoStack {
  undoStack: ExpansionRecord[]
  redoStack: ExpansionRecord[]
}

export const initialUndoRedoStack: UndoRedoStack = {
  undoStack: [],
  redoStack: [],
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
  const addedEntities: Record<string, GraphEntity> = {}
  const addedRelationships: Record<string, GraphRelationship> = {}
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
      addedEntities[entity.id] = entity
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
      addedRelationships[key] = relationship
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
      addedEntities,
      addedRelationships,
    },
    rejectedNodes,
    rejectedRelationships,
    limitReached: rejectedNodes > 0 || rejectedRelationships > 0,
  }
}

export function undoExpansion(
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

export function redoExpansion(
  graph: ExplorerGraph,
  record: ExpansionRecord,
  limits: VisibleGraphLimits = DEFAULT_VISIBLE_LIMITS,
): ExplorerGraph {
  const entities = { ...graph.entities }
  const relationships = { ...graph.relationships }

  if (record.addedEntities) {
    for (const [id, entity] of Object.entries(record.addedEntities)) {
      if (Object.keys(entities).length < limits.maxNodes) {
        entities[id] = entity
      }
    }
  }

  if (record.addedRelationships) {
    for (const [key, relationship] of Object.entries(record.addedRelationships)) {
      if (
        entities[relationship.source.id] &&
        entities[relationship.target.id] &&
        Object.keys(relationships).length < limits.maxEdges
      ) {
        relationships[key] = relationship
      }
    }
  }

  return { entities, relationships }
}

export function collapseExpansion(
  graph: ExplorerGraph,
  record: ExpansionRecord,
): ExplorerGraph {
  return undoExpansion(graph, record)
}

export function pushUndoExpansion(
  stack: UndoRedoStack,
  record: ExpansionRecord,
  maxHistory = 20,
): UndoRedoStack {
  return {
    undoStack: [...stack.undoStack.slice(-(maxHistory - 1)), record],
    redoStack: [], // New action clears redo stack
  }
}

export function applyUndo(
  graph: ExplorerGraph,
  stack: UndoRedoStack,
): { graph: ExplorerGraph; stack: UndoRedoStack; undoneRecord: ExpansionRecord | null } {
  if (stack.undoStack.length === 0) {
    return { graph, stack, undoneRecord: null }
  }
  const undoneRecord = stack.undoStack[stack.undoStack.length - 1]
  const newGraph = undoExpansion(graph, undoneRecord)
  return {
    graph: newGraph,
    stack: {
      undoStack: stack.undoStack.slice(0, -1),
      redoStack: [...stack.redoStack, undoneRecord],
    },
    undoneRecord,
  }
}

export function applyRedo(
  graph: ExplorerGraph,
  stack: UndoRedoStack,
  limits: VisibleGraphLimits = DEFAULT_VISIBLE_LIMITS,
): { graph: ExplorerGraph; stack: UndoRedoStack; redoneRecord: ExpansionRecord | null } {
  if (stack.redoStack.length === 0) {
    return { graph, stack, redoneRecord: null }
  }
  const redoneRecord = stack.redoStack[stack.redoStack.length - 1]
  const newGraph = redoExpansion(graph, redoneRecord, limits)
  return {
    graph: newGraph,
    stack: {
      undoStack: [...stack.undoStack, redoneRecord],
      redoStack: stack.redoStack.slice(0, -1),
    },
    redoneRecord,
  }
}

/**
 * Remove a specific node and all connected edges from the visible graph (GE-005).
 */
export function removeNode(
  graph: ExplorerGraph,
  nodeId: string,
): ExplorerGraph {
  if (!graph.entities[nodeId]) {
    return graph
  }

  const entities = { ...graph.entities }
  delete entities[nodeId]

  const relationships = { ...graph.relationships }
  for (const [key, relationship] of Object.entries(relationships)) {
    if (relationship.source.id === nodeId || relationship.target.id === nodeId) {
      delete relationships[key]
    }
  }

  return { entities, relationships }
}

/**
 * Collapse the latest expansion involving a specific node (GE-005).
 */
export function collapseNodeExpansion(
  graph: ExplorerGraph,
  nodeId: string,
  stack: UndoRedoStack,
): { graph: ExplorerGraph; stack: UndoRedoStack; collapsedRecord: ExpansionRecord | null } {
  const index = stack.undoStack.findLastIndex(
    (record) => record.centerId === nodeId || record.addedNodeIds.includes(nodeId),
  )
  if (index === -1) {
    return { graph, stack, collapsedRecord: null }
  }

  const record = stack.undoStack[index]
  const newGraph = undoExpansion(graph, record)
  const newUndoStack = [
    ...stack.undoStack.slice(0, index),
    ...stack.undoStack.slice(index + 1),
  ]

  return {
    graph: newGraph,
    stack: {
      undoStack: newUndoStack,
      redoStack: [...stack.redoStack, record],
    },
    collapsedRecord: record,
  }
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