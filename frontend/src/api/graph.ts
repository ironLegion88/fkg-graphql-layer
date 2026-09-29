import { GraphQLClient } from 'graphql-request'
import type {
  SemanticCategory,
  PredicateInfo,
  PrefixEntry,
  ProfileLimits,
  LanguageInfo,
  ProfileMetadata,
  ActiveProfile,
  GraphEntity,
  GraphRelationship,
  GraphExpansion,
  TraversalDirection,
  ExpansionRequest,
  CompactIRI,
  MultilingualLabel,
  Annotation,
  ResourceMetadata,
  ClassInfo,
  PropertyInfo,
  PreviewGroup,
  ExpansionPreview,
  SearchResult,
  SearchOptions,
  ValidationFinding,
  BuildStatus,
  PathStatus,
  GraphPath,
  PathResult,
  ComparisonResult,
  ExplanationResult,
} from '../interfaces/models'

export type {
  SemanticCategory,
  PredicateInfo,
  PrefixEntry,
  ProfileLimits,
  LanguageInfo,
  ProfileMetadata,
  ActiveProfile,
  GraphEntity,
  GraphRelationship,
  GraphExpansion,
  TraversalDirection,
  ExpansionRequest,
  CompactIRI,
  MultilingualLabel,
  Annotation,
  ResourceMetadata,
  ClassInfo,
  PropertyInfo,
  PreviewGroup,
  ExpansionPreview,
  SearchResult,
  SearchOptions,
  ValidationFinding,
  BuildStatus,
  PathStatus,
  GraphPath,
  PathResult,
  ComparisonResult,
  ExplanationResult,
}

export const client = new GraphQLClient(
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8000/graphql',
)

const activeProfileQuery = `
  query GetActiveProfile {
    get_active_profile {
      metadata {
        package_id
        version
        title
        description
        ontology_iris
      }
      prefixes {
        prefix
        iri
      }
      categories {
        name
        class_iris
        color
        icon
        label
      }
      predicates {
        name
        iri
        label
        traversable
        hidden
      }
      limits {
        max_depth
        max_nodes
        max_edges
      }
      languages {
        preferred_languages
      }
      reasoning_profile
      build_id
    }
  }
`

const searchEntitiesQuery = `
  query SearchEntities($query: String!) {
    search_entities(query: $query) {
      __typename
      id
      label
      description
      ... on OntologyEntity { kind }
    }
  }
`

const expansionQuery = `
  query ExpandGraph(
    $id: ID!
    $cursor: String
    $direction: TraversalDirection!
    $relations: [String!]
    $includeInferred: Boolean!
  ) {
    expand_graph(
      id: $id
      options: {
        node_limit: 50
        edge_limit: 100
        cursor: $cursor
        direction: $direction
        relations: $relations
        include_inferred: $includeInferred
      }
    ) {
      center { __typename id label description ... on OntologyEntity { kind } }
      nodes { __typename id label description ... on OntologyEntity { kind } }
      relationships {
        relation
        source { __typename id label description ... on OntologyEntity { kind } }
        target { __typename id label description ... on OntologyEntity { kind } }
        predicate_iri
        predicate_label
        is_inferred
        source_graph
        explanation_handle
      }
      page_info { truncated next_cursor }
    }
  }
`

const listClassesQuery = `
  query ListClasses($limit: Int, $offset: Int) {
    list_classes(limit: $limit, offset: $offset) {
      iri
      compact_iri { full_iri prefix local_name namespace }
      label
      direct_parents
      all_ancestors
      direct_children
      all_descendants
      equivalent_classes
      disjoint_classes
      instance_count
      annotations { predicate_iri value language }
      restrictions
    }
  }
`

const listPropertiesQuery = `
  query ListProperties($limit: Int, $offset: Int) {
    list_properties(limit: $limit, offset: $offset) {
      iri
      compact_iri { full_iri prefix local_name namespace }
      label
      property_kind
      domains
      ranges
      inverse_of
      equivalent_properties
      sub_properties
      super_properties
      characteristics
      usage_count
      annotations { predicate_iri value language }
    }
  }
`

const getClassInfoQuery = `
  query GetClassInfo($iri: String!) {
    get_class_info(iri: $iri) {
      iri
      compact_iri { full_iri prefix local_name namespace }
      label
      direct_parents
      all_ancestors
      direct_children
      all_descendants
      equivalent_classes
      disjoint_classes
      instance_count
      annotations { predicate_iri value language }
      restrictions
    }
  }
`

const getPropertyInfoQuery = `
  query GetPropertyInfo($iri: String!) {
    get_property_info(iri: $iri) {
      iri
      compact_iri { full_iri prefix local_name namespace }
      label
      property_kind
      domains
      ranges
      inverse_of
      equivalent_properties
      sub_properties
      super_properties
      characteristics
      usage_count
      annotations { predicate_iri value language }
    }
  }
`

const getResourceMetadataQuery = `
  query GetResourceMetadata($iri: String!) {
    get_resource_metadata(iri: $iri) {
      iri
      compact_iri { full_iri prefix local_name namespace }
      semantic_kind
      asserted_types
      inferred_types
      labels { value language datatype predicate_iri }
      preferred_label
      descriptions { value language datatype predicate_iri }
      aliases { value language datatype predicate_iri }
      annotations { predicate_iri value language }
      source_graphs
      build_id
    }
  }
`

