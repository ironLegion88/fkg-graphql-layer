import type { ElementDefinition } from 'cytoscape'
import { entityKind } from '../api/graph'
import { relationshipKey, type ExplorerGraph } from './state'
import type { GraphEntity, SemanticCategory } from '../interfaces/models'

export type NodeShape = 'diamond' | 'rectangle' | 'ellipse' | 'round-rectangle'

export interface NodeStyleInfo {
  shape: NodeShape
  color: string
  icon?: string | null
  categoryName: string
}

export const defaultCategoryColors: Record<string, string> = {
  wine: '#b83c50',
  winery: '#d7972f',
  region: '#287b73',
  grape: '#6c5ca4',
  pizza: '#ff5a5f',
  pizzatopping: '#00a699',
  pizzabase: '#fc642d',
  country: '#484848',
  class: '#3b82f6',
  property: '#8b5cf6',
  individual: '#10b981',
  unknown: '#6b7280',
}

/**
 * Determine node shape, color, and icon based on entity kind and profile categories.
 * RC-001, RC-002: classes = diamond, properties = rectangle, individuals = ellipse, unknown = round-rectangle.
 */
export function getNodeStyling(
  entity: GraphEntity,
  categories?: SemanticCategory[],
  categoryColors?: Record<string, string>,
): NodeStyleInfo {
  const kind = (entity.kind || entity.__typename || '').toLowerCase()

  // Match against profile semantic categories by name or class IRI
  let matchedCat: SemanticCategory | undefined
  if (categories && categories.length > 0) {
    matchedCat = categories.find(
      (cat) =>
        cat.name.toLowerCase() === kind ||
        cat.class_iris?.some(
          (iri) => iri === entity.id || iri.toLowerCase() === entity.id.toLowerCase(),
        ),
    )
  }

  // Determine node shape
  let shape: NodeShape
  if (kind === 'class' || kind === 'ontologyclass') {
    shape = 'diamond'
  } else if (
    kind === 'property' ||
    kind === 'objectproperty' ||
    kind === 'datatypeproperty' ||
    kind === 'annotationproperty'
  ) {
    shape = 'rectangle'
  } else if (kind === 'unknown' || kind === 'genericentity') {
    shape = 'round-rectangle'
  } else {
    // Entities representing domain concepts (wine, pizza, topping, etc.) are individuals
    shape = 'ellipse'
  }

  const categoryName = matchedCat?.name || entity.kind || entity.__typename || 'unknown'
  const color =
    matchedCat?.color ||
    (categoryColors && categoryColors[categoryName.toLowerCase()]) ||
    (categoryColors && categoryColors[kind]) ||
    defaultCategoryColors[categoryName.toLowerCase()] ||
    defaultCategoryColors[kind] ||
    '#287b73'

  return {
    shape,
    color,
    icon: matchedCat?.icon ?? null,
    categoryName,
  }
}

/**
 * Builds Cytoscape element definitions with profile styling, icons, and dashed/solid edges.
 * Requirements: RC-001, RC-002, GE-002
 */
export function buildCytoscapeElements(
  graph: ExplorerGraph,
  categories?: SemanticCategory[],
  categoryColors?: Record<string, string>,
  pinnedNodeIds: string[] = [],
): ElementDefinition[] {
  return [
    ...Object.values(graph.entities).map((entity) => {
      const styling = getNodeStyling(entity, categories, categoryColors)
      const isPinned = pinnedNodeIds.includes(entity.id)
      return {
        data: {
          id: entity.id,
          label: entity.label,
          category: styling.categoryName,
          shape: styling.shape,
          color: styling.color,
          icon: styling.icon || '',
          displayLabel: styling.icon ? `${styling.icon} ${entity.label}` : entity.label,
        },
        classes: [
          styling.categoryName.toLowerCase(),
          `shape-${styling.shape}`,
          entityKind(entity).toLowerCase(),
          isPinned ? 'pinned' : '',
        ]
          .filter(Boolean)
          .join(' '),
      }
    }),
    ...Object.values(graph.relationships).map((relationship) => {
      const isInferred = Boolean(relationship.is_inferred)
      const label = relationship.predicate_label || relationship.relation
      return {
        data: {
          id: relationshipKey(relationship),
          source: relationship.source.id,
          target: relationship.target.id,
          label,
          predicateLabel: relationship.predicate_label || '',
          relation: relationship.relation,
          isInferred,
          lineStyle: isInferred ? 'dashed' : 'solid',
        },
        classes: isInferred ? 'inferred-edge' : 'asserted-edge',
      }
    }),
  ]
}
