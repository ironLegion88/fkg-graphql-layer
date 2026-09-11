import os
from pathlib import Path
import pytest

from domain.ontology_profile import load_ontology_profile, OntologyPackage

def test_load_wine_profile():
    profile_path = Path("config/wine-profile.yaml")
    assert profile_path.is_file(), "Wine profile does not exist"
    profile = load_ontology_profile(profile_path)
    
    assert profile.package_id == "fkg-wine"
    assert "Wine" in profile.categories
    assert "vin:Wine" in profile.categories["Wine"].class_iris
    assert "hasMaker" in profile.predicates.traversable_predicates

def test_load_pizza_profile():
    profile_path = Path("config/pizza-profile.yaml")
    assert profile_path.is_file(), "Pizza profile does not exist"
    profile = load_ontology_profile(profile_path)
    
    assert profile.package_id == "fkg-pizza"
    assert "Pizza" in profile.categories
    assert "pizza:Pizza" in profile.categories["Pizza"].class_iris
    assert "hasTopping" in profile.predicates.traversable_predicates

def test_minimal_profile_validation():
    # A valid minimal package data according to our Pydantic schema
    minimal_data = {
        "package_id": "minimal-pkg",
        "version": "1.0",
        "title": "Minimal",
        "description": "A minimal package",
        "prefixes": {"base_iri": "http://example.org/"}
    }
    pkg = OntologyPackage.model_validate(minimal_data)
    assert pkg.package_id == "minimal-pkg"
    assert len(pkg.categories) == 0

def test_missing_required_fields():
    with pytest.raises(ValueError):
        OntologyPackage.model_validate({"package_id": "test"})