const getExpansionPreviewQuery = `
  query GetExpansionPreview($id: ID!) {
    get_expansion_preview(id: $id) {
      entity_id
      total_count
      groups {
        relation
        direction
        count
      }
    }
  }
`

const advancedSearchQuery = `
  query AdvancedSearch($options: SearchInput!) {
    search(options: $options) {
      entities {
        __typename
        id
        label
        description
        ... on OntologyEntity { kind }
      }
      total_matches
    }
  }
`

const getBuildStatusQuery = `
  query GetBuildStatus {
    get_build_status {
      build_id
      status
      consistency
      triple_count
      inferred_count
      semantic_profile
      reasoner_status
      reasoner_name
      validation_summary
      unsatisfiable_classes
      unsupported_constructs
      findings {
        severity
        message
        focus_node
        source_shape
      }
    }
  }
`

const findPathQuery = `
  query FindPath($sourceId: ID!, $targetId: ID!) {
    find_path(source_id: $sourceId, target_id: $targetId) {
      status
      path {
        entities {
          __typename
          id
          label
          description
          ... on OntologyEntity { kind }
        }
        relations
      }
      visited_nodes
    }
  }
`

const compareEntitiesQuery = `
  query CompareEntities($idA: ID!, $idB: ID!) {
    compare(id_a: $idA, id_b: $idB) {
      common_types
      unique_types_a
      unique_types_b
      common_properties
      unique_properties_a
      unique_properties_b
      shared_neighbors {
        __typename
        id
        label
        description
        ... on OntologyEntity { kind }
      }
    }
  }
`

const getExplanationQuery = `
  query GetExplanation($handle: String!) {
    get_explanation(handle: $handle) {
      available
      proof_steps
      reasoner
      message
    }
  }
`

export function entityKind(entity: GraphEntity): string {
  if (entity.kind) {
    return entity.kind
  }
  // Fallback to typename for concrete types
  if (entity.__typename === 'GenericEntity') return 'Unknown'
  return entity.__typename
}

export async function fetchProfile(): Promise<ActiveProfile> {
  const response = await client.request<{ get_active_profile: ActiveProfile }>(activeProfileQuery)
  return response.get_active_profile
}

export async function searchEntities(query: string): Promise<GraphEntity[]> {
  const response = await client.request<{ search_entities: GraphEntity[] }>(
    searchEntitiesQuery,
    { query },
  )
  return response.search_entities
}

export async function expandGraph(
  request: ExpansionRequest,
): Promise<GraphExpansion> {
  const response = await client.request<{ expand_graph: GraphExpansion }>(
    expansionQuery,
    {
      id: request.id,
      cursor: request.cursor ?? null,
      direction: request.direction ?? 'BOTH',
      relations: request.relations?.length ? request.relations : null,
      includeInferred: request.includeInferred ?? true,
    },
  )
  return response.expand_graph
}

export async function listClasses(limit = 100, offset = 0): Promise<ClassInfo[]> {
  const response = await client.request<{ list_classes: ClassInfo[] }>(listClassesQuery, {
    limit,
    offset,
  })
  return response.list_classes
}

export async function listProperties(limit = 100, offset = 0): Promise<PropertyInfo[]> {
  const response = await client.request<{ list_properties: PropertyInfo[] }>(
    listPropertiesQuery,
    { limit, offset },
  )
  return response.list_properties
}

export async function getClassInfo(iri: string): Promise<ClassInfo | null> {
  const response = await client.request<{ get_class_info: ClassInfo | null }>(
    getClassInfoQuery,
    { iri },
  )
  return response.get_class_info
}

export async function getPropertyInfo(iri: string): Promise<PropertyInfo | null> {
  const response = await client.request<{ get_property_info: PropertyInfo | null }>(
    getPropertyInfoQuery,
    { iri },
  )
  return response.get_property_info
}

export async function getResourceMetadata(iri: string): Promise<ResourceMetadata | null> {
  const response = await client.request<{ get_resource_metadata: ResourceMetadata | null }>(
    getResourceMetadataQuery,
    { iri },
  )
  return response.get_resource_metadata
}

export async function getExpansionPreview(id: string): Promise<ExpansionPreview> {
  const response = await client.request<{ get_expansion_preview: ExpansionPreview }>(
    getExpansionPreviewQuery,
    { id },
  )
  return response.get_expansion_preview
}

export async function advancedSearch(options: SearchOptions): Promise<SearchResult> {
  const response = await client.request<{ search: SearchResult }>(advancedSearchQuery, {
    options: {
      query: options.query,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
      kinds: options.kinds && options.kinds.length > 0 ? options.kinds : null,
      require_description: options.require_description ?? false,
    },
  })
  return response.search
}

export async function getBuildStatus(): Promise<BuildStatus> {
  const response = await client.request<{ get_build_status: BuildStatus }>(getBuildStatusQuery)
  return response.get_build_status
}

export async function findPath(sourceId: string, targetId: string): Promise<PathResult> {
  const response = await client.request<{ find_path: PathResult }>(findPathQuery, {
    sourceId,
    targetId,
  })
  return response.find_path
}

export async function compareEntities(idA: string, idB: string): Promise<ComparisonResult> {
  const response = await client.request<{ compare: ComparisonResult }>(compareEntitiesQuery, {
    idA,
    idB,
  })
  return response.compare
}

export async function getExplanation(handle: string): Promise<ExplanationResult> {
  const response = await client.request<{ get_explanation: ExplanationResult }>(
    getExplanationQuery,
    { handle },
  )
  return response.get_explanation
}
