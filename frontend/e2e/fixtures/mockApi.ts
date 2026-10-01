import type { Page } from '@playwright/test';

let currentMockPathStatus = 'FOUND';
export function setMockPathStatus(status: string) {
  currentMockPathStatus = status;
}

export const mockProfile = {
  metadata: {
    package_id: 'fkg-food',
    version: '1.0.0',
    title: 'Indian Food Knowledge Graph',
    description: 'Indian Food ontology and recipe knowledge graph.',
    ontology_iris: ['http://foodkg.org/ontology/food'],
  },
  prefixes: [
    { prefix: 'food', iri: 'http://foodkg.org/ontology/food#' },
    { prefix: 'owl', iri: 'http://www.w3.org/2002/07/owl#' },
    { prefix: 'rdfs', iri: 'http://www.w3.org/2000/01/rdf-schema#' },
    { prefix: 'rdf', iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
  ],
  categories: [
    { name: 'Recipe', class_iris: ['http://foodkg.org/ontology/food#Recipe'], color: '#e65100', icon: 'utensils', label: 'Recipe' },
    { name: 'Dish', class_iris: ['http://foodkg.org/ontology/food#Dish'], color: '#b83c50', icon: 'soup', label: 'Dish' },
    { name: 'Ingredient', class_iris: ['http://foodkg.org/ontology/food#Ingredient'], color: '#2e7d32', icon: 'carrot', label: 'Ingredient' },
    { name: 'Cuisine', class_iris: ['http://foodkg.org/ontology/food#Cuisine'], color: '#d7972f', icon: 'globe', label: 'Cuisine' },
    { name: 'Region', class_iris: ['http://foodkg.org/ontology/food#Region'], color: '#0277bd', icon: 'map-pin', label: 'Region' },
  ],
  predicates: [
    { name: 'hasIngredient', iri: 'http://foodkg.org/ontology/food#hasIngredient', label: 'has ingredient', traversable: true, hidden: false },
    { name: 'hasCuisine', iri: 'http://foodkg.org/ontology/food#hasCuisine', label: 'has cuisine', traversable: true, hidden: false },
    { name: 'hasRegion', iri: 'http://foodkg.org/ontology/food#hasRegion', label: 'has region', traversable: true, hidden: false },
    { name: 'belongsToDiet', iri: 'http://foodkg.org/ontology/food#belongsToDiet', label: 'belongs to diet', traversable: true, hidden: false },
    { name: 'pairsWellWith', iri: 'http://foodkg.org/ontology/food#pairsWellWith', label: 'pairs well with', traversable: true, hidden: false },
  ],
  limits: {
    max_depth: 2,
    max_nodes: 5000,
    max_edges: 10000,
  },
  languages: {
    preferred_languages: ['en', 'hi', 'ANY'],
  },
  reasoning_profile: 'rdfs-parity',
  build_id: 'ca3f45ba12d4e1892790',
};

export const mockEntities = {
  recipeBiryani: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Recipe_1_Biryani',
    label: 'Authentic Hyderabadi Biryani Recipe',
    description: 'Traditional layered spiced rice and meat preparation.',
    kind: 'Recipe',
  },
  dishBiryani: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Dish_Hyderabadi_Dum_Biryani',
    label: 'Hyderabadi Dum Biryani',
    description: 'Iconic royal rice dish cooked in sealed pot.',
    kind: 'Dish',
  },
  ingRice: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Ingredient_Basmati_Rice',
    label: 'Basmati Rice',
    description: 'Aromatic long-grain rice.',
    kind: 'Ingredient',
  },
  ingSaffron: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Ingredient_Saffron',
    label: 'Saffron Strands',
    description: 'Delicate floral aroma and golden color.',
    kind: 'Ingredient',
  },
  cuisineHyd: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Cuisine_Hyderabadi',
    label: 'Hyderabadi Cuisine',
    description: 'Deccani culinary tradition blending Mughlai and Telugu flavors.',
    kind: 'Cuisine',
  },
  dishRaita: {
    __typename: 'OntologyEntity',
    id: 'http://foodkg.org/ontology/food#Dish_Mirchi_Ka_Salan',
    label: 'Mirchi Ka Salan',
    description: 'Spicy chili and peanut gravy side dish.',
    kind: 'Dish',
  },
};

