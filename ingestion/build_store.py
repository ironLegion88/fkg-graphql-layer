"""Build and atomically promote persistent PyOxigraph stores from RDF sources."""

from __future__ import annotations

import argparse
import gc
import json
import os
import shutil
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from pyoxigraph import NamedNode, RdfFormat, Store

from ingestion.manifest import (
    RDFFormatName,
    ResolvedRDFSource,
    calculate_build_id,
    load_source_manifest,
    resolve_sources,
)
from ingestion.reasoning import materialize_semantics
from ingestion.imports import ImportResolver, ResolvedImport
from ingestion.security import (
    validate_source_path,
    validate_file_size,
    safe_parse_rdf,
    PathTraversalError,
    ParserSecurityError,
)

FORMAT_BY_NAME: dict[RDFFormatName, RdfFormat] = {
    "json-ld": RdfFormat.JSON_LD,
    "n-triples": RdfFormat.N_TRIPLES,
    "n-quads": RdfFormat.N_QUADS,
    "turtle": RdfFormat.TURTLE,
    "trig": RdfFormat.TRIG,
    "n3": RdfFormat.N3,
    "rdf-xml": RdfFormat.RDF_XML,
}


@dataclass(frozen=True, slots=True)
class StoreBuildResult:
    """Outcome of a validated, reused, or dry-run store build."""

    build_id: str
    build_path: str
    triple_count: int
    inferred_triple_count: int
    reused: bool
    dry_run: bool


