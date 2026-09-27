export interface SemanticCategory {
  name: string
  class_iris: string[]
  color: string | null
  icon: string | null
  label: string | null
}

export interface PredicateInfo {
  name: string
  iri: string | null
  label: string | null
  traversable: boolean
  hidden: boolean
}

export interface ActiveProfile {
  metadata: { title: string; description: string }
  categories: SemanticCategory[]
  predicates: PredicateInfo[]
}

export interface GraphEntity {
  __typename: string
  id: string
  label: string
  description: string | null
  kind?: string
}

export interface GraphRelationship {
  relation: string
  source: GraphEntity
  target: GraphEntity
  predicate_iri: string | null
  predicate_label: string | null
  is_inferred: boolean
  source_graph: string | null
  explanation_handle: string | null
}

export interface GraphExpansion {
  center: GraphEntity
  nodes: GraphEntity[]
  relationships: GraphRelationship[]
  page_info: {
    truncated: boolean
    next_cursor: string | null
  }
}

export type TraversalDirection = 'OUTGOING' | 'INCOMING' | 'BOTH'

export interface ExpansionRequest {
  id: string
  cursor?: string | null
  direction?: TraversalDirection
  relations?: string[]
  includeInferred?: boolean
}

export interface GraphError {
  code: string
  message: string
  details?: Record<string, unknown>
}
