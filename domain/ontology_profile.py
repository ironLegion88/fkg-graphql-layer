"""Ontology package profile schema and loader."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

from ingestion.manifest import ImportPolicy, RDFFormatName, RDFSource


class SourceConfig(RDFSource):
    """Configuration for an RDF source file, extending the base RDFSource."""
    
    sha256: str | None = None


class ImportConfig(ImportPolicy):
    """Configuration for ontology imports."""
    
    local_mappings: dict[str, str] = Field(default_factory=dict)


class PrefixConfig(BaseModel):
    """Namespace and prefix configuration."""
    
    model_config = ConfigDict(frozen=True)

    base_iri: str
    prefixes: dict[str, str] = Field(default_factory=dict)


class LanguageConfig(BaseModel):
    """Preferred languages and fallback order."""
    
    model_config = ConfigDict(frozen=True)

    preferred_languages: tuple[str, ...] = ("en", "ANY")


class LabelConfig(BaseModel):
    """Predicates used for labeling and UI metadata."""
    
    model_config = ConfigDict(frozen=True)

    label_predicates: tuple[str, ...] = ("rdfs:label",)
    alternate_label_predicates: tuple[str, ...] = ()
    description_predicates: tuple[str, ...] = ("rdfs:comment",)
    image_predicates: tuple[str, ...] = ()
    identifier_predicates: tuple[str, ...] = ()


class SearchConfig(BaseModel):
    """Configuration for searchable resource scopes."""
    
    model_config = ConfigDict(frozen=True)

    searchable_classes: tuple[str, ...] = ()


class PredicateConfig(BaseModel):
    """Configuration for predicate visibility and traversal."""
    
    model_config = ConfigDict(frozen=True)

    traversable_predicates: tuple[str, ...] = ()
    hidden_predicates: tuple[str, ...] = ()
    sensitive_predicates: tuple[str, ...] = ()
    display_only_predicates: tuple[str, ...] = ()


class SemanticCategoryConfig(BaseModel):
    """Mapping of a semantic category to class IRIs and display metadata."""
    
    model_config = ConfigDict(frozen=True)

    class_iris: tuple[str, ...]
    label: str | None = None
    color: str | None = None
    icon: str | None = None


class ReasoningConfig(BaseModel):
    """Configuration for offline reasoning."""
    
    model_config = ConfigDict(frozen=True)

    profile_name: str = "none"
    provider_name: str | None = None
    provider_version: str | None = None
    timeout_seconds: int = 600
    memory_mb: int = 2048


class LimitsConfig(BaseModel):
    """Hard limits for graph operations."""
    
    model_config = ConfigDict(frozen=True)

    max_depth: int = 1
    max_nodes: int = 2000
    max_edges: int = 4000


class ValidationConfig(BaseModel):
    """Validation shapes and policies."""
    
    model_config = ConfigDict(frozen=True)

    shapes: tuple[str, ...] = ()
    policies: tuple[str, ...] = ()


class OntologyPackage(BaseModel):
    """Top-level ontology profile/manifest schema."""
    
    model_config = ConfigDict(frozen=True)

    package_id: str
    version: str
    title: str
    description: str
    ontology_iris: tuple[str, ...] = ()
    minimum_app_version: str | None = None

    sources: tuple[SourceConfig, ...] = ()
    imports: ImportConfig = Field(default_factory=ImportConfig)
    prefixes: PrefixConfig
    languages: LanguageConfig = Field(default_factory=LanguageConfig)
    labels: LabelConfig = Field(default_factory=LabelConfig)
    search: SearchConfig = Field(default_factory=SearchConfig)
    predicates: PredicateConfig = Field(default_factory=PredicateConfig)
    categories: dict[str, SemanticCategoryConfig] = Field(default_factory=dict)
    reasoning: ReasoningConfig = Field(default_factory=ReasoningConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    validation: ValidationConfig = Field(default_factory=ValidationConfig)


def load_ontology_profile(path: Path | None = None) -> OntologyPackage:
    """Load the active ontology profile from the given path or environment variable."""
    if path is None:
        env_path = os.environ.get("ONTOLOGY_PROFILE", "config/wine-profile.yaml")
        path = Path(env_path)
    
    if not path.is_file():
        raise FileNotFoundError(f"Ontology profile not found at {path}")
        
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return OntologyPackage.model_validate(raw)
