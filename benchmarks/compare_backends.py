"""Capture semantic parity and warm-query latency for graph repository adapters."""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import platform
import statistics
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import yaml

from adapters.oxigraph import OxigraphGraphRepository, OxigraphSettings
from domain.models import GraphEntity, GraphExpansion, GraphPath, GraphRelationship, TraversalOptions
from domain.ports import GraphRepository
from services.graph_retrieval import GraphDBSettings, GraphRetrievalService
from services.graph_service import GraphService


async def capture_snapshot(
    repository: GraphRepository,
    cases: dict[str, Any],
) -> dict[str, Any]:
    """Capture normalized behavior for representative repository operations."""
    snapshot: dict[str, Any] = {"entities": {}, "relationships": {}, "searches": {}}
    for case in cases["entities"]:
        name = case["name"]
        entity_id = case["id"]
        snapshot["entities"][name] = await _capture(
            lambda entity_id=entity_id: repository.get_entity(entity_id),
            normalize_entity,
        )
        snapshot["relationships"][name] = await _capture(
            lambda entity_id=entity_id: repository.get_relationships(
                entity_id,
                TraversalOptions(edge_limit=500),
            ),
            normalize_relationships,
        )

    for query in cases["searches"]:
        snapshot["searches"][query] = await _capture(
            lambda query=query: repository.search_entities(query, limit=100),
            normalize_entities,
        )

    path_case = cases["path"]
    snapshot["path"] = await _capture(
        lambda: GraphService(repository).find_path(
            path_case["source"],
            path_case["target"],
            max_depth=4,
        ),
        normalize_path,
    )
    return snapshot


async def capture_performance(
    repository: GraphRepository,
    cases: dict[str, Any],
    iterations: int,
) -> dict[str, Any]:
    """Measure warm operation latency using fixed migration cases."""
    primary_id = cases["entities"][0]["id"]
    path_case = cases["path"]
    operations: dict[str, Callable[[], Awaitable[Any]]] = {
        "entity_lookup": lambda: repository.get_entity(primary_id),
        "relationship_lookup": lambda: repository.get_relationships(primary_id),
        "search": lambda: repository.search_entities(cases["searches"][0], limit=100),
        "expansion": lambda: repository.expand_graph(
            primary_id,
            TraversalOptions(node_limit=100, edge_limit=200),
        ),
        "path": lambda: GraphService(repository).find_path(
            path_case["source"],
            path_case["target"],
            max_depth=4,
        ),
    }
    return {
        name: await measure_operation(operation, iterations)
        for name, operation in operations.items()
    }


async def measure_operation(
    operation: Callable[[], Awaitable[Any]],
    iterations: int,
) -> dict[str, Any]:
    """Warm one operation and report distribution statistics in milliseconds."""
    try:
        await operation()
        durations: list[float] = []
        for _ in range(iterations):
            started = time.perf_counter()
            await operation()
            durations.append((time.perf_counter() - started) * 1_000)
    except Exception as error:  # benchmark evidence must preserve backend failures
        return {
            "status": "error",
            "error_type": type(error).__name__,
            "message": str(error),
        }

    ordered = sorted(durations)
    p95_index = max(0, math.ceil(len(ordered) * 0.95) - 1)
    return {
        "status": "ok",
        "iterations": iterations,
        "median_ms": round(statistics.median(ordered), 3),
        "p95_ms": round(ordered[p95_index], 3),
        "min_ms": round(ordered[0], 3),
        "max_ms": round(ordered[-1], 3),
    }


async def _capture(
    operation: Callable[[], Awaitable[Any]],
    normalize: Callable[[Any], Any],
) -> dict[str, Any]:
    try:
        return {"status": "ok", "value": normalize(await operation())}
    except Exception as error:
        return {
            "status": "error",
            "error_type": type(error).__name__,
            "message": str(error),
        }


def normalize_entity(entity: GraphEntity | None) -> dict[str, Any] | None:
    if entity is None:
        return None
    return {
        "id": entity.id,
        "label": entity.label,
        "kind": entity.kind.value,
        "description": entity.description,
        "properties": dict(sorted(entity.properties.items())),
    }


def normalize_entities(entities: list[GraphEntity]) -> list[dict[str, Any]]:
    return sorted(
        (normalize_entity(entity) for entity in entities if entity is not None),
        key=lambda entity: entity["id"],
    )


def normalize_relationships(
    relationships: list[GraphRelationship],
) -> list[dict[str, Any]]:
    return sorted(
        (
            {
                "source": relationship.source.id,
                "relation": relationship.relation,
                "target": relationship.target.id,
            }
            for relationship in relationships
        ),
        key=lambda edge: (edge["relation"], edge["source"], edge["target"]),
    )


