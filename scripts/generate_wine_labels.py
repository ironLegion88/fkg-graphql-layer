"""Generate editable English labels for core Sample Wines entities.

The original Wine ontology gives resources stable RDF identifiers but does not
provide labels for its instances. This script creates a separate Turtle file so
the original ``wine.rdf`` remains unchanged.
"""

from __future__ import annotations

import argparse
import re
import xml.etree.ElementTree as element_tree
from collections import Counter
from pathlib import Path


BASE_IRI = "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine#"
RDF_ID = "{http://www.w3.org/1999/02/22-rdf-syntax-ns#}ID"
RDF_RESOURCE = "{http://www.w3.org/1999/02/22-rdf-syntax-ns#}resource"
OWL_CLASS = "{http://www.w3.org/2002/07/owl#}Class"
RDFS_SUBCLASS_OF = "{http://www.w3.org/2000/01/rdf-schema#}subClassOf"
CORE_DIRECT_TYPES = {"Winery", "Region", "WineGrape"}


def local_name(tag_or_iri: str) -> str:
    """Return the local name from an XML tag or RDF IRI."""
    return tag_or_iri.rsplit("}", maxsplit=1)[-1].rsplit("#", maxsplit=1)[-1]


def is_wine_subclass(class_name: str, parents: dict[str, set[str]]) -> bool:
    """Determine whether a class reaches Wine through its superclass graph."""
    pending = [class_name]
    visited: set[str] = set()
    while pending:
        current = pending.pop()
        if current in visited:
            continue
        if current == "Wine":
            return True
        visited.add(current)
        pending.extend(parents.get(current, set()))
    return False


def display_name(identifier: str) -> str:
    """Make an editable starter label from an RDF identifier."""
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", " ", identifier).strip()


def turtle_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def generate_labels(source: Path, destination: Path) -> Counter[str]:
    """Write labels for Wine descendants and direct core entity types."""
    root = element_tree.parse(source).getroot()
    parents: dict[str, set[str]] = {}
    for class_element in root.findall(f".//{OWL_CLASS}"):
        class_identifier = class_element.get(RDF_ID)
        if class_identifier is None:
            continue
        parents[class_identifier] = {
            local_name(parent.get(RDF_RESOURCE, ""))
            for parent in class_element.findall(RDFS_SUBCLASS_OF)
            if parent.get(RDF_RESOURCE)
        }

    labels: list[tuple[str, str, str]] = []
    for element in root:
        identifier = element.get(RDF_ID)
        entity_type = local_name(element.tag)
        if identifier is None or element.tag == OWL_CLASS:
            continue
        if entity_type in CORE_DIRECT_TYPES or is_wine_subclass(entity_type, parents):
            category = "Wine" if is_wine_subclass(entity_type, parents) else entity_type
            labels.append((category, identifier, display_name(identifier)))

    labels.sort(key=lambda item: (item[0], item[1]))
    counts = Counter(category for category, _, _ in labels)
    lines = [
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "",
        "# Generated starter labels. Review wording before production use.",
        "# This file supplements wine.rdf; it does not modify it.",
        "",
    ]
    for category, identifier, label in labels:
        lines.extend(
            [
                f"# {category}",
                f"<{BASE_IRI}{identifier}> rdfs:label \"{turtle_escape(label)}\"@en .",
                "",
            ]
        )
    destination.write_text("\n".join(lines), encoding="utf-8")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, nargs="?", default=Path("wine.rdf"))
    parser.add_argument("destination", type=Path, nargs="?", default=Path("wine-labels.ttl"))
    arguments = parser.parse_args()
    counts = generate_labels(arguments.source, arguments.destination)
    summary = ", ".join(f"{category}: {count}" for category, count in sorted(counts.items()))
    print(f"Wrote {arguments.destination} ({summary})")


if __name__ == "__main__":
    main()