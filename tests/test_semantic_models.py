from __future__ import annotations

from domain.semantic_models import (
    Annotation,
    CompactIRI,
    MultilingualLabel,
    ResourceMetadata,
    SourceProvenance,
    TypedValue,
)


def test_compact_iri_construction_and_equality() -> None:
    iri1 = CompactIRI(
        full_iri="http://example.com/demo",
        prefix="ex",
        local_name="demo",
        namespace="http://example.com/",
    )
    iri2 = CompactIRI(
        full_iri="http://example.com/demo",
        prefix="ex",
        local_name="demo",
        namespace="http://example.com/",
    )
    assert iri1 == iri2
    assert iri1.full_iri == "http://example.com/demo"
    assert iri1.prefix == "ex"
    assert iri1.local_name == "demo"
    assert iri1.namespace == "http://example.com/"

def test_compact_iri_parse_splits_correctly() -> None:
    prefix_map = {"ex": "http://example.com/"}
    iri = CompactIRI.parse("http://example.com/demo", prefix_map)
    assert iri.prefix == "ex"
    assert iri.local_name == "demo"
    assert iri.namespace == "http://example.com/"
    
    iri2 = CompactIRI.parse("http://other.com/term", prefix_map)
    assert iri2.prefix is None
    assert iri2.local_name == "term"
    assert iri2.namespace is None

def test_typed_value_preserves_attributes() -> None:
    val = TypedValue(
        lexical_form="42",
        datatype_iri="http://www.w3.org/2001/XMLSchema#integer",
        language=None,
        normalized_value=42,
    )
    assert val.lexical_form == "42"
    assert val.datatype_iri == "http://www.w3.org/2001/XMLSchema#integer"
    assert val.language is None
    assert val.normalized_value == 42


def test_resource_metadata_round_trip() -> None:
    iri = CompactIRI(
        full_iri="http://example.com/demo",
        prefix="ex",
        local_name="demo",
        namespace="http://example.com/",
    )
    label = MultilingualLabel(
        value="Demo",
        language="en",
        datatype=None,
        predicate_iri="http://www.w3.org/2000/01/rdf-schema#label",
    )
    annotation = Annotation(
        predicate_iri="http://example.com/note",
        value="Note",
        language="en",
    )
    
    metadata = ResourceMetadata(
        iri="http://example.com/demo",
        compact_iri=iri,
        semantic_kind="NAMED_INDIVIDUAL",
        asserted_types=("http://example.com/Class",),
        inferred_types=(),
        labels=(label,),
        preferred_label="Demo",
        descriptions=(),
        aliases=(),
        annotations=(annotation,),
        source_graphs=("default",),
        build_id="b1",
    )
    
    assert metadata.iri == "http://example.com/demo"
    assert metadata.compact_iri == iri
    assert metadata.semantic_kind == "NAMED_INDIVIDUAL"
    assert metadata.asserted_types == ("http://example.com/Class",)
    assert metadata.labels[0] == label
    assert metadata.annotations[0] == annotation