def normalize_expansion(expansion: GraphExpansion) -> dict[str, Any]:
    return {
        "center": normalize_entity(expansion.center),
        "nodes": normalize_entities(list(expansion.nodes)),
        "relationships": normalize_relationships(list(expansion.relationships)),
        "truncated": expansion.page_info.truncated,
    }


def normalize_path(path: GraphPath | None) -> dict[str, Any] | None:
    if path is None:
        return None
    return {
        "entities": [entity.id for entity in path.entities],
        "relations": list(path.relations),
    }


def compare_snapshots(
    graphdb: dict[str, Any],
    oxigraph: dict[str, Any],
) -> dict[str, Any]:
    """Compare normalized snapshots and retain evidence for every difference."""
    comparisons: dict[str, Any] = {}
    for section in ("entities", "relationships", "searches"):
        comparisons[section] = {}
        for name in sorted(set(graphdb[section]).union(oxigraph[section])):
            graphdb_value = graphdb[section].get(name)
            oxigraph_value = oxigraph[section].get(name)
            comparisons[section][name] = {
                "match": graphdb_value == oxigraph_value,
                "graphdb": graphdb_value,
                "oxigraph": oxigraph_value,
            }
    comparisons["path"] = {
        "match": graphdb.get("path") == oxigraph.get("path"),
        "graphdb": graphdb.get("path"),
        "oxigraph": oxigraph.get("path"),
    }
    return comparisons


def classify_accepted_differences(
    comparisons: dict[str, Any],
    accepted_differences: list[dict[str, str]],
) -> None:
    """Annotate reviewed semantic differences without hiding their evidence."""
    for accepted in accepted_differences:
        section = accepted["section"]
        case = accepted["case"]
        comparison = comparisons.get(section, {}).get(case)
        if comparison is None:
            raise ValueError(f"Accepted difference does not exist: {section}/{case}")
        if comparison["match"]:
            continue
        comparison["accepted"] = True
        comparison["reason"] = accepted["reason"]


def unresolved_difference_count(comparisons: dict[str, Any]) -> int:
    """Count semantic mismatches that have not received an explicit decision."""
    count = 0
    for section in ("entities", "relationships", "searches"):
        count += sum(
            1
            for comparison in comparisons[section].values()
            if not comparison["match"] and not comparison.get("accepted", False)
        )
    path_comparison = comparisons["path"]
    if not path_comparison["match"] and not path_comparison.get("accepted", False):
        count += 1
    return count


def render_markdown(report: dict[str, Any]) -> str:
    """Render a human-reviewable parity and benchmark report."""
    comparisons = report["comparisons"]
    rows: list[tuple[str, str, bool]] = []
    for section in ("entities", "relationships", "searches"):
        rows.extend(
            (section, name, comparison["match"])
            for name, comparison in comparisons[section].items()
        )
    rows.append(("path", "configured path", comparisons["path"]["match"]))
    matched = sum(1 for _, _, matches in rows if matches)
    accepted = sum(
        1
        for section, name, matches in rows
        if not matches
        and (
            comparisons["path"]
            if section == "path"
            else comparisons[section][name]
        ).get("accepted", False)
    )
    unresolved = len(rows) - matched - accepted

    lines = [
        "# GraphDB and Oxigraph Parity Report",
        "",
        f"- **Generated:** {report['generated_at']}",
        f"- **Oxigraph build:** `{report['oxigraph_build']['build_id']}`",
        f"- **Reasoning profile:** `{report['oxigraph_build']['reasoning_profile']}`",
        f"- **Comparisons matching:** {matched}/{len(rows)}",
        f"- **Accepted differences:** {accepted}",
        f"- **Unresolved differences:** {unresolved}",
        "",
        "## Semantic Parity",
        "",
        "| Section | Case | Result |",
        "| --- | --- | --- |",
    ]
    for section, name, matches in rows:
        comparison = (
            comparisons["path"] if section == "path" else comparisons[section][name]
        )
        result = (
            "Match"
            if matches
            else "Accepted difference"
            if comparison.get("accepted", False)
            else "Unresolved difference"
        )
        lines.append(f"| {section} | {name} | {result} |")

    differences = [
        (section, name, comparisons[section][name])
        for section in ("entities", "relationships", "searches")
        for name in comparisons[section]
        if not comparisons[section][name]["match"]
    ]
    if not comparisons["path"]["match"]:
        differences.append(("path", "configured path", comparisons["path"]))

    lines.extend(["", "## Differences", ""])
    if differences:
        for section, name, comparison in differences:
            decision = (
                "Accepted: " + comparison["reason"]
                if comparison.get("accepted", False)
                else "Unresolved"
            )
            lines.extend(
                [
                    f"### {section}: {name}",
                    "",
                    f"**Decision:** {decision}",
                    "",
                    "**GraphDB**",
                    "",
                    "```json",
                    json.dumps(comparison["graphdb"], indent=2, sort_keys=True),
                    "```",
                    "",
                    "**Oxigraph**",
                    "",
                    "```json",
                    json.dumps(comparison["oxigraph"], indent=2, sort_keys=True),
                    "```",
                    "",
                ]
            )
    else:
        lines.append("No semantic differences were observed in the configured cases.")

    lines.extend(
        [
            "",
            "## Warm Operation Latency",
            "",
            "| Operation | GraphDB median (ms) | GraphDB p95 (ms) | Oxigraph median (ms) | Oxigraph p95 (ms) |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for operation in report["performance"]["graphdb"]:
        graphdb_result = report["performance"]["graphdb"][operation]
        oxigraph_result = report["performance"]["oxigraph"][operation]
        lines.append(
            "| " + operation + " | "
            + _metric(graphdb_result, "median_ms") + " | "
            + _metric(graphdb_result, "p95_ms") + " | "
            + _metric(oxigraph_result, "median_ms") + " | "
            + _metric(oxigraph_result, "p95_ms") + " |"
        )

    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- Measurements are local warm-query observations, not production capacity guarantees.",
            "- GraphDB transport includes local HTTP and generated-schema overhead.",
            "- Renderer benchmarks are tracked separately from repository parity.",
            "",
        ]
    )
    return "\n".join(lines)


