# GraphDB and Oxigraph Parity Report

- **Generated:** 2026-07-24T06:27:52.642549+00:00
- **Oxigraph build:** `6bb84d8fa462e70b2e8b`
- **Reasoning profile:** `rdfs-wine-parity`
- **Comparisons matching:** 12/14
- **Accepted differences:** 2
- **Unresolved differences:** 0

## Semantic Parity

| Section | Case | Result |
| --- | --- | --- |
| entities | grape | Match |
| entities | missing | Match |
| entities | region | Match |
| entities | wine | Match |
| entities | winery | Match |
| relationships | grape | Match |
| relationships | missing | Match |
| relationships | region | Accepted difference |
| relationships | wine | Match |
| relationships | winery | Match |
| searches | Chateau | Accepted difference |
| searches | Grape | Match |
| searches | Region | Match |
| path | configured path | Match |

## Differences

### relationships: region

**Decision:** Accepted: Oxigraph exposes the explicitly asserted SauterneRegion locatedIn BordeauxRegion edge. The generated GraphDB Region type omitted locatedIn from its schema, so the GraphDB adapter could not retrieve this source fact.

**GraphDB**

```json
{
  "status": "ok",
  "value": []
}
```

**Oxigraph**

```json
{
  "status": "ok",
  "value": [
    {
      "relation": "locatedIn",
      "source": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#SauterneRegion",
      "target": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#BordeauxRegion"
    }
  ]
}
```

### searches: Chateau

**Decision:** Accepted: Oxigraph applies the configured class-membership closure and therefore returns Wine subclass instances. The generated GraphDB wine root returned only a subset of those valid Wine individuals.

**GraphDB**

```json
{
  "status": "ok",
  "value": [
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauChevalBlanc",
      "kind": "WINERY",
      "label": "Chateau Cheval Blanc",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDYchem",
      "kind": "WINERY",
      "label": "Chateau DYchem",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDYchemSauterne",
      "kind": "WINE",
      "label": "Chateau DYchem Sauterne",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDeMeursault",
      "kind": "WINERY",
      "label": "Chateau De Meursault",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauLafiteRothschild",
      "kind": "WINERY",
      "label": "Chateau Lafite Rothschild",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMargauxWinery",
      "kind": "WINERY",
      "label": "Chateau Margaux Winery",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgon",
      "kind": "WINERY",
      "label": "Chateau Morgon",
      "properties": {}
    }
  ]
}
```

**Oxigraph**

```json
{
  "status": "ok",
  "value": [
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauChevalBlanc",
      "kind": "WINERY",
      "label": "Chateau Cheval Blanc",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauChevalBlancStEmilion",
      "kind": "WINE",
      "label": "Chateau Cheval Blanc St Emilion",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDYchem",
      "kind": "WINERY",
      "label": "Chateau DYchem",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDYchemSauterne",
      "kind": "WINE",
      "label": "Chateau DYchem Sauterne",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDeMeursault",
      "kind": "WINERY",
      "label": "Chateau De Meursault",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDeMeursaultMeursault",
      "kind": "WINE",
      "label": "Chateau De Meursault Meursault",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauLafiteRothschild",
      "kind": "WINERY",
      "label": "Chateau Lafite Rothschild",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauLafiteRothschildPauillac",
      "kind": "WINE",
      "label": "Chateau Lafite Rothschild Pauillac",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMargaux",
      "kind": "WINE",
      "label": "Chateau Margaux",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMargauxWinery",
      "kind": "WINERY",
      "label": "Chateau Margaux Winery",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgon",
      "kind": "WINERY",
      "label": "Chateau Morgon",
      "properties": {}
    },
    {
      "description": null,
      "id": "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauMorgonBeaujolais",
      "kind": "WINE",
      "label": "Chateau Morgon Beaujolais",
      "properties": {}
    }
  ]
}
```


## Warm Operation Latency

| Operation | GraphDB median (ms) | GraphDB p95 (ms) | Oxigraph median (ms) | Oxigraph p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| entity_lookup | 31.662 | 37.212 | 0.475 | 0.707 |
| relationship_lookup | 33.443 | 33.92 | 1.053 | 1.175 |
| search | 13.709 | 15.24 | 2.291 | 3.117 |
| expansion | 67.071 | 69.823 | 0.604 | 0.976 |
| path | 183.626 | 217.926 | 1.327 | 1.586 |

## Notes

- Measurements are local warm-query observations, not production capacity guarantees.
- GraphDB transport includes local HTTP and generated-schema overhead.
- Renderer benchmarks are tracked separately from repository parity.
