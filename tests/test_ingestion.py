"""Integration tests for reproducible and atomic Oxigraph store builds."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from pyoxigraph import Store

from ingestion.build_store import build_store


def _write_manifest(
    directory: Path,
    source_name: str = "source.ttl",
    reasoning_profile: str = "none",
) -> Path:
    manifest = {
        "version": 1,
        "sources": [
            {
                "path": source_name,
                "format": "turtle",
                "graph": "urn:test:asserted",
            }
        ],
        "imports": {"mode": "disabled", "allowlist": []},
        "reasoning_profile": reasoning_profile,
    }
    path = directory / "sources.yaml"
    path.write_text(yaml.safe_dump(manifest, sort_keys=False), encoding="utf-8")
    return path


def test_builds_reuses_and_promotes_content_addressed_store(tmp_path: Path) -> None:
    (tmp_path / "source.ttl").write_text(
        '@prefix ex: <https://example.org/> . ex:item ex:label "Item"@en .\n',
        encoding="utf-8",
    )
    manifest_path = _write_manifest(tmp_path)
    output_root = tmp_path / "output"

    first = build_store(manifest_path, output_root)
    second = build_store(manifest_path, output_root)

    assert first.reused is False
    assert first.triple_count == 1
    assert second.reused is True
    assert second.build_id == first.build_id
    active = json.loads((output_root / "current.json").read_text(encoding="utf-8"))
    assert active["build_id"] == first.build_id
    assert active["triple_count"] == 1

    store = Store.read_only(str(Path(first.build_path) / "store"))
    assert len(store) == 1


def test_source_change_produces_new_build_id(tmp_path: Path) -> None:
    source = tmp_path / "source.ttl"
    source.write_text('<https://example.org/a> <https://example.org/p> "1" .\n', encoding="utf-8")
    manifest_path = _write_manifest(tmp_path)
    output_root = tmp_path / "output"
    first = build_store(manifest_path, output_root)

    source.write_text('<https://example.org/a> <https://example.org/p> "2" .\n', encoding="utf-8")
    second = build_store(manifest_path, output_root)

    assert second.build_id != first.build_id
    active = json.loads((output_root / "current.json").read_text(encoding="utf-8"))
    assert active["build_id"] == second.build_id


def test_dry_run_validates_sources_without_writing_store(tmp_path: Path) -> None:
    (tmp_path / "source.ttl").write_text(
        '<https://example.org/a> <https://example.org/p> "1" .\n',
        encoding="utf-8",
    )
    result = build_store(_write_manifest(tmp_path), tmp_path / "output", dry_run=True)

    assert result.dry_run is True
    assert not (tmp_path / "output").exists()


def test_invalid_source_does_not_replace_active_build(tmp_path: Path) -> None:
    source = tmp_path / "source.ttl"
    source.write_text('<https://example.org/a> <https://example.org/p> "valid" .\n', encoding="utf-8")
    manifest_path = _write_manifest(tmp_path)
    output_root = tmp_path / "output"
    valid = build_store(manifest_path, output_root)

    source.write_text("this is not valid turtle", encoding="utf-8")
    with pytest.raises((SyntaxError, RuntimeError)):
        build_store(manifest_path, output_root)

    active = json.loads((output_root / "current.json").read_text(encoding="utf-8"))
    assert active["build_id"] == valid.build_id


def test_missing_source_is_rejected_before_output_creation(tmp_path: Path) -> None:
    manifest_path = _write_manifest(tmp_path, "missing.ttl")

    with pytest.raises(FileNotFoundError, match="RDF source does not exist"):
        build_store(manifest_path, tmp_path / "output")

    assert not (tmp_path / "output").exists()


def test_build_applies_configured_semantic_profile(tmp_path: Path) -> None:
    (tmp_path / "source.ttl").write_text(
        """
        @prefix ex: <https://example.org/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        ex:Wine a owl:Class .
        ex:Chardonnay a owl:Class ; rdfs:subClassOf ex:Wine .
        ex:bottle a ex:Chardonnay .
        """,
        encoding="utf-8",
    )
    result = build_store(
        _write_manifest(tmp_path, reasoning_profile="rdfs-wine-parity"),
        tmp_path / "output",
    )

    assert result.inferred_triple_count >= 1
    metadata = json.loads(
        (Path(result.build_path) / "store-manifest.json").read_text(encoding="utf-8")
    )
    assert metadata["reasoning_profile"] == "rdfs-wine-parity"
    assert metadata["inferred_triple_count"] == result.inferred_triple_count