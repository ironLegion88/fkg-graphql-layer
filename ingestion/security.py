"""Security checks and hardening for RDF ingestion."""

from __future__ import annotations

import os
from pathlib import Path

from pyoxigraph import NamedNode, RdfFormat, Store, parse, Quad

class PathTraversalError(Exception):
    """Raised when a path resolves outside allowed root directories."""
    pass

class FileSizeLimitError(Exception):
    """Raised when a file exceeds the allowed size limit."""
    pass

class ParserSecurityError(Exception):
    """Raised when a parser security violation occurs."""
    pass

def validate_source_path(path: Path, allowed_roots: list[Path]) -> Path:
    """
    Resolve the path and verify it falls within one of the allowed root directories.
    Reject paths containing .., symlinks escaping the root, or absolute paths outside roots.
    """
    try:
        resolved = path.resolve(strict=True)
    except Exception as e:
        raise PathTraversalError(f"Path cannot be resolved: {path}") from e

    for root in allowed_roots:
        root_resolved = root.resolve()
        # Ensure the resolved path is relative to the resolved root
        try:
            resolved.relative_to(root_resolved)
            return resolved
        except ValueError:
            continue

    raise PathTraversalError("Path resolves outside of allowed root directories.")

def validate_file_size(path: Path, max_bytes: int = 50 * 1024 * 1024) -> None:
    """
    Check file size before reading.
    Raise FileSizeLimitError if exceeded. Default limit: 50MB.
    """
    size = path.stat().st_size
    if size > max_bytes:
        raise FileSizeLimitError(f"File size {size} exceeds limit of {max_bytes} bytes.")

def safe_parse_rdf(path: Path, format: RdfFormat, store: Store, graph: NamedNode) -> int:
    """
    Parse RDF into the store with protections against XXE and entity expansion attacks.
    PyOxigraph's Rust XML parser is not vulnerable to XXE, but we verify and enforce limits.
    Returns the number of triples loaded.
    """
    validate_file_size(path)
    
    count = 0
    # PyOxigraph uses a Rust-based XML parser which mitigates XXE and network access by default.
    # To prevent billion-laughs, we could limit the size as already done, but also we can
    # stream parse. `pyoxigraph.parse` streams the triples.
    try:
        for triple in parse(path.read_bytes(), format):
            store.add(Quad(triple.subject, triple.predicate, triple.object, graph))
            count += 1
    except Exception as e:
        raise ParserSecurityError(f"Error parsing RDF file: {e}") from e

    return count
