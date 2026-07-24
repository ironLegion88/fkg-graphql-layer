"""Typed configuration and hashing for reproducible RDF store builds."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field


RDFFormatName = Literal[
    "json-ld",
    "n-triples",
    "n-quads",
    "turtle",
    "trig",
    "n3",
    "rdf-xml",
]


class RDFSource(BaseModel):
    """One RDF serialization loaded into a named graph."""

    model_config = ConfigDict(frozen=True)

    path: str
    format: RDFFormatName
    graph: str


class ImportPolicy(BaseModel):
    """Explicit policy for ontology imports during a store build."""

    model_config = ConfigDict(frozen=True)

    mode: Literal["disabled", "vendored"] = "disabled"
    allowlist: tuple[str, ...] = ()


class RDFSourceManifest(BaseModel):
    """Versioned inputs and semantic profile for an embedded store build."""

    model_config = ConfigDict(frozen=True)

    version: int = 1
    sources: tuple[RDFSource, ...] = Field(min_length=1)
    imports: ImportPolicy = Field(default_factory=ImportPolicy)
    reasoning_profile: str = "none"


class ResolvedRDFSource(BaseModel):
    """A manifest source resolved to a local file with its content hash."""

    model_config = ConfigDict(frozen=True)

    path: Path
    manifest_path: str
    format: RDFFormatName
    graph: str
    sha256: str


def load_source_manifest(path: Path) -> RDFSourceManifest:
    """Parse and validate a YAML source manifest."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return RDFSourceManifest.model_validate(raw)


def resolve_sources(
    manifest_path: Path,
    manifest: RDFSourceManifest,
) -> tuple[ResolvedRDFSource, ...]:
    """Resolve source paths relative to the manifest and hash their contents."""
    base_directory = manifest_path.resolve().parent
    resolved: list[ResolvedRDFSource] = []
    for source in manifest.sources:
        source_path = (base_directory / source.path).resolve()
        if not source_path.is_file():
            raise FileNotFoundError(f"RDF source does not exist: {source.path}")
        resolved.append(
            ResolvedRDFSource(
                path=source_path,
                manifest_path=source.path,
                format=source.format,
                graph=source.graph,
                sha256=_sha256_file(source_path),
            )
        )
    return tuple(resolved)


def calculate_build_id(
    manifest: RDFSourceManifest,
    sources: tuple[ResolvedRDFSource, ...],
) -> str:
    """Create a stable build ID from semantic configuration and source bytes."""
    payload = {
        "version": manifest.version,
        "reasoning_profile": manifest.reasoning_profile,
        "imports": manifest.imports.model_dump(mode="json"),
        "sources": [
            {
                "path": source.manifest_path,
                "format": source.format,
                "graph": source.graph,
                "sha256": source.sha256,
            }
            for source in sources
        ],
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:20]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()