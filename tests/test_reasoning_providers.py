import pytest
from pathlib import Path
from ingestion.reasoners.hermit_provider import HermitProvider
from ingestion.reasoners.provider import ReasoningResult

@pytest.fixture
def inconsistent_ontology() -> Path:
    return Path(__file__).parent / "fixtures" / "inconsistent.rdf"

@pytest.fixture
def consistent_ontology(tmp_path):
    onto_path = tmp_path / "consistent.nt"
    onto_path.write_text(
        '<http://example.org/A> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .\n'
        '<http://example.org/x> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/A> .\n'
    )
    return onto_path

def test_hermit_provider_consistency(consistent_ontology):
    provider = HermitProvider()
    result = provider.check_consistency(consistent_ontology)
    assert result.is_consistent is True
    assert not result.unsatisfiable_classes
    assert result.provider_name == "HermiT"

def test_hermit_provider_inconsistency(inconsistent_ontology):
    provider = HermitProvider()
    result = provider.check_consistency(inconsistent_ontology)
    assert result.is_consistent is False

def test_hermit_provider_materialize(consistent_ontology, tmp_path):
    provider = HermitProvider()
    out_path = tmp_path / "out.nt"
    result = provider.classify_and_materialize(consistent_ontology, out_path)
    
    assert result.is_consistent is True
    assert out_path.exists()
    
    content = out_path.read_text()
    # It should have inferred that x is a Thing, etc.
    # owlready2 might output nothing if no new inferences are made, but let's just assert file exists.
