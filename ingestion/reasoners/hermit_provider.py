import time
import subprocess
import json
import tempfile
from pathlib import Path
from dataclasses import dataclass
import sys

from ingestion.reasoners.provider import ReasoningProvider, ReasoningResult, ExplanationArtifact

class HermitProvider(ReasoningProvider):
    """
    ReasoningProvider implementation using HermiT via owlready2.
    Runs the reasoning in an isolated Python subprocess to enforce limits
    and avoid memory leaks in the main application process.
    """

    def __init__(self, timeout_seconds: int = 600, memory_mb: int = 2048):
        self.timeout_seconds = timeout_seconds
        self.memory_mb = memory_mb

    def validate_compatibility(self, profile) -> bool:
        # HermiT supports full OWL 2 DL.
        if profile.reasoning.provider_name and profile.reasoning.provider_name.lower() not in ("hermit", "owlready2"):
            return False
        return True

    def check_consistency(self, ontology_path: Path) -> ReasoningResult:
        return self._run_worker(ontology_path, "consistency", None)

    def classify_and_materialize(self, ontology_path: Path, output_path: Path) -> ReasoningResult:
        return self._run_worker(ontology_path, "materialize", output_path)

    def explain_inference(self, handle: str) -> ExplanationArtifact | None:
        # Not fully supported by owlready2 default sync_reasoner without pellet justification extensions.
        # Returning None explicitly falls back to EXPLANATION_UNAVAILABLE.
        return None

    def _run_worker(self, ontology_path: Path, mode: str, output_path: Path | None) -> ReasoningResult:
        start_time = time.time()
        
        # We invoke a dedicated worker script to isolate the owlready2 process
        worker_script = Path(__file__).parent / "_hermit_worker.py"
        
        cmd = [
            sys.executable,
            str(worker_script),
            "--ontology", str(ontology_path.resolve()),
            "--mode", mode
        ]
        
        if output_path:
            cmd.extend(["--output", str(output_path.resolve())])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            execution_time = (time.time() - start_time) * 1000
            
            if result.returncode != 0:
                # The worker script outputs JSON even on specific errors if possible.
                try:
                    data = json.loads(result.stdout)
                    return ReasoningResult(
                        is_consistent=data.get("is_consistent", False),
                        unsatisfiable_classes=data.get("unsatisfiable_classes", []),
                        inferred_triples_file=None,
                        diagnostics=result.stderr or data.get("error", "Unknown error"),
                        provider_name="HermiT",
                        build_id="pending",
                        execution_time_ms=execution_time
                    )
                except json.JSONDecodeError:
                    return ReasoningResult(
                        is_consistent=False,
                        unsatisfiable_classes=[],
                        inferred_triples_file=None,
                        diagnostics=f"Process failed: {result.stderr}",
                        provider_name="HermiT",
                        build_id="pending",
                        execution_time_ms=execution_time
                    )
            
            data = json.loads(result.stdout)
            return ReasoningResult(
                is_consistent=data.get("is_consistent", True),
                unsatisfiable_classes=data.get("unsatisfiable_classes", []),
                inferred_triples_file=output_path if mode == "materialize" else None,
                diagnostics=result.stderr,
                provider_name="HermiT",
                build_id="pending",
                execution_time_ms=execution_time
            )
            
        except subprocess.TimeoutExpired as e:
            return ReasoningResult(
                is_consistent=False,
                unsatisfiable_classes=[],
                inferred_triples_file=None,
                diagnostics=f"Reasoning timed out after {self.timeout_seconds}s",
                provider_name="HermiT",
                build_id="pending",
                execution_time_ms=self.timeout_seconds * 1000
            )
