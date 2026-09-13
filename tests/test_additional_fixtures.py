from __future__ import annotations
import pytest
from pathlib import Path
from pyoxigraph import Store

FIXTURES_DIR = Path(__file__).parent / "fixtures"

@pytest.mark.parametrize("fixture_name, mime_type", [
    ("dense_axioms.rdf", "application/rdf+xml"),
    ("unsupported_datatypes.rdf", "application/rdf+xml"),
    ("deep_hierarchy.rdf", "application/rdf+xml"),
])
def test_parse_additional_fixtures(fixture_name: str, mime_type: str):
    """Ensure that the additional conformance fixtures parse correctly."""
    fixture_path = FIXTURES_DIR / fixture_name
    store = Store()
    with open(fixture_path, "rb") as f:
        store.load(f, format=mime_type)
    
    # Verify that the store has ingested some triples
    assert len(store) > 0, f"Expected {fixture_name} to load triples into the store."
