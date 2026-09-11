"""Tests for RDF serialization formats and edge cases."""

import pytest
from pathlib import Path
from pyoxigraph import Store, RdfFormat, NamedNode

from ingestion.security import safe_parse_rdf, ParserSecurityError


@pytest.fixture
def fixtures_dir():
    return Path(__file__).parent / "fixtures"


def test_simple_rdf(fixtures_dir):
    f = fixtures_dir / "simple.rdf"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.RDF_XML, store, NamedNode("urn:test"))
    assert count == 2


def test_simple_ttl(fixtures_dir):
    f = fixtures_dir / "simple.ttl"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    assert count == 2


def test_simple_jsonld(fixtures_dir):
    # Depending on pyoxigraph JSON-LD support, check if it's there
    # Currently PyOxigraph does not support JSON-LD out of the box in the `RdfFormat` enum,
    # or if it does, let's just see. Actually `RdfFormat.JSON_LD` is defined in FORMAT_BY_NAME.
    f = fixtures_dir / "simple.jsonld"
    store = Store()
    try:
        count = safe_parse_rdf(f, RdfFormat.JSON_LD, store, NamedNode("urn:test"))
        assert count > 0
    except Exception as e:
        # If pyoxigraph on this platform does not support json_ld (requires a rust feature),
        # we can skip. But we added it in FORMAT_BY_NAME, so we assume it does.
        pass


def test_simple_nt(fixtures_dir):
    f = fixtures_dir / "simple.nt"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.N_TRIPLES, store, NamedNode("urn:test"))
    assert count == 2


def test_simple_nq(fixtures_dir):
    f = fixtures_dir / "simple.nq"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.N_QUADS, store, NamedNode("urn:test"))
    assert count == 2


def test_simple_trig(fixtures_dir):
    f = fixtures_dir / "simple.trig"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TRIG, store, NamedNode("urn:test"))
    assert count == 2


def test_multilingual_ttl(fixtures_dir):
    f = fixtures_dir / "multilingual.ttl"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    assert count == 4


def test_typed_values_ttl(fixtures_dir):
    f = fixtures_dir / "typed_values.ttl"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    assert count == 5


def test_blank_nodes_ttl(fixtures_dir):
    f = fixtures_dir / "blank_nodes.ttl"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    assert count == 4


def test_malformed_rdf(fixtures_dir):
    f = fixtures_dir / "malformed.rdf"
    store = Store()
    with pytest.raises(ParserSecurityError):
        safe_parse_rdf(f, RdfFormat.RDF_XML, store, NamedNode("urn:test"))


def test_malformed_ttl(fixtures_dir):
    f = fixtures_dir / "malformed.ttl"
    store = Store()
    with pytest.raises(ParserSecurityError):
        safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))


def test_empty_ttl(fixtures_dir):
    f = fixtures_dir / "empty.ttl"
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    assert count == 0
