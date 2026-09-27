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

export interface PrefixEntry {
  prefix: string
  iri: string
}

export interface ProfileLimits {
  max_depth: number
  max_nodes: number
  max_edges: number
}

export interface LanguageInfo {
  preferred_languages: string[]
}

export interface ProfileMetadata {
  package_id?: string
  version?: string
  title: string
  description: string
  ontology_iris?: string[]
}

export interface ActiveProfile {
  metadata: ProfileMetadata
  prefixes: PrefixEntry[]
  categories: SemanticCategory[]
  predicates: PredicateInfo[]
  limits: ProfileLimits
  languages: LanguageInfo
  reasoning_profile: string
  build_id: string | null
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

export interface CompactIRI {
  full_iri: string
  prefix: string | null
  local_name: string
  namespace?: string | null
}

export interface MultilingualLabel {
  value: string
  language: string | null
  datatype?: string | null
  predicate_iri: string
}

export interface Annotation {
  predicate_iri: string
  value: string
  language: string | null
}

export interface ResourceMetadata {
  iri: string
  compact_iri: CompactIRI | null
  semantic_kind: string
  asserted_types: string[]
  inferred_types: string[]
  labels: MultilingualLabel[]
  preferred_label: string
  descriptions: MultilingualLabel[]
  aliases?: MultilingualLabel[]
  annotations: Annotation[]
  source_graphs: string[]
  build_id: string | null
}

export interface ClassInfo {
  iri: string
  compact_iri: CompactIRI | null
  label: string
  direct_parents: string[]
  all_ancestors: string[]
  direct_children: string[]
  all_descendants: string[]
  equivalent_classes: string[]
  disjoint_classes: string[]
  instance_count: number
  annotations: Annotation[]
  restrictions: string[]
}

export interface PropertyInfo {
  iri: string
  compact_iri: CompactIRI | null
  label: string
  property_kind: string
  domains: string[]
  ranges: string[]
  inverse_of: string | null
  equivalent_properties?: string[]
  sub_properties?: string[]
  super_properties?: string[]
  characteristics: string[]
  usage_count: number
  annotations: Annotation[]
}

export interface PreviewGroup {
  relation: string
  direction: TraversalDirection
  count: number
}

export interface ExpansionPreview {
  entity_id: string
  total_count: number
  groups: PreviewGroup[]
}

export interface SearchResult {
  entities: GraphEntity[]
  total_matches: number
}

export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  kinds?: string[]
  require_description?: boolean
}
