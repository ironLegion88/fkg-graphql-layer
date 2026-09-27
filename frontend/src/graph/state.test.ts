import { describe, expect, it } from 'vitest'

import type { GraphEntity, GraphExpansion, GraphRelationship } from '../api/graph'
import {
  applyRedo,
  applyUndo,
  collapseExpansion,
  collapseNodeExpansion,
  emptyGraph,
  initialUndoRedoStack,
  mergeExpansion,
  pushUndoExpansion,
  redoExpansion,
  relationshipKey,
  relationshipsForEntity,
  removeNode,
  undoExpansion,
} from './state'

function entity(id: string): GraphEntity {
  return { __typename: 'Wine', id, label: id, description: null }
}

function relationship(source: GraphEntity, target: GraphEntity, relation: string, is_inferred = false): GraphRelationship {
  return {
    source,
    target,
    relation,
    predicate_iri: null,
    predicate_label: null,
    is_inferred,
    source_graph: null,
    explanation_handle: null,
  }
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

  describe('undo and redo expansions (GE-004)', () => {
    it('removes introduced nodes and edges on undo, and restores on redo', () => {
      const center = entity('root')
      const target = entity('child')
      const edge = relationship(center, target, 'linksTo')
      const merged = mergeExpansion(emptyGraph, expansion(center, [edge]))

      expect(merged.graph.entities.child).toBeDefined()
      expect(merged.graph.relationships[relationshipKey(edge)]).toBeDefined()

      // Undo expansion
      const undone = undoExpansion(merged.graph, merged.record)
      expect(undone.entities.child).toBeUndefined()
      expect(undone.relationships[relationshipKey(edge)]).toBeUndefined()
      // Center node was also newly added in this expansion
      expect(undone.entities.root).toBeUndefined()

      // Redo expansion
      const redone = redoExpansion(undone, merged.record)
      expect(redone.entities.child).toEqual(target)
      expect(redone.entities.root).toEqual(center)
      expect(redone.relationships[relationshipKey(edge)]).toEqual(edge)
    })

    it('preserves shared nodes during undo when another relationship references them', () => {
      const center1 = entity('n1')
      const center2 = entity('n2')
      const shared = entity('shared')
      const edge1 = relationship(center1, shared, 'rel1')
      const edge2 = relationship(center2, shared, 'rel2')

      const step1 = mergeExpansion(emptyGraph, expansion(center1, [edge1]))
      const step2 = mergeExpansion(step1.graph, expansion(center2, [edge2]))

      // Undo step 1
      const undone = undoExpansion(step2.graph, step1.record)
      expect(undone.relationships[relationshipKey(edge1)]).toBeUndefined()
      expect(undone.relationships[relationshipKey(edge2)]).toBeDefined()
      expect(undone.entities.shared).toEqual(shared)
    })

    it('manages undo/redo stack transitions correctly', () => {
      let stack = initialUndoRedoStack
      const n1 = entity('node1')
      const n2 = entity('node2')
      const exp1 = mergeExpansion(emptyGraph, expansion(n1, [relationship(n1, n2, 'rel')]))

      stack = pushUndoExpansion(stack, exp1.record)
      expect(stack.undoStack).toHaveLength(1)
      expect(stack.redoStack).toHaveLength(0)

      // Apply undo
      const undoResult = applyUndo(exp1.graph, stack)
      expect(undoResult.undoneRecord).not.toBeNull()
      expect(undoResult.stack.undoStack).toHaveLength(0)
      expect(undoResult.stack.redoStack).toHaveLength(1)
      expect(undoResult.graph.entities.node2).toBeUndefined()

      // Apply redo
      const redoResult = applyRedo(undoResult.graph, undoResult.stack)
      expect(redoResult.redoneRecord).not.toBeNull()
      expect(redoResult.stack.undoStack).toHaveLength(1)
      expect(redoResult.stack.redoStack).toHaveLength(0)
      expect(redoResult.graph.entities.node2).toEqual(n2)
    })

    it('clears redo stack when a new expansion is pushed', () => {
      let stack = initialUndoRedoStack
      const n1 = entity('node1')
      const n2 = entity('node2')
      const n3 = entity('node3')
      const exp1 = mergeExpansion(emptyGraph, expansion(n1, [relationship(n1, n2, 'rel1')]))
      const exp2 = mergeExpansion(exp1.graph, expansion(n2, [relationship(n2, n3, 'rel2')]))

      stack = pushUndoExpansion(stack, exp1.record)
      const undoRes = applyUndo(exp1.graph, stack)
      expect(undoRes.stack.redoStack).toHaveLength(1)

      // New expansion should clear redoStack
      stack = pushUndoExpansion(undoRes.stack, exp2.record)
      expect(stack.undoStack).toHaveLength(1)
      expect(stack.redoStack).toHaveLength(0)
    })
  })

  describe('node and expansion manipulation (GE-005)', () => {
    it('removes a node and its attached relationships', () => {
      const a = entity('a')
      const b = entity('b')
      const c = entity('c')
      const edgeAB = relationship(a, b, 'toB')
      const edgeBC = relationship(b, c, 'toC')

      const g = mergeExpansion(emptyGraph, expansion(a, [edgeAB, edgeBC])).graph
      expect(Object.keys(g.entities)).toHaveLength(3)

      const afterRemove = removeNode(g, 'b')
      expect(afterRemove.entities.b).toBeUndefined()
      expect(afterRemove.entities.a).toEqual(a)
      expect(afterRemove.entities.c).toEqual(c)
      expect(afterRemove.relationships[relationshipKey(edgeAB)]).toBeUndefined()
      expect(afterRemove.relationships[relationshipKey(edgeBC)]).toBeUndefined()
    })

    it('collapses the latest expansion involving a node', () => {
      const root = entity('root')
      const leaf1 = entity('leaf1')
      const leaf2 = entity('leaf2')
      const exp1 = mergeExpansion(emptyGraph, expansion(root, [relationship(root, leaf1, 'branch1')]))
      const exp2 = mergeExpansion(exp1.graph, expansion(leaf1, [relationship(leaf1, leaf2, 'branch2')]))

      let stack = pushUndoExpansion(initialUndoRedoStack, exp1.record)
      stack = pushUndoExpansion(stack, exp2.record)

      // Collapse expansion involving leaf1
      const res = collapseNodeExpansion(exp2.graph, 'leaf1', stack)
      expect(res.collapsedRecord).not.toBeNull()
      expect(res.graph.entities.leaf2).toBeUndefined()
      expect(res.graph.entities.leaf1).toEqual(leaf1)
      expect(res.stack.undoStack).toHaveLength(1)
      expect(res.stack.undoStack[0].centerId).toBe('root')
    })
  })
})