def _metric(result: dict[str, Any], name: str) -> str:
    return str(result.get(name, "error"))


async def run_comparison(arguments: argparse.Namespace) -> dict[str, Any]:
    cases = yaml.safe_load(arguments.cases.read_text(encoding="utf-8"))
    active_pointer = json.loads(
        (arguments.store_root / "current.json").read_text(encoding="utf-8")
    )
    build_metadata = json.loads(
        (
            arguments.store_root
            / active_pointer["path"]
            / "store-manifest.json"
        ).read_text(encoding="utf-8")
    )

    oxigraph = OxigraphGraphRepository(OxigraphSettings(arguments.store_root))
    async with httpx.AsyncClient(timeout=arguments.timeout) as client:
        graphdb = GraphRetrievalService(
            GraphDBSettings(
                arguments.graphdb_url,
                arguments.graphdb_repository,
                arguments.graphdb_endpoint,
                arguments.timeout,
            ),
            client,
        )
        graphdb_snapshot, oxigraph_snapshot = await asyncio.gather(
            capture_snapshot(graphdb, cases),
            capture_snapshot(oxigraph, cases),
        )
        graphdb_performance = await capture_performance(
            graphdb, cases, arguments.iterations
        )
    oxigraph_performance = await capture_performance(
        oxigraph, cases, arguments.iterations
    )

    comparisons = compare_snapshots(graphdb_snapshot, oxigraph_snapshot)
    classify_accepted_differences(
        comparisons,
        cases.get("accepted_differences", []),
    )
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "environment": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "iterations": arguments.iterations,
        },
        "oxigraph_build": {
            "build_id": active_pointer["build_id"],
            "triple_count": active_pointer["triple_count"],
            "reasoning_profile": build_metadata["reasoning_profile"],
            "inferred_triple_count": build_metadata.get("inferred_triple_count", 0),
        },
        "snapshots": {
            "graphdb": graphdb_snapshot,
            "oxigraph": oxigraph_snapshot,
        },
        "comparisons": comparisons,
        "performance": {
            "graphdb": graphdb_performance,
            "oxigraph": oxigraph_performance,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cases",
        type=Path,
        default=Path("benchmarks/wine-parity-cases.yaml"),
    )
    parser.add_argument("--store-root", type=Path, default=Path(".data/oxigraph"))
    parser.add_argument("--graphdb-url", default="http://localhost:7200")
    parser.add_argument("--graphdb-repository", default="wine")
    parser.add_argument("--graphdb-endpoint", default="wine-v2")
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument(
        "--json-output",
        type=Path,
        default=Path(".data/benchmarks/backend-parity.json"),
    )
    parser.add_argument(
        "--markdown-output",
        type=Path,
        default=Path("docs/benchmarks/owl-store-parity.md"),
    )
    arguments = parser.parse_args()
    if arguments.iterations <= 0:
        parser.error("--iterations must be positive")

    report = asyncio.run(run_comparison(arguments))
    arguments.json_output.parent.mkdir(parents=True, exist_ok=True)
    arguments.markdown_output.parent.mkdir(parents=True, exist_ok=True)
    arguments.json_output.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    arguments.markdown_output.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps(report["comparisons"], indent=2, sort_keys=True))
    unresolved = unresolved_difference_count(report["comparisons"])
    if unresolved:
        raise SystemExit(f"Parity gate failed with {unresolved} unresolved differences")


if __name__ == "__main__":
    main()