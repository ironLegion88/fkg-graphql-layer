"""Storage-neutral pagination and cursor handling for graph expansion."""

from __future__ import annotations

import base64
import hashlib
import json

from domain.models import (
    GraphEntity,
    GraphExpansion,
    GraphRelationship,
    PageInfo,
    TraversalOptions,
)


CURSOR_VERSION = 1


def paginate_relationships(
    center: GraphEntity,
    relationships: list[GraphRelationship],
    options: TraversalOptions,
) -> GraphExpansion:
    """Create one deterministic, bounded relationship page around an entity."""
    if options.node_limit <= 0 or options.edge_limit <= 0:
        raise ValueError("Traversal node and edge limits must be positive")

    ordered = sorted(
        {
            (relationship.source.id, relationship.target.id, relationship.relation): relationship
            for relationship in relationships
            if relationship.source.id == center.id or relationship.target.id == center.id
        }.values(),
        key=lambda relationship: (
            relationship.relation,
            relationship.source.id,
            relationship.target.id,
        ),
    )
    offset = decode_cursor_offset(center.id, options)
    if offset > len(ordered):
        raise ValueError("Graph cursor points beyond the available relationships")

    page_relationships: list[GraphRelationship] = []
    page_nodes: dict[str, GraphEntity] = {}
    next_offset = offset
    while next_offset < len(ordered) and len(page_relationships) < options.edge_limit:
        relationship = ordered[next_offset]
        neighbor = (
            relationship.target
            if relationship.source.id == center.id
            else relationship.source
        )
        if neighbor.id != center.id and neighbor.id not in page_nodes:
            if len(page_nodes) >= options.node_limit:
                break
            page_nodes[neighbor.id] = neighbor
        page_relationships.append(relationship)
        next_offset += 1

    truncated = next_offset < len(ordered)
    return GraphExpansion(
        center=center,
        nodes=tuple(page_nodes.values()),
        relationships=tuple(page_relationships),
        page_info=PageInfo(
            truncated=truncated,
            next_cursor=(
                encode_cursor(center.id, options, next_offset) if truncated else None
            ),
        ),
    )


def encode_cursor(entity_id: str, options: TraversalOptions, offset: int) -> str:
    """Encode an opaque cursor bound to one traversal configuration."""
    payload = {
        "v": CURSOR_VERSION,
        "o": offset,
        "f": _cursor_fingerprint(entity_id, options),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


def decode_cursor_offset(entity_id: str, options: TraversalOptions) -> int:
    """Decode and validate an optional traversal cursor."""
    if options.cursor is None:
        return 0
    try:
        padding = "=" * (-len(options.cursor) % 4)
        payload = json.loads(
            base64.urlsafe_b64decode(options.cursor + padding).decode("utf-8")
        )
        version = payload["v"]
        offset = payload["o"]
        fingerprint = payload["f"]
    except (KeyError, TypeError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Invalid graph cursor") from error

    if version != CURSOR_VERSION or not isinstance(offset, int) or offset < 0:
        raise ValueError("Invalid graph cursor")
    if fingerprint != _cursor_fingerprint(entity_id, options):
        raise ValueError("Graph cursor does not match this traversal")
    return offset


def _cursor_fingerprint(entity_id: str, options: TraversalOptions) -> str:
    payload = {
        "entity_id": entity_id,
        "direction": options.direction.value,
        "relations": sorted(options.relations),
        "max_depth": options.max_depth,
        "include_inferred": options.include_inferred,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:16]