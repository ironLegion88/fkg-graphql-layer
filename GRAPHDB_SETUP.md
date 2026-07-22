# GraphDB Setup: Labels and `wine-v2`

This project is ready to use a labeled GraphDB endpoint. Complete these steps in
GraphDB before starting the Python backend.

## Files Already Prepared

- `wine.rdf`: the original downloaded Wine ontology. Do not modify it.
- `wine-labels.ttl`: generated English starter labels for Wine, Winery, Region,
  and WineGrape instances.
- `wine-with-labels.yaml`: a copy of the exported endpoint schema with a
  `displayName` GraphQL field mapped to `rdfs:label` for those four types.

The generated labels are derived from RDF identifiers. Review and improve their
wording later; they are enough to prove the full data-to-API flow.

## 1. Import Labels

1. Open GraphDB Workbench and select repository `wine`.
2. Open **Import** and upload `wine-labels.ttl` from this project folder.
3. Import it into the named graph `http://example.org/graphs/wine-labels`.
4. Wait until GraphDB reports that the import completed.

Verify the import in GraphDB's SPARQL editor:

```sparql
PREFIX wine: <http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?entity ?label
WHERE {
  VALUES ?entity {
    wine:ChateauDYchemSauterne
    wine:ChateauDYchem
    wine:FrenchRegion
    wine:ChardonnayGrape
  }
  ?entity rdfs:label ?label .
}
```

The query should return four rows.

## 2. Create the Labeled Endpoint

1. Open **GraphQL > Endpoint Management**.
2. Choose **Import schema definition**.
3. Select `wine-with-labels.yaml` from this project folder.
4. Create the endpoint with ID `wine-v2` and activate it.
5. Ensure its data source is the `wine` repository and it includes all graphs,
   including the named labels graph from step 1.

### If You Already Created `wine-v2`

The `displayName` field must be a language-tagged literal, not a plain string.
If you created `wine-v2` before this project update, delete only that endpoint
from **GraphQL > Endpoint Management**, then repeat the five steps above using
the current `wine-with-labels.yaml`. Do not delete the `wine` repository or
reimport `wine-labels.ttl`; the labels are already stored in the repository.

## 3. Verify GraphQL Directly

Open **GraphQL > GraphQL Playground**, select `wine-v2`, and run:

```graphql
query {
  wine(limit: 3) { id displayName { value lang } }
  winery(limit: 3) { id displayName { value lang } }
  region(limit: 3) { id displayName { value lang } }
  wineGrape(limit: 3) { id displayName { value lang } }
}
```

Some values may be `null` only if their label was removed or not imported. The
generated `wine-labels.ttl` contains labels for the source instances.

## 4. Start the Python Backend

In PowerShell, in the project root:

```powershell
$env:GRAPHDB_BASE_URL = "http://localhost:7200"
$env:GRAPHDB_REPOSITORY = "wine"
$env:GRAPHDB_ENDPOINT_ID = "wine-v2"
python -m uvicorn main:app --reload
```

Then open `http://127.0.0.1:8000/graphql` and run:

```graphql
query {
  get_wine(
    id: "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#ChateauDYchemSauterne"
  ) {
    id
    label
  }
}
```

The returned `label` should be `Chateau DYchem Sauterne`.

## Regenerating Labels

If you replace `wine.rdf`, regenerate the supplemental label file from the
project root:

```powershell
python scripts/generate_wine_labels.py
```

Import the regenerated `wine-labels.ttl` again before recreating the endpoint.