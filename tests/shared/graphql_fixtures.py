"""Shared GraphQL response fixtures for conformance testing.

These fixtures define canonical shapes that both the supported application
(Sprint 2) and Ontodia prototype (Sprint 3) frontends must handle correctly.
"""

from __future__ import annotations

# Canonical entity shapes
WINE_ENTITY = {
    "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgonBeaujolais",
    "label": "ChateauMorgonBeaujolais",
    "description": None,
}

WINERY_ENTITY = {
    "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgon",
    "label": "ChateauMorgon",
    "description": None,
}

REGION_ENTITY = {
    "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#BeaujolaisRegion",
    "label": "BeaujolaisRegion",
    "description": None,
}

# Canonical error responses for all 16 error codes (GQ-115)
ERROR_RESPONSES = {
    "NOT_FOUND": {
        "message": "Entity not found",
        "extensions": {"code": "NOT_FOUND"},
    },
    "INVALID_CURSOR": {
        "message": "Invalid pagination cursor",
        "extensions": {"code": "INVALID_CURSOR"},
    },
    "BUDGET_EXHAUSTED": {
        "message": "Traversal budget exceeded",
        "extensions": {"code": "BUDGET_EXHAUSTED"},
    },
    "INTERNAL_ERROR": {
        "message": "Internal server error",
        "extensions": {"code": "INTERNAL_ERROR"},
    },
    "INVALID_ARGUMENT": {
        "message": "Invalid argument provided",
        "extensions": {"code": "INVALID_ARGUMENT"},
    },
    "TIMEOUT": {
        "message": "GraphQL execution timed out",
        "extensions": {"code": "TIMEOUT"},
    },
    "CANCELLED": {
        "message": "Operation cancelled",
        "extensions": {"code": "CANCELLED"},
    },
    "FORBIDDEN": {
        "message": "Unauthorized access",
        "extensions": {"code": "FORBIDDEN"},
    },
    "STORE_NOT_READY": {
        "message": "RDF store is not ready",
        "extensions": {"code": "STORE_NOT_READY"},
    },
    "ONTOLOGY_INCONSISTENT": {
        "message": "Ontology is inconsistent",
        "extensions": {"code": "ONTOLOGY_INCONSISTENT"},
    },
    "REASONER_UNAVAILABLE": {
        "message": "Reasoner is unavailable",
        "extensions": {"code": "REASONER_UNAVAILABLE"},
    },
    "EXPLANATION_UNAVAILABLE": {
        "message": "Explanation unavailable for this relationship",
        "extensions": {"code": "EXPLANATION_UNAVAILABLE"},
    },
    "UNSUPPORTED_SEMANTIC_CONSTRUCT": {
        "message": "Unsupported semantic construct",
        "extensions": {"code": "UNSUPPORTED_SEMANTIC_CONSTRUCT"},
    },
    "BACKEND_UNAVAILABLE": {
        "message": "Backend storage unavailable",
        "extensions": {"code": "BACKEND_UNAVAILABLE"},
    },
    "INVALID_PREDICATE": {
        "message": "Invalid predicate IRI",
        "extensions": {"code": "INVALID_PREDICATE"},
    },
    "QUERY_TOO_COMPLEX": {
        "message": "Query depth exceeds maximum",
        "extensions": {"code": "QUERY_TOO_COMPLEX"},
    },
}

# Canonical relationship with provenance (RS-009)
PROVENANCE_RELATIONSHIP = {
    "source": WINE_ENTITY,
    "target": WINERY_ENTITY,
    "relation": "hasMaker",
    "predicate_iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#hasMaker",
    "predicate_label": "has maker",
    "is_inferred": False,
    "source_graph": "urn:test:asserted",
    "explanation_handle": None,
}

INFERRED_RELATIONSHIP = {
    "source": REGION_ENTITY,
    "target": {
        "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ToursRegion",
        "label": "ToursRegion",
        "description": None,
    },
    "relation": "adjacentRegion",
    "predicate_iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#adjacentRegion",
    "predicate_label": "adjacent region",
    "is_inferred": True,
    "source_graph": "urn:graph:inferred",
    "explanation_handle": None,
}

# Canonical class info (SM-006, GQ-105)
CLASS_INFO = {
    "iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#Wine",
    "compact_iri": {
        "full_iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#Wine",
        "prefix": "vin",
        "local_name": "Wine",
        "namespace": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#",
    },
    "label": "Wine",
    "direct_parents": ["http://www.w3.org/2002/07/owl#Thing"],
    "all_ancestors": ["http://www.w3.org/2002/07/owl#Thing"],
    "direct_children": [],
    "all_descendants": [],
    "equivalent_classes": [],
    "disjoint_classes": [],
    "instance_count": 0,
    "annotations": [],
    "restrictions": [],
}

# Canonical property info (SM-007, GQ-106)
PROPERTY_INFO = {
    "iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#hasMaker",
    "compact_iri": {
        "full_iri": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#hasMaker",
        "prefix": "vin",
        "local_name": "hasMaker",
        "namespace": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#",
    },
    "label": "has maker",
    "property_kind": "ObjectProperty",
    "domains": ["http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#Wine"],
    "ranges": ["http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#Winery"],
    "inverse_of": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#producesWine",
    "equivalent_properties": [],
    "sub_properties": [],
    "super_properties": [],
    "characteristics": ["FunctionalProperty"],
    "usage_count": 1,
    "annotations": [],
}

# Canonical search result (GQ-104)
SEARCH_RESULT = {
    "entities": [WINE_ENTITY],
    "total_matches": 1,
}

# Canonical expansion preview (GQ-108)
EXPANSION_PREVIEW = {
    "entity_id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgonBeaujolais",
    "total_count": 1,
    "groups": [
        {
            "relation": "hasMaker",
            "direction": "OUTGOING",
            "count": 1,
        }
    ],
}

# Canonical active profile
ACTIVE_PROFILE = {
    "metadata": {
        "package_id": "wine-kg",
        "version": "1.0.0",
        "title": "W3C Sample Wine Ontology",
        "description": "Wine ontology package profile",
        "ontology_iris": ["http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"],
    },
    "reasoning_profile": "rdfs-wine-parity",
    "build_id": "build-2026-09-19-01",
}
