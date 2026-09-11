import { GraphQLClient } from 'graphql-request'

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

const client = new GraphQLClient(
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8000/graphql',
)

const activeProfileQuery = `
  query GetActiveProfile {
    get_active_profile {
      metadata { title description }
      categories { name class_iris color icon label }
      predicates { name iri label traversable hidden }
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
      }
      page_info { truncated next_cursor }
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