def build_store(
    manifest_path: Path,
    output_root: Path,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> StoreBuildResult:
    """Build a content-addressed Oxigraph store and promote it atomically."""
    manifest_path = manifest_path.resolve()
    output_root = output_root.resolve()
    manifest_dir = manifest_path.parent
    manifest = load_source_manifest(manifest_path)
    sources = resolve_sources(manifest_path, manifest)
    
    # Import resolution
    import_resolver = ImportResolver(manifest.imports, manifest_dir)
    initial_source_paths = [s.path for s in sources]
    resolved_imports = import_resolver.resolve_imports(initial_source_paths)

    build_id = calculate_build_id(manifest, sources, tuple(resolved_imports))
    final_directory = output_root / "builds" / build_id

    if dry_run:
        return StoreBuildResult(build_id, str(final_directory), 0, 0, False, True)

    if final_directory.is_dir() and not force:
        metadata = _read_build_metadata(final_directory)
        _promote(output_root, build_id, metadata["triple_count"])
        return StoreBuildResult(
            build_id,
            str(final_directory),
            int(metadata["triple_count"]),
            int(metadata.get("inferred_triple_count", 0)),
            True,
            False,
        )

    builds_directory = output_root / "builds"
    builds_directory.mkdir(parents=True, exist_ok=True)
    temporary_directory = builds_directory / f".{build_id}.{uuid.uuid4().hex}.tmp"
    temporary_directory.mkdir()

    try:
        triple_count, inferred_triple_count = _load_store(
            temporary_directory,
            manifest_dir,
            sources,
            resolved_imports,
            manifest.reasoning_profile,
        )
        metadata = _write_build_metadata(
            temporary_directory,
            manifest_path,
            manifest.reasoning_profile,
            sources,
            resolved_imports,
            triple_count,
            inferred_triple_count,
        )
        _replace_build_directory(temporary_directory, final_directory)
        _promote(output_root, build_id, metadata["triple_count"])
    except Exception as e:
        shutil.rmtree(temporary_directory, ignore_errors=True)
        # Retain error class and message, but ensure we don't leak the absolute temp/repo paths.
        # We assume custom exceptions like ParserSecurityError/ImportResolutionError have safe messages.
        # For general exceptions, we just print the class.
        if isinstance(e, (ImportError, ValueError, RuntimeError)) or e.__class__.__name__ in ("ParserSecurityError", "ImportResolutionError", "PathTraversalError", "FileSizeLimitError"):
            safe_msg = str(e)
        else:
            safe_msg = "Internal error during build"
        raise RuntimeError(f"Build failed: {e.__class__.__name__} - {safe_msg}") from e

    return StoreBuildResult(
        build_id,
        str(final_directory),
        triple_count,
        inferred_triple_count,
        False,
        False,
    )


def _load_store(
    build_directory: Path,
    manifest_dir: Path,
    sources: tuple[ResolvedRDFSource, ...],
    resolved_imports: list[ResolvedImport],
    reasoning_profile: str,
) -> tuple[int, int]:
    store_directory = build_directory / "store"
    store = Store(store_directory)
    
    # Load primary sources
    for source in sources:
        safe_path = validate_source_path(source.path, [manifest_dir, manifest_dir.parent])
        safe_parse_rdf(
            safe_path, 
            FORMAT_BY_NAME[source.format], 
            store, 
            NamedNode(source.graph)
        )
        
    # Load imports
    for imp in resolved_imports:
        safe_path = validate_source_path(imp.local_path, [manifest_dir, manifest_dir.parent])
        # Auto-detect format for imports based on file extension
        ext = safe_path.suffix.lower()
        if ext in (".ttl", ".turtle"):
            fmt = RdfFormat.TURTLE
        elif ext in (".nt",):
            fmt = RdfFormat.N_TRIPLES
        elif ext in (".nq",):
            fmt = RdfFormat.N_QUADS
        elif ext in (".trig",):
            fmt = RdfFormat.TRIG
        else:
            fmt = RdfFormat.RDF_XML
        
        safe_parse_rdf(
            safe_path,
            fmt,
            store,
            NamedNode(imp.target_graph)
        )

    inferred_triple_count = materialize_semantics(store, reasoning_profile)
    store.optimize()
    store.flush()
    triple_count = len(store)
    del store
    gc.collect()
    return triple_count, inferred_triple_count


def _write_build_metadata(
    build_directory: Path,
    manifest_path: Path,
    reasoning_profile: str,
    sources: tuple[ResolvedRDFSource, ...],
    resolved_imports: list[ResolvedImport],
    triple_count: int,
    inferred_triple_count: int,
) -> dict[str, object]:
    metadata: dict[str, object] = {
        "created_at": datetime.now(UTC).isoformat(),
        "manifest": str(manifest_path),
        "reasoning_profile": reasoning_profile,
        "triple_count": triple_count,
        "inferred_triple_count": inferred_triple_count,
        "sources": [
            {
                "path": source.manifest_path,
                "format": source.format,
                "graph": source.graph,
                "sha256": source.sha256,
            }
            for source in sources
        ],
        "resolved_imports": [
            {
                "import_iri": imp.import_iri,
                "checksum": imp.checksum,
                "target_graph": imp.target_graph,
            }
            for imp in resolved_imports
        ],
    }
    _write_json_atomic(build_directory / "store-manifest.json", metadata)
    return metadata


def _read_build_metadata(build_directory: Path) -> dict[str, object]:
    metadata_path = build_directory / "store-manifest.json"
    if not metadata_path.is_file():
        raise RuntimeError(f"Existing store build has no metadata: {build_directory}")
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def _replace_build_directory(source: Path, destination: Path) -> None:
    if not destination.exists():
        source.replace(destination)
        return

    backup = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.old")
    destination.replace(backup)
    try:
        source.replace(destination)
    except Exception:
        backup.replace(destination)
        raise
    shutil.rmtree(backup, ignore_errors=True)


def _promote(output_root: Path, build_id: str, triple_count: object) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    _write_json_atomic(
        output_root / "current.json",
        {
            "build_id": build_id,
            "path": f"builds/{build_id}",
            "triple_count": int(triple_count),
        },
    )


def _write_json_atomic(path: Path, value: object) -> None:
    temporary_path = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    temporary_path.write_text(
        json.dumps(value, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary_path, path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=Path("config/rdf-sources.yaml"))
    parser.add_argument("--output", type=Path, default=Path(".data/oxigraph"))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    arguments = parser.parse_args()
    result = build_store(
        arguments.manifest,
        arguments.output,
        force=arguments.force,
        dry_run=arguments.dry_run,
    )
    print(json.dumps(asdict(result), indent=2))


if __name__ == "__main__":
    main()