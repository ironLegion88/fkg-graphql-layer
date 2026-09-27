import { describe, expect, it } from 'vitest'
import { buildCytoscapeElements, getNodeStyling } from './CytoscapeGraph'
import type { GraphEntity, GraphRelationship, SemanticCategory } from '../interfaces/models'
import type { ExplorerGraph } from './state'

function createEntity(id: string, kind: string, label?: string): GraphEntity {
  return {
    __typename: 'GenericEntity',
    id,
    kind,
    label: label || id,
    description: null,
  }
}

function createRelationship(
  source: GraphEntity,
  target: GraphEntity,
  relation: string,
  isInferred = false,
): GraphRelationship {
  return {
    source,
    target,
    relation,
    predicate_iri: `http://example.org/${relation}`,
    predicate_label: relation,
    is_inferred: isInferred,
    source_graph: null,
    explanation_handle: null,
  }
}

describe('Cytoscape Graph Styling (GE-002, RC-001, RC-002)', () => {
  const mockCategories: SemanticCategory[] = [
    {
      name: 'Wine',
      class_iris: ['http://example.org/wine#Wine'],
      color: '#b83c50',
      icon: '🍷',
      label: 'Wine',
    },
    {
      name: 'Winery',
      class_iris: ['http://example.org/wine#Winery'],
      color: '#d7972f',
      icon: '🏰',
      label: 'Winery',
    },
  ]

  describe('node shape mappings (GE-002)', () => {
    it('maps classes to diamond shape', () => {
      const classEntity = createEntity('wine:BordeauxClass', 'Class', 'Bordeaux')
      const style = getNodeStyling(classEntity)
      expect(style.shape).toBe('diamond')

      const ontologyClassEntity = createEntity('wine:RegionClass', 'OntologyClass', 'Region')
      const style2 = getNodeStyling(ontologyClassEntity)
      expect(style2.shape).toBe('diamond')
    })

    it('maps properties to rectangle shape', () => {
      const objProp = createEntity('wine:hasMaker', 'ObjectProperty', 'has maker')
      expect(getNodeStyling(objProp).shape).toBe('rectangle')

      const dataProp = createEntity('wine:year', 'DatatypeProperty', 'year')
      expect(getNodeStyling(dataProp).shape).toBe('rectangle')

      const genericProp = createEntity('wine:prop', 'Property', 'prop')
      expect(getNodeStyling(genericProp).shape).toBe('rectangle')
    })

    it('maps individuals and domain concepts to ellipse shape', () => {
      const ind = createEntity('wine:Margaux2015', 'Individual', 'Chateau Margaux 2015')
      expect(getNodeStyling(ind).shape).toBe('ellipse')

      const wineEntity = createEntity('wine:Cabernet', 'Wine', 'Cabernet Sauvignon')
      expect(getNodeStyling(wineEntity).shape).toBe('ellipse')
    })

    it('maps unknown kinds to round-rectangle shape', () => {
      const unknownEntity = createEntity('wine:Misc', 'unknown', 'Misc')
      expect(getNodeStyling(unknownEntity).shape).toBe('round-rectangle')

      const genericEntity = createEntity('wine:Other', 'GenericEntity', 'Other')
      expect(getNodeStyling(genericEntity).shape).toBe('round-rectangle')
    })
  })

  describe('category colors and icons (GE-002, RC-002)', () => {
    it('applies color and icon from active profile categories', () => {
      const wine = createEntity('wine:Cabernet', 'Wine', 'Cabernet')
      const style = getNodeStyling(wine, mockCategories)

      expect(style.color).toBe('#b83c50')
      expect(style.icon).toBe('🍷')
      expect(style.categoryName).toBe('Wine')
    })

    it('falls back to custom categoryColors when not in profile categories', () => {
      const grape = createEntity('wine:MerlotGrape', 'grape', 'Merlot Grape')
      const customColors = { grape: '#9933cc' }
      const style = getNodeStyling(grape, mockCategories, customColors)

      expect(style.color).toBe('#9933cc')
    })
  })

  describe('edge styling: asserted vs inferred (RC-001)', () => {
    it('styles asserted edges as solid and inferred edges as dashed', () => {
      const wine = createEntity('wine:Cabernet', 'Wine', 'Cabernet')
      const winery = createEntity('wine:Winery1', 'Winery', 'Winery 1')
      const region = createEntity('wine:Bordeaux', 'Region', 'Bordeaux')

      const assertedRel = createRelationship(wine, winery, 'hasMaker', false)
      const inferredRel = createRelationship(wine, region, 'locatedIn', true)

      const graph: ExplorerGraph = {
        entities: {
          [wine.id]: wine,
          [winery.id]: winery,
          [region.id]: region,
        },
        relationships: {
          'rel:asserted': assertedRel,
          'rel:inferred': inferredRel,
        },
      }

      const elements = buildCytoscapeElements(graph, mockCategories, {}, [wine.id])

      // Find the nodes
      const wineNode = elements.find((el) => el.data.id === wine.id)
      expect(wineNode?.classes).toContain('pinned')
      expect(wineNode?.data.icon).toBe('🍷')
      expect(wineNode?.data.displayLabel).toBe('🍷 Cabernet')

      // Find the edges
      const assertedEdge = elements.find((el) => el.data.source === wine.id && el.data.target === winery.id)
      expect(assertedEdge?.data.isInferred).toBe(false)
      expect(assertedEdge?.data.lineStyle).toBe('solid')
      expect(assertedEdge?.classes).toContain('asserted-edge')

      const inferredEdge = elements.find((el) => el.data.source === wine.id && el.data.target === region.id)
      expect(inferredEdge?.data.isInferred).toBe(true)
      expect(inferredEdge?.data.lineStyle).toBe('dashed')
      expect(inferredEdge?.classes).toContain('inferred-edge')
    })
  })
})
