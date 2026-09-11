"""Tests for import resolution and cycle detection."""

import pytest
from pathlib import Path

from ingestion.imports import ImportResolver, ImportResolutionError, ResolvedImport
from ingestion.manifest import ImportPolicy


@pytest.fixture
def base_dir(tmp_path):
    return tmp_path


@pytest.fixture
def setup_files(base_dir):
    vendor_dir = base_dir / "vendor"
    vendor_dir.mkdir()
    
    # Valid file
    food_rdf = vendor_dir / "food.rdf"
    food_rdf.write_text("<rdf:RDF/>")
    
    # Changed file
    changed_rdf = vendor_dir / "changed.rdf"
    changed_rdf.write_text("<rdf:RDF/>")
    
    # Initial source that imports food
    source_rdf = base_dir / "source.rdf"
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/food"/>
            <owl:imports rdf:resource="http://example.org/changed"/>
            <owl:imports rdf:resource="http://example.org/missing"/>
            <owl:imports rdf:resource="http://example.org/network"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    return base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf


def test_import_resolution_success(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    resolver = ImportResolver(ImportPolicy(mode="vendored"), base_dir)
    # create custom checksums
    checksum = resolver._compute_sha256(food_rdf)
    
    policy = ImportPolicy(
        mode="vendored",
        vendor_dir="vendor",
        local_mappings={"http://example.org/food": "vendor/food.rdf"},
        checksums={"http://example.org/food": checksum},
        allowlist=("http://example.org/food",)
    )
    
    # Rewrite source to only import food
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/food"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    resolver = ImportResolver(policy, base_dir)
    resolved = resolver.resolve_imports([source_rdf])
    
    assert len(resolved) == 1
    assert resolved[0].import_iri == "http://example.org/food"
    assert resolved[0].local_path == food_rdf
    assert resolved[0].checksum == checksum
    assert "urn:fkg:graph:imports" in resolved[0].target_graph


def test_import_resolution_not_allowlisted(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/network"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    policy = ImportPolicy(mode="vendored")
    resolver = ImportResolver(policy, base_dir)
    
    with pytest.raises(ImportResolutionError, match="Import IRI not in allowlist"):
        resolver.resolve_imports([source_rdf])


def test_import_resolution_missing_local(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/food"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    policy = ImportPolicy(
        mode="vendored",
        allowlist=("http://example.org/food",),
        local_mappings={"http://example.org/food": "vendor/doesnotexist.rdf"}
    )
    resolver = ImportResolver(policy, base_dir)
    
    with pytest.raises(ImportResolutionError, match="Mapped local file does not exist"):
        resolver.resolve_imports([source_rdf])


def test_import_resolution_checksum_mismatch(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/food"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    policy = ImportPolicy(
        mode="vendored",
        allowlist=("http://example.org/food",),
        local_mappings={"http://example.org/food": "vendor/food.rdf"},
        checksums={"http://example.org/food": "invalid_checksum"}
    )
    resolver = ImportResolver(policy, base_dir)
    
    with pytest.raises(ImportResolutionError, match="Checksum mismatch"):
        resolver.resolve_imports([source_rdf])


def test_import_resolution_cyclic(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    # A imports B
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/b"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    # B imports A
    b_rdf = vendor_dir / "b.rdf"
    b_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/b">
            <owl:imports rdf:resource="http://example.org/a"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    # A imports B
    a_rdf = vendor_dir / "a.rdf"
    a_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/a">
            <owl:imports rdf:resource="http://example.org/b"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    resolver = ImportResolver(ImportPolicy(mode="vendored"), base_dir)
    checksum_a = resolver._compute_sha256(a_rdf)
    checksum_b = resolver._compute_sha256(b_rdf)
    
    policy = ImportPolicy(
        mode="vendored",
        allowlist=("http://example.org/b", "http://example.org/a"),
        local_mappings={"http://example.org/b": "vendor/b.rdf", "http://example.org/a": "vendor/a.rdf"},
        checksums={"http://example.org/b": checksum_b, "http://example.org/a": checksum_a}
    )
    
    resolver = ImportResolver(policy, base_dir)
    resolved = resolver.resolve_imports([source_rdf])
    
    assert len(resolved) == 2
    iris = {r.import_iri for r in resolved}
    assert iris == {"http://example.org/a", "http://example.org/b"}

def test_import_resolution_iri_mismatch(setup_files):
    base_dir, vendor_dir, source_rdf, food_rdf, changed_rdf = setup_files
    
    source_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/source">
            <owl:imports rdf:resource="http://example.org/food"/>
        </owl:Ontology>
    </rdf:RDF>
    ''')
    
    # Write a file that defines a DIFFERENT ontology IRI
    food_rdf.write_text('''
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">
        <owl:Ontology rdf:about="http://example.org/not_food"/>
    </rdf:RDF>
    ''')
    
    resolver = ImportResolver(ImportPolicy(mode="vendored"), base_dir)
    checksum = resolver._compute_sha256(food_rdf)
    
    policy = ImportPolicy(
        mode="vendored",
        allowlist=("http://example.org/food",),
        local_mappings={"http://example.org/food": "vendor/food.rdf"},
        checksums={"http://example.org/food": checksum}
    )
    resolver = ImportResolver(policy, base_dir)
    
    with pytest.raises(ImportResolutionError, match="Ontology IRI mismatch"):
        resolver.resolve_imports([source_rdf])
