"""Deterministic tests for migration parity report generation."""

from __future__ import annotations

from benchmarks.compare_backends import (
    classify_accepted_differences,
    compare_snapshots,
    render_markdown,
    unresolved_difference_count,
)


def _snapshot(label: str = "Demo") -> dict:
    return {
        "entities": {
            "wine": {
                "status": "ok",
                "value": {
                    "id": "wine:demo",
                    "label": label,
                    "kind": "WINE",
                    "description": None,
                    "properties": {},
                },
            }
        },
        "relationships": {"wine": {"status": "ok", "value": []}},
        "searches": {"Demo": {"status": "ok", "value": []}},
        "path": {"status": "ok", "value": None},
    }


def test_compare_snapshots_records_matches_and_evidence() -> None:
    graphdb = _snapshot()
    oxigraph = _snapshot("Different")

    comparisons = compare_snapshots(graphdb, oxigraph)

    assert comparisons["relationships"]["wine"]["match"] is True
    assert comparisons["entities"]["wine"]["match"] is False
    assert comparisons["entities"]["wine"]["graphdb"] == graphdb["entities"]["wine"]

    classify_accepted_differences(
        comparisons,
        [
            {
                "section": "entities",
                "case": "wine",
                "reason": "Intentional fixture difference.",
            }
        ],
    )
    assert comparisons["entities"]["wine"]["accepted"] is True
    assert unresolved_difference_count(comparisons) == 0


def test_markdown_report_contains_parity_and_latency_sections() -> None:
    graphdb = _snapshot()
    oxigraph = _snapshot()
    report = {
        "generated_at": "2026-07-24T00:00:00+00:00",
        "oxigraph_build": {
            "build_id": "build",
            "reasoning_profile": "rdfs-wine-parity",
        },
        "comparisons": compare_snapshots(graphdb, oxigraph),
        "performance": {
            "graphdb": {
                "entity_lookup": {"median_ms": 10.0, "p95_ms": 12.0}
            },
            "oxigraph": {
                "entity_lookup": {"median_ms": 1.0, "p95_ms": 2.0}
            },
        },
    }

    markdown = render_markdown(report)

    assert "# GraphDB and Oxigraph Parity Report" in markdown
    assert "**Comparisons matching:** 4/4" in markdown
    assert "**Unresolved differences:** 0" in markdown
    assert "## Warm Operation Latency" in markdown
    assert "| entity_lookup | 10.0 | 12.0 | 1.0 | 2.0 |" in markdown