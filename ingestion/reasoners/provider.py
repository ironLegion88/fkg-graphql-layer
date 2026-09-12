from typing import Protocol, runtime_checkable
from pathlib import Path
from dataclasses import dataclass

@dataclass(frozen=True)
class ReasoningResult:
    """Result of a reasoning job."""
    is_consistent: bool
    unsatisfiable_classes: list[str]
    inferred_triples_file: Path | None
    diagnostics: str | None
    provider_name: str
    build_id: str
    execution_time_ms: float

@dataclass(frozen=True)
class ExplanationArtifact:
    """Represents an explanation for an inferred fact."""
    conclusion: str
    axioms: list[str]
    provider_name: str
    build_id: str

@runtime_checkable
class ReasoningProvider(Protocol):
    """
    Protocol for offline OWL 2 DL reasoning providers.
    Providers should run in a bounded, isolated manner.
    """

    def validate_compatibility(self, profile) -> bool:
        """
        Check if the provider is compatible with the given ontology profile.
        """
        ...

    def check_consistency(self, ontology_path: Path) -> ReasoningResult:
        """
        Check if the ontology is consistent.
        """
        ...

    def classify_and_materialize(self, ontology_path: Path, output_path: Path) -> ReasoningResult:
        """
        Classify the ontology, perform realization, and materialize inferred facts.
        """
        ...

    def explain_inference(self, handle: str) -> ExplanationArtifact | None:
        """
        Produce an explanation artifact for a given inference handle, if supported.
        Return None or raise if explanation is unavailable.
        """
        ...
