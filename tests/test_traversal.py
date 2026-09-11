"""Unit tests for backend-neutral graph expansion pagination."""

from __future__ import annotations

from dataclasses import replace

import pytest

from domain.models import GraphEntity, GraphRelationship, TraversalOptions
from domain.traversal import paginate_relationships


def _star_graph() -> tuple[GraphEntity, list[GraphRelationship]]:
    center = GraphEntity("wine:center", "Center", "Wine")
    relationships = [
        GraphRelationship(
            center,
            GraphEntity(f"grape:{index}", f"Grape {index}", "Grape"),
            "madeFromGrape",
        )
        for index in range(5)
    ]
    relationships.append(relationships[0])
    return center, relationships


def test_pages_relationships_deterministically_without_duplicates() -> None:
    center, relationships = _star_graph()
    options = TraversalOptions(node_limit=2, edge_limit=2)

    first = paginate_relationships(center, list(reversed(relationships)), options)
    second = paginate_relationships(
        center,
        relationships,
        replace(options, cursor=first.page_info.next_cursor),
    )
    third = paginate_relationships(
        center,
        relationships,
        replace(options, cursor=second.page_info.next_cursor),
    )

    assert [node.id for node in first.nodes] == ["grape:0", "grape:1"]
    assert [node.id for node in second.nodes] == ["grape:2", "grape:3"]
    assert [node.id for node in third.nodes] == ["grape:4"]
    assert first.page_info.truncated is True
    assert second.page_info.truncated is True
    assert third.page_info == third.page_info.__class__()


def test_node_limit_can_truncate_before_edge_limit() -> None:
    center, relationships = _star_graph()
    page = paginate_relationships(
        center,
        relationships,
        TraversalOptions(node_limit=1, edge_limit=5),
    )

    assert len(page.nodes) == 1
    assert len(page.relationships) == 1
    assert page.page_info.truncated is True
    assert page.page_info.next_cursor is not None


def test_cursor_is_bound_to_entity_and_filters() -> None:
    center, relationships = _star_graph()
    options = TraversalOptions(node_limit=1, edge_limit=1)
    first = paginate_relationships(center, relationships, options)
    assert first.page_info.next_cursor is not None

    with pytest.raises(ValueError, match="does not match"):
        paginate_relationships(
            GraphEntity("wine:other", "Other", "Wine"),
            relationships,
            replace(options, cursor=first.page_info.next_cursor),
        )

    with pytest.raises(ValueError, match="does not match"):
        paginate_relationships(
            center,
            relationships,
            replace(
                options,
                relations=("hasMaker",),
                cursor=first.page_info.next_cursor,
            ),
        )


@pytest.mark.parametrize("cursor", ["not-base64", "e30", "eyJ2IjoxLCJvIjotMX0"])
def test_invalid_or_tampered_cursor_is_rejected(cursor: str) -> None:
    center, relationships = _star_graph()

    with pytest.raises(ValueError, match="graph cursor|Graph cursor"):
        paginate_relationships(
            center,
            relationships,
            TraversalOptions(cursor=cursor),
        )


def test_non_positive_limits_are_rejected() -> None:
    center, relationships = _star_graph()

    with pytest.raises(ValueError, match="must be positive"):
        paginate_relationships(
            center,
            relationships,
            TraversalOptions(node_limit=0),
        )