export async function setupMockGraphQL(page: Page, overrides: Record<string, unknown> = {}) {
  await page.route('**/graphql', async (route) => {
    const postData = route.request().postDataJSON();
    const query = postData?.query || '';
    const variables = postData?.variables || {};

    if (query.includes('GetActiveProfile')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_active_profile: mockProfile,
          },
        }),
      });
      return;
    }

    if (query.includes('SearchEntities') || query.includes('AdvancedSearch')) {
      const q = (variables.query || '').toLowerCase();
      const all = Object.values(mockEntities);
      const matches = all.filter(
        (e) => e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            search_entities: matches,
            search: {
              entities: matches.length > 0 ? matches : all,
              total_matches: matches.length > 0 ? matches.length : all.length,
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetExpansionPreview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_expansion_preview: {
              entity_id: variables.id,
              total_count: 3,
              groups: [
                { relation: 'hasIngredient', direction: 'OUTGOING', count: 2 },
                { relation: 'hasCuisine', direction: 'OUTGOING', count: 1 },
              ],
            },
          },
        }),
      });
      return;
    }

    if (query.includes('ExpandGraph') || query.includes('expand_graph')) {
      const entityId = variables.id || mockEntities.recipeBiryani.id;
      const isBiryani = entityId.includes('Biryani');
      const centerEntity = isBiryani ? mockEntities.recipeBiryani : mockEntities.dishBiryani;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            expand_graph: {
              center: centerEntity,
              nodes: [
                centerEntity,
                mockEntities.ingRice,
                mockEntities.ingSaffron,
                mockEntities.cuisineHyd,
              ],
              relationships: [
                {
                  source: centerEntity,
                  relation: 'hasIngredient',
                  target: mockEntities.ingRice,
                  predicate_iri: 'http://foodkg.org/ontology/food#hasIngredient',
                  predicate_label: 'has ingredient',
                  is_inferred: false,
                  source_graph: 'urn:fkg:graph:asserted',
                  explanation_handle: null,
                },
                {
                  source: centerEntity,
                  relation: 'hasIngredient',
                  target: mockEntities.ingSaffron,
                  predicate_iri: 'http://foodkg.org/ontology/food#hasIngredient',
                  predicate_label: 'has ingredient',
                  is_inferred: false,
                  source_graph: 'urn:fkg:graph:asserted',
                  explanation_handle: null,
                },
                {
                  source: centerEntity,
                  relation: 'hasCuisine',
                  target: mockEntities.cuisineHyd,
                  predicate_iri: 'http://foodkg.org/ontology/food#hasCuisine',
                  predicate_label: 'has cuisine',
                  is_inferred: true,
                  source_graph: 'urn:fkg:graph:inferred',
                  explanation_handle: 'expl_hyd_cuisine_1',
                },
              ],
              page_info: {
                truncated: false,
                next_cursor: null,
              },
            },
          },
        }),
      });
      return;
    }

    if (query.includes('ListClasses') || query.includes('list_classes')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            list_classes: [
              {
                iri: 'http://foodkg.org/ontology/food#Recipe',
                compact_iri: { full_iri: 'http://foodkg.org/ontology/food#Recipe', prefix: 'food', local_name: 'Recipe' },
                label: 'Recipe',
                direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
                all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
                direct_children: [],
                all_descendants: [],
                equivalent_classes: [],
                disjoint_classes: [],
                instance_count: 500,
                restrictions: [],
              },
              {
                iri: 'http://foodkg.org/ontology/food#Dish',
                compact_iri: { full_iri: 'http://foodkg.org/ontology/food#Dish', prefix: 'food', local_name: 'Dish' },
                label: 'Dish',
                direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
                all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
                direct_children: [],
                all_descendants: [],
                equivalent_classes: [],
                disjoint_classes: [],
                instance_count: 100,
                restrictions: [],
              },
              {
                iri: 'http://foodkg.org/ontology/food#Ingredient',
                compact_iri: { full_iri: 'http://foodkg.org/ontology/food#Ingredient', prefix: 'food', local_name: 'Ingredient' },
                label: 'Ingredient',
                direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
                all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
                direct_children: [],
                all_descendants: [],
                equivalent_classes: [],
                disjoint_classes: [],
                instance_count: 200,
                restrictions: [],
              },
            ],
          },
        }),
      });
      return;
    }

    if (query.includes('ListProperties') || query.includes('list_properties')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            list_properties: [
              {
                iri: 'http://foodkg.org/ontology/food#hasIngredient',
                compact_iri: { full_iri: 'http://foodkg.org/ontology/food#hasIngredient', prefix: 'food', local_name: 'hasIngredient' },
                label: 'has ingredient',
                property_kind: 'ObjectProperty',
                domains: ['http://foodkg.org/ontology/food#Recipe'],
                ranges: ['http://foodkg.org/ontology/food#Ingredient'],
                inverse_of: null,
                characteristics: [],
                usage_count: 2500,
              },
              {
                iri: 'http://foodkg.org/ontology/food#hasCuisine',
                compact_iri: { full_iri: 'http://foodkg.org/ontology/food#hasCuisine', prefix: 'food', local_name: 'hasCuisine' },
                label: 'has cuisine',
                property_kind: 'ObjectProperty',
                domains: ['http://foodkg.org/ontology/food#Recipe'],
                ranges: ['http://foodkg.org/ontology/food#Cuisine'],
                inverse_of: null,
                characteristics: [],
                usage_count: 500,
              },
            ],
          },
        }),
      });
      return;
    }

    if (query.includes('GetResourceMetadata') || query.includes('get_resource_metadata')) {
      const iri = variables.iri || mockEntities.recipeBiryani.id;
      const isClass = iri.includes('Recipe') && !iri.includes('_1_');
      const isProp = iri.includes('has');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_resource_metadata: {
              iri,
              compact_iri: { full_iri: iri, prefix: 'food', local_name: iri.split('#').pop() || iri },
              semantic_kind: isClass ? 'Class' : isProp ? 'Property' : 'NamedIndividual',
              asserted_types: [isClass ? 'http://www.w3.org/2002/07/owl#Class' : isProp ? 'http://www.w3.org/2002/07/owl#ObjectProperty' : 'http://foodkg.org/ontology/food#Recipe'],
              inferred_types: ['http://www.w3.org/2002/07/owl#Thing'],
              labels: [{ value: 'Hyderabadi Dum Biryani', language: 'en', predicate_iri: 'http://www.w3.org/2000/01/rdf-schema#label' }],
              preferred_label: 'Hyderabadi Dum Biryani',
              descriptions: [{ value: 'Rich spiced rice dish cooked dum-style.', language: 'en', predicate_iri: 'http://www.w3.org/2000/01/rdf-schema#comment' }],
              annotations: [],
              source_graphs: ['urn:fkg:graph:asserted'],
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetClassInfo') || query.includes('get_class_info')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_class_info: {
              iri: 'http://foodkg.org/ontology/food#Recipe',
              compact_iri: { full_iri: 'http://foodkg.org/ontology/food#Recipe', prefix: 'food', local_name: 'Recipe' },
              label: 'Recipe',
              direct_parents: ['http://www.w3.org/2002/07/owl#Thing'],
              all_ancestors: ['http://www.w3.org/2002/07/owl#Thing'],
              direct_children: [],
              all_descendants: [],
              equivalent_classes: [],
              disjoint_classes: [],
              instance_count: 500,
              restrictions: [],
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetPropertyInfo') || query.includes('get_property_info')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_property_info: {
              iri: 'http://foodkg.org/ontology/food#hasIngredient',
              compact_iri: { full_iri: 'http://foodkg.org/ontology/food#hasIngredient', prefix: 'food', local_name: 'hasIngredient' },
              label: 'has ingredient',
              property_kind: 'ObjectProperty',
              domains: ['http://foodkg.org/ontology/food#Recipe'],
              ranges: ['http://foodkg.org/ontology/food#Ingredient'],
              inverse_of: null,
              characteristics: [],
              usage_count: 2500,
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetBuildStatus') || query.includes('get_build_status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_build_status: {
              build_id: 'ca3f45ba12d4e1892790',
              created_at: '2026-09-29T10:00:00Z',
              is_consistent: true,
              total_triples: 16263,
              inferred_triples: 2456,
              reasoner_name: 'rdfs-parity',
              unsatisfiable_classes: [],
              validation_findings: [],
            },
          },
        }),
      });
      return;
    }

    if (query.includes('FindPath') || query.includes('find_path')) {
      const statusOverride = currentMockPathStatus || (overrides.pathStatus as string) || 'FOUND';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            find_path: {
              status: statusOverride,
              path: statusOverride === 'FOUND' ? {
                entities: [mockEntities.recipeBiryani, mockEntities.dishBiryani],
                relations: ['servedAs'],
              } : null,
              visited_nodes: 14,
              execution_time_ms: 12.5,
              truncated: false,
            },
          },
        }),
      });
      return;
    }

    if (query.includes('CompareEntities') || query.includes('compare_entities') || query.includes('compare(')) {
      const compData = {
        entity_a: mockEntities.recipeBiryani,
        entity_b: mockEntities.dishBiryani,
        common_types: ['http://foodkg.org/ontology/food#CulinaryEntity'],
        unique_types_a: ['http://foodkg.org/ontology/food#Recipe'],
        unique_types_b: ['http://foodkg.org/ontology/food#Dish'],
        common_properties: ['http://foodkg.org/ontology/food#hasCuisine'],
        unique_properties_a: ['http://foodkg.org/ontology/food#hasIngredient'],
        unique_properties_b: ['http://foodkg.org/ontology/food#pairsWellWith'],
        shared_neighbors: [mockEntities.cuisineHyd],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            compare: compData,
            compare_entities: compData,
          },
        }),
      });
      return;
    }

    if (query.includes('GetExplanation') || query.includes('get_explanation')) {
      const handle = variables.handle;
      const unavailable = handle === 'unavailable';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_explanation: unavailable ? null : {
              handle,
              is_inferred: true,
              rule_name: 'rdfs:subClassOf-transitivity',
              explanation_text: 'Entity is inferred to belong to Hyderabadi Cuisine via recipe inheritance.',
              proof_steps: [
                'Fact 1: Recipe hasCuisine Hyderabadi',
                'Fact 2: Hyderabadi is SubCuisine of Indian',
              ],
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetOverview') || query.includes('get_overview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_overview: {
              clusters: [
                { class_iri: 'http://foodkg.org/ontology/food#Recipe', label: 'Recipe', instance_count: 500, color: '#e65100' },
                { class_iri: 'http://foodkg.org/ontology/food#Dish', label: 'Dish', instance_count: 100, color: '#b83c50' },
                { class_iri: 'http://foodkg.org/ontology/food#Ingredient', label: 'Ingredient', instance_count: 200, color: '#2e7d32' },
                { class_iri: 'http://foodkg.org/ontology/food#Cuisine', label: 'Cuisine', instance_count: 50, color: '#d7972f' },
                { class_iri: 'http://foodkg.org/ontology/food#Region', label: 'Region', instance_count: 30, color: '#0277bd' },
              ],
              edges: [
                { source_class: 'http://foodkg.org/ontology/food#Recipe', target_class: 'http://foodkg.org/ontology/food#Ingredient', predicate: 'hasIngredient', count: 2500 },
                { source_class: 'http://foodkg.org/ontology/food#Recipe', target_class: 'http://foodkg.org/ontology/food#Cuisine', predicate: 'hasCuisine', count: 500 },
                { source_class: 'http://foodkg.org/ontology/food#Recipe', target_class: 'http://foodkg.org/ontology/food#Dish', predicate: 'servedAs', count: 500 },
              ],
              total_instances: 880,
              total_relationships: 3500,
            },
          },
        }),
      });
      return;
    }

    if (query.includes('GetClassInstances') || query.includes('get_class_instances')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            get_class_instances: [
              mockEntities.recipeBiryani,
            ],
          },
        }),
      });
      return;
    }

    // Default fallback
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}
