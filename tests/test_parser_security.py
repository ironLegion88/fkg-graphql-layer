"""Tests for parser hardening and path security."""

import pytest
from pathlib import Path
from pyoxigraph import Store, RdfFormat, NamedNode

from ingestion.security import (
    validate_source_path,
    validate_file_size,
    safe_parse_rdf,
    PathTraversalError,
    FileSizeLimitError,
    ParserSecurityError
)


def test_validate_source_path_success(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    valid_file = root / "file.rdf"
    valid_file.write_text("<rdf/>")
    
    resolved = validate_source_path(valid_file, [root])
    assert resolved == valid_file.resolve()


def test_validate_source_path_traversal(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    
    outside = tmp_path / "outside.rdf"
    outside.write_text("<rdf/>")
    
    with pytest.raises(PathTraversalError):
        validate_source_path(root / ".." / "outside.rdf", [root])


def test_validate_source_path_absolute_outside(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    
    outside = tmp_path / "outside.rdf"
    outside.write_text("<rdf/>")
    
    with pytest.raises(PathTraversalError):
        validate_source_path(outside, [root])


def test_validate_file_size(tmp_path):
    f = tmp_path / "file.txt"
    f.write_text("12345")
    
    validate_file_size(f, max_bytes=10)  # success
    
    with pytest.raises(FileSizeLimitError):
        validate_file_size(f, max_bytes=4)


def test_safe_parse_rdf_success(tmp_path):
    f = tmp_path / "simple.ttl"
    f.write_text("<http://ex.org/s> <http://ex.org/p> <http://ex.org/o> .")
    
    store = Store()
    count = safe_parse_rdf(f, RdfFormat.TURTLE, store, NamedNode("urn:test"))
    
    assert count == 1
    assert len(store) == 1


def test_safe_parse_rdf_xxe(tmp_path):
    # PyOxigraph uses a safe parser. We expect it to not leak file contents.
    xxe = tmp_path / "xxe.rdf"
    xxe.write_text("""<?xml version="1.0"?>
    <!DOCTYPE rdf:RDF [
      <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="http://example.org/test">
        <rdf:value>&xxe;</rdf:value>
      </rdf:Description>
    </rdf:RDF>
    """)
    
    store = Store()
    # It might parse successfully but ignore external entity, or raise error.
    # PyOxigraph usually fails to parse SYSTEM entities or ignores them.
    try:
        count = safe_parse_rdf(xxe, RdfFormat.RDF_XML, store, NamedNode("urn:test"))
        # If it parsed, the value should NOT be the contents of /etc/passwd
        for t in store:
            assert "root:x" not in str(t.object)
    except ParserSecurityError:
        pass  # Expected if parser rejects SYSTEM entity


def test_safe_parse_rdf_billion_laughs(tmp_path):
    bl = tmp_path / "bl.rdf"
    bl.write_text("""<?xml version="1.0"?>
    <!DOCTYPE rdf:RDF [
      <!ENTITY lol "lol">
      <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
    ]>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about="http://example.org/test">
        <rdf:value>&lol3;</rdf:value>
      </rdf:Description>
    </rdf:RDF>
    """)
    
    store = Store()
    try:
        safe_parse_rdf(bl, RdfFormat.RDF_XML, store, NamedNode("urn:test"))
    except ParserSecurityError:
        pass
    except Exception as e:
        pytest.fail(f"Should not crash, expected ParserSecurityError or safe handling. Got: {e}")
