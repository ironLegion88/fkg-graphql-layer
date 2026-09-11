# **Food Knowledge Graph Platform Expansion**

## **Objective**

Extend the existing Typesense-based search into a knowledge graph platform that supports three complementary modes of interaction:

1. **Natural language recipe discovery** for end users.  
2. **Interactive Knowledge Graph exploration** for researchers and advanced users.  
3. **Direct graph querying and semantic exploration** through the frontend, exposing the underlying knowledge graph while abstracting the storage and query language.

The existing Typesense search implementation should remain functional. The goal is to augment it with graph capabilities rather than replace it.

---

# **Current Architecture**

```
Knowledge Graph
      │
Export JSONL
      │
Typesense
      │
Intent Parsing (Vector Space / NLP / LLM)
      │
Search Results
```

### **Current limitations**

The JSONL export flattens the graph into searchable documents.

As a result, the current system cannot directly expose:

* graph topology  
* neighboring entities  
* multi-hop relationships  
* inferred relationships  
* explanation of why a result exists  
* semantic composition of constraints  
* ontology structure  
* path traversal

---

# **Target Architecture**

```
                        User / Researcher
                          	    │
┌──────────────────┴───────────────────┐
│                              |                                │
Search Interface          Semantic Search  Knowledge Graph Explorer       
      │                       │                   |
      └───────┬──────┘                	  |
                   │                              |
     Intent & Entity Understanding			  |
                   │						  |
 Entity Linking			       	  |
	   |						  |
   └─────────┬────────┘
            				   |
            		     	   GraphQL API
                           		  │	
             		    Graph Service API
                    		    	 │                                      	┌────────────────┴──────────────┐
|					 |	                    |
│                          │			         |
Retrieval Service     Graph Retrieval Service	Reasoning Service
        │                      │			          |
     	   |          	          |	                     |
        |           		     |				     |
        ↓       			     |				     ↓
Typesense Search Index                          │	OWL Reasoner



   Graph Query Layer (Internal)(SPARQL / RDFLib / GraphDB APIs)

  Food Knowledge Graph (OWL / RDF)
      (Source of truth for entities and relationships)
                  Graph Database / Triple Store
           (Neo4j, Memgraph → RDF Store / GraphDB)
                                │
               RDF / OWL Ontology + SHACL Rules
                                │
                   Data Ingestion / ETL / Enrichment
				     	 │                                      	┌────────────────┴──────────────┐
|					 |	                    |
│                          │			         |	
```

### **The important design principles**

* **GraphQL** is the public API consumed by the UI and LLM.  
* **Graph Service** contains all business logic. It exposes methods like `search()`, `neighbors()`, `path()`, `expand()`, `recipesForIngredient()`, etc.  
* **Typesense** remains a search index only. It should never become the source of truth.  
* **Graph Retrieval Service** executes graph operations.  
* **Graph Query Layer** is an implementation detail. It may use Cypher today and SPARQL tomorrow. Nothing above this layer should know or care.  
* **Food Knowledge Graph** remains the canonical representation of entities and relationships.  
* **RDF/OWL** is treated as the long-term data model rather than something the intern needs to implement immediately.

**Architectural constraint:** All application components (UI, LLM, Graph Explorer) must communicate exclusively through the GraphQL API and Graph Service. No component should directly query Typesense, Neo4j, or an RDF/SPARQL endpoint. This abstraction allows the storage backend and query language to evolve without affecting the application layer.

# **Responsibilities of Each Component**

## **1\. Search Interface**

Purpose:

Continue supporting natural language search.

Responsibilities:

* Parse user intent  
* Retrieve candidate entities from Typesense  
* Display ranked search results  
* Invoke graph retrieval when additional relationship information is required

Examples:

* High protein vegetarian recipes  
* Foods rich in quercetin  
* Sources of vitamin B12

---

## **2\. Graph Explorer**

Purpose:

Allow researchers to explore the knowledge graph.

Capabilities:

* Search for an entity  
* Expand neighboring nodes  
* View incoming and outgoing relationships  
* Traverse multiple hops  
* Filter by relationship type  
* Compare connected entities

Examples:

```
Curcumin
    ↓
Turmeric
    ↓
Used In
    ↓
Recipes
```

---

## **3\. Intent & Entity Understanding**

Continue using the existing intent parsing.

Output should be structured information such as:

```
Intent:
Find Recipes

Entities:
- Paneer
- Vegetarian

Constraints:
- Protein > 25g
```

---

## **4\. Entity Linking**

Map extracted text to canonical entity IDs in the knowledge graph.

Example:

```
"paneer"

↓

ingredient:Paneer
```

This should become the starting point for graph retrieval.

---

## **5\. Graph Service API**

This is the primary new component.

No UI or LLM should directly query the graph database.

Instead, expose reusable domain operations.

Examples:

```
searchEntities()

getEntity(id)

getNeighbors(id)

expand(id, relation)

findPath(entityA, entityB)

getRecipesForIngredient(id)

getCompoundsForFood(id)

getFoodsContainingCompound(id)
```

Internally, these methods may use Neo4j today and SPARQL in the future.

The API should remain stable regardless of storage technology.

---

## **6\. Graph Retrieval**

Responsible for:

* Traversing relationships  
* Fetching neighboring entities  
* Multi-hop expansion  
* Relationship filtering  
* Path discovery

This layer complements Typesense.

Typesense finds candidate entities quickly.

Graph retrieval explains how they are connected.

---

## **7\. Food Knowledge Graph**

The graph remains the source of truth.

The JSONL exported to Typesense becomes only a search index.

The graph should retain explicit entities and relationships.

Example entity types:

* Food  
* Ingredient  
* Recipe  
* Nutrient  
* Compound  
* Disease  
* Cuisine  
* Cooking Technique

Example relationships:

* containsIngredient  
* containsCompound  
* richIn  
* belongsToCuisine  
* usedInRecipe  
* hasNutrient  
* substitutes  
* treats  
* associatedWith

The schema should be designed so it can later be represented using RDF/OWL without major restructuring.

---

# **Suggested Phases**

### **Phase 1**

* Keep existing Typesense search unchanged.  
* Design Graph Service API.  
* Add entity linking.  
* Build simple graph retrieval methods.

### **Phase 2**

* Build Graph Explorer UI.  
* Support node expansion.  
* Support neighborhood visualization.  
* Add multi-hop traversal.

### **Phase 3**

* Introduce RDF/OWL-compatible ontology.  
* Evaluate migration to an RDF graph store if required.  
* Add ontology validation and reasoning while keeping the Graph Service API unchanged.

---

# **Guiding Principle**

Treat **Typesense as a search index**, not as the knowledge graph.

The **Food Knowledge Graph is the source of truth**.

All applications should interact with the graph through the **Graph Service API**, allowing the underlying implementation to evolve from the current setup to a standards-based RDF/OWL stack without changing the user-facing interfaces.

This specification is intended to serve as the implementation blueprint for the first iteration of the graph-enabled platform.