from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

SemanticKind = Literal[
    "OWL_CLASS",
    "NAMED_INDIVIDUAL",
    "OBJECT_PROPERTY",
    "DATATYPE_PROPERTY",
    "ANNOTATION_PROPERTY",
    "RDF_PROPERTY",
    "LITERAL",
    "ANONYMOUS_EXPRESSION",
    "AXIOM",
    "ONTOLOGY",
    "DATATYPE",
    "UNKNOWN",
]

@dataclass(frozen=True, slots=True)
class CompactIRI:
    full_iri: str
    prefix: str | None
    local_name: str
    namespace: str | None
    
    @classmethod
    def parse(cls, full_iri: str, prefix_map: dict[str, str]) -> CompactIRI:
        for prefix, ns in prefix_map.items():
            if full_iri.startswith(ns):
                local_name = full_iri[len(ns):]
                return cls(full_iri, prefix, local_name, ns)
        
        local_name = full_iri.rsplit("#", maxsplit=1)[-1]
        if local_name == full_iri:
            local_name = full_iri.rstrip("/").rsplit("/", maxsplit=1)[-1]
        
        return cls(full_iri, None, local_name, None)

@dataclass(frozen=True, slots=True)
class TypedValue:
    lexical_form: str
    datatype_iri: str | None
    language: str | None
    normalized_value: str | int | float | bool | None

@dataclass(frozen=True, slots=True)
class MultilingualLabel:
    value: str
    language: str | None
    datatype: str | None
    predicate_iri: str

@dataclass(frozen=True, slots=True)
class Annotation:
    predicate_iri: str
    value: TypedValue | str
    language: str | None

@dataclass(frozen=True, slots=True)
class SourceProvenance:
    source_graph: str | None
    build_id: str | None
    is_inferred: bool

@dataclass(frozen=True, slots=True)
class ResourceMetadata:
    iri: str
    compact_iri: CompactIRI | None
    semantic_kind: SemanticKind
    asserted_types: tuple[str, ...]
    inferred_types: tuple[str, ...]
    labels: tuple[MultilingualLabel, ...]
    preferred_label: str
    descriptions: tuple[MultilingualLabel, ...]
    aliases: tuple[MultilingualLabel, ...]
    annotations: tuple[Annotation, ...]
    source_graphs: tuple[str, ...]
    build_id: str | None

@dataclass(frozen=True, slots=True)
class ClassInfo:
    iri: str
    compact_iri: CompactIRI | None
    label: str
    direct_parents: tuple[str, ...]
    all_ancestors: tuple[str, ...]
    direct_children: tuple[str, ...]
    all_descendants: tuple[str, ...]
    equivalent_classes: tuple[str, ...]
    disjoint_classes: tuple[str, ...]
    instance_count: int
    annotations: tuple[Annotation, ...]
    restrictions: tuple[str, ...] = ()

@dataclass(frozen=True, slots=True)
class PropertyInfo:
    iri: str
    compact_iri: CompactIRI | None
    label: str
    property_kind: SemanticKind
    domains: tuple[str, ...]
    ranges: tuple[str, ...]
    inverse_of: str | None
    equivalent_properties: tuple[str, ...]
    sub_properties: tuple[str, ...]
    super_properties: tuple[str, ...]
    characteristics: tuple[str, ...]
    usage_count: int
    annotations: tuple[Annotation, ...]
