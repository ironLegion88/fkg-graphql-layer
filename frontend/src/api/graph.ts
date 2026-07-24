import { GraphQLClient } from 'graphql-request'

export type EntityKind = 'WINE' | 'WINERY' | 'REGION' | 'GRAPE' | 'UNKNOWN'

export interface GraphEntity {
  __typename: string
  id: string
  label: string
  description: string | null
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

const client = new GraphQLClient(
  import.meta.env.VITE_GRAPHQL_URL ?? 'http://localhost:8000/graphql',
)

const searchEntitiesQuery = `
  query SearchEntities($query: String!) {
    search_entities(query: $query) {
      __typename
      id
      label
      description
    }
  }
`

const expansionQuery = `
  query ExpandGraph($id: ID!, $cursor: String) {
    expand_graph(
      id: $id
      options: {node_limit: 50, edge_limit: 100, cursor: $cursor}
    ) {
      center { __typename id label description }
      nodes { __typename id label description }
      relationships {
        relation
        source { __typename id label description }
        target { __typename id label description }
      }
      page_info { truncated next_cursor }
    }
  }
`

export function entityKind(entity: GraphEntity): EntityKind {
  switch (entity.__typename) {
    case 'Wine':
      return 'WINE'
    case 'Winery':
      return 'WINERY'
    case 'Region':
      return 'REGION'
    case 'Grape':
      return 'GRAPE'
    default:
      return 'UNKNOWN'
  }
}

export async function searchEntities(query: string): Promise<GraphEntity[]> {
  const response = await client.request<{ search_entities: GraphEntity[] }>(
    searchEntitiesQuery,
    { query },
  )
  return response.search_entities
}

export async function expandGraph(
  id: string,
  cursor: string | null = null,
): Promise<GraphExpansion> {
  const response = await client.request<{ expand_graph: GraphExpansion }>(
    expansionQuery,
    { id, cursor },
  )
  return response.expand_graph
}