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

const relationshipsQuery = `
  query GetRelationships($id: ID!) {
    get_relationships(id: $id) {
      relation
      source {
        __typename
        id
        label
        description
      }
      target {
        __typename
        id
        label
        description
      }
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

export async function getRelationships(id: string): Promise<GraphRelationship[]> {
  const response = await client.request<{
    get_relationships: GraphRelationship[]
  }>(relationshipsQuery, { id })
  return response.get_relationships
}