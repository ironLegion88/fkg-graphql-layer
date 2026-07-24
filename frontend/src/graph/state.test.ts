import { describe, expect, it } from 'vitest'

import type { GraphEntity, GraphExpansion, GraphRelationship } from '../api/graph'
import {
  collapseExpansion,
  emptyGraph,
  mergeExpansion,
  relationshipKey,
  relationshipsForEntity,
} from './state'

function entity(id: string): GraphEntity {
  return { __typename: 'Wine', id, label: id, description: null }
}

function relationship(source: GraphEntity, target: GraphEntity, relation: string): GraphRelationship {
  return { source, target, relation }
}

function expansion(center: GraphEntity, relationships: GraphRelationship[]): GraphExpansion {
  return {
    center,
    nodes: relationships.map((edge) => edge.target),
    relationships,
    page_info: { truncated: false, next_cursor: null },
  }
}

describe('bounded graph state', () => {
  it('enforces node and edge limits without dangling relationships', () => {
    const center = entity('center')
    const edges = [
      relationship(center, entity('one'), 'related'),
      relationship(center, entity('two'), 'related'),
      relationship(center, entity('three'), 'related'),
    ]

    const result = mergeExpansion(emptyGraph, expansion(center, edges), {
      maxNodes: 2,
      maxEdges: 1,
    })

    expect(Object.keys(result.graph.entities)).toEqual(['center', 'one'])
    expect(Object.keys(result.graph.relationships)).toHaveLength(1)
    expect(result.rejectedNodes).toBe(2)
    expect(result.rejectedRelationships).toBe(2)
    expect(result.limitReached).toBe(true)
  })

  it('deduplicates repeated nodes and relationships', () => {
    const center = entity('center')
    const edge = relationship(center, entity('one'), 'related')
    const first = mergeExpansion(emptyGraph, expansion(center, [edge]))
    const second = mergeExpansion(first.graph, expansion(center, [edge]))

    expect(Object.keys(second.graph.entities)).toHaveLength(2)
    expect(Object.keys(second.graph.relationships)).toHaveLength(1)
    expect(second.record.addedNodeIds).toEqual([])
    expect(second.record.addedRelationshipIds).toEqual([])
  })

  it('collapses introduced elements but retains nodes used by later edges', () => {
    const center = entity('center')
    const shared = entity('shared')
    const firstEdge = relationship(center, shared, 'first')
    const first = mergeExpansion(emptyGraph, expansion(center, [firstEdge]))
    const laterCenter = entity('later')
    const laterEdge = relationship(laterCenter, shared, 'second')
    const later = mergeExpansion(first.graph, expansion(laterCenter, [laterEdge]))

    const collapsed = collapseExpansion(later.graph, first.record)

    expect(collapsed.relationships[relationshipKey(firstEdge)]).toBeUndefined()
    expect(collapsed.entities.shared).toEqual(shared)
    expect(collapsed.relationships[relationshipKey(laterEdge)]).toEqual(laterEdge)
  })

  it('returns selected relationships in stable relation order', () => {
    const center = entity('center')
    const edges = [
      relationship(center, entity('two'), 'zeta'),
      relationship(center, entity('one'), 'alpha'),
    ]
    const graph = mergeExpansion(emptyGraph, expansion(center, edges)).graph

    expect(relationshipsForEntity(graph, center.id).map((edge) => edge.relation)).toEqual([
      'alpha',
      'zeta',
    ])
  })
})