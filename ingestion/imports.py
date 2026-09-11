"""Ontology import resolution and vendoring."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from pyoxigraph import NamedNode, parse, RdfFormat

from ingestion.manifest import ImportPolicy


class ImportResolutionError(Exception):
    """Raised when an import cannot be securely resolved or verified."""
    pass


@dataclass(frozen=True, slots=True)
class ResolvedImport:
    """A verified imported ontology artifact ready for ingestion."""

    import_iri: str
    local_path: Path
    checksum: str
    target_graph: str
    resolved_from: str


class ImportResolver:
    """Resolves and verifies ontology imports against a secure allowlist."""

    def __init__(self, config: ImportPolicy, base_dir: Path):
        self.config = config
        self.base_dir = base_dir.resolve()
        
    def _compute_sha256(self, path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def resolve_imports(
        self, initial_sources: list[Path]
    ) -> list[ResolvedImport]:
        """
        Recursively discover and resolve imports starting from initial sources.
        Returns an ordered list of ResolvedImport.
        """
        if self.config.mode == "disabled":
            return []

        resolved: list[ResolvedImport] = []
        visited_iris: set[str] = set()
        queue: list[tuple[str, str, Path]] = []  # (import_iri, resolved_from_iri, source_path)

        # Discover initial imports and their ontology IRIs
        for source_path in initial_sources:
            ontology_iri, imports = self._extract_imports_and_iri(source_path)
            if ontology_iri:
                visited_iris.add(ontology_iri)
            for imp in imports:
                queue.append((imp, str(source_path), source_path))

        while queue:
            import_iri, resolved_from, source_path = queue.pop(0)

            if import_iri in visited_iris:
                continue
            visited_iris.add(import_iri)

            if import_iri not in self.config.allowlist:
                raise ImportResolutionError(f"Import IRI not in allowlist: {import_iri}")

            local_mapping = self.config.local_mappings.get(import_iri)
            if not local_mapping:
                raise ImportResolutionError(f"No local mapping for import (network access forbidden): {import_iri}")

            local_path = (self.base_dir / local_mapping).resolve()
            if not local_path.is_file():
                raise ImportResolutionError(f"Mapped local file does not exist: {local_path}")
            
            actual_checksum = self._compute_sha256(local_path)
            expected_checksum = self.config.checksums.get(import_iri)
            if expected_checksum and actual_checksum.casefold() != expected_checksum.casefold():
                raise ImportResolutionError(
                    f"Checksum mismatch for {import_iri}: expected {expected_checksum}, got {actual_checksum}"
                )

            target_graph = f"urn:fkg:graph:imports:{actual_checksum[:12]}"
            
            res_imp = ResolvedImport(
                import_iri=import_iri,
                local_path=local_path,
                checksum=actual_checksum,
                target_graph=target_graph,
                resolved_from=resolved_from,
            )
            resolved.append(res_imp)

            # Discover nested imports
            nested_ontology_iri, nested_imports = self._extract_imports_and_iri(local_path)
            if nested_ontology_iri:
                if nested_ontology_iri != import_iri:
                    raise ImportResolutionError(
                        f"Ontology IRI mismatch: expected {import_iri}, got {nested_ontology_iri}"
                    )
                visited_iris.add(nested_ontology_iri)
                
            for nested_imp in nested_imports:
                if nested_imp not in visited_iris:
                    queue.append((nested_imp, import_iri, local_path))

        return resolved

    def _extract_imports_and_iri(self, path: Path) -> tuple[str | None, list[str]]:
        """Parse RDF file to extract the primary owl:Ontology IRI and owl:imports IRIs."""
        ext = path.suffix.lower()
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

        imports = []
        ontology_iri = None
        
        owl_imports = NamedNode("http://www.w3.org/2002/07/owl#imports")
        owl_ontology = NamedNode("http://www.w3.org/2002/07/owl#Ontology")
        rdf_type = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
        
        try:
            for triple in parse(path.read_bytes(), fmt):
                if triple.predicate == owl_imports and isinstance(triple.object, NamedNode):
                    imports.append(triple.object.value)
                elif triple.predicate == rdf_type and triple.object == owl_ontology and isinstance(triple.subject, NamedNode):
                    if ontology_iri is None:
                        ontology_iri = triple.subject.value
        except Exception:
            pass
            
        return ontology_iri, imports
