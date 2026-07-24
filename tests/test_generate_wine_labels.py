"""Regression tests for supplemental Wine entity label generation."""

from __future__ import annotations

from pathlib import Path

from scripts.generate_wine_labels import generate_labels


def test_intersection_defined_wine_instances_receive_labels(tmp_path: Path) -> None:
    source = tmp_path / "ontology.rdf"
    destination = tmp_path / "labels.ttl"
    source.write_text(
        """<?xml version="1.0"?>
        <rdf:RDF
          xmlns="https://example.org/wine#"
          xmlns:owl="http://www.w3.org/2002/07/owl#"
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
          <owl:Class rdf:ID="Wine" />
          <owl:Class rdf:ID="WhiteWine">
            <owl:intersectionOf rdf:parseType="Collection">
              <owl:Class rdf:about="#Wine" />
            </owl:intersectionOf>
          </owl:Class>
          <owl:Class rdf:ID="Chardonnay" />
          <owl:Class rdf:about="#Chardonnay">
            <rdfs:subClassOf rdf:resource="#WhiteWine" />
          </owl:Class>
          <Chardonnay rdf:ID="DemoBottle" />
        </rdf:RDF>
        """,
        encoding="utf-8",
    )

    counts = generate_labels(source, destination)

    assert counts["Wine"] == 1
    assert 'rdfs:label "Demo Bottle"@en' in destination.read_text(encoding="utf-8")


def test_real_wine_source_includes_intersection_instances(tmp_path: Path) -> None:
    destination = tmp_path / "labels.ttl"

    counts = generate_labels(Path("wine.rdf"), destination)
    labels = destination.read_text(encoding="utf-8")

    assert counts["Wine"] > 4
    assert "Chateau Cheval Blanc St Emilion" in labels
    assert "Chateau De Meursault Meursault" in labels