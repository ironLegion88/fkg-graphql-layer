"""Database-neutral domain objects shared by the graph layers."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


SemanticResourceKind = str
UNKNOWN_KIND: SemanticResourceKind = "Unknown"


class TraversalDirection(str, Enum):
    """Directions supported by database-neutral relationship traversal."""

    OUTGOING = "OUTGOING"
    INCOMING = "INCOMING"
    BOTH = "BOTH"


@dataclass(frozen=True, slots=True)
class GraphEntity:
    """A graph node normalized independently of the backing database."""

    id: str
    label: str
    kind: SemanticResourceKind
    description: str | None = None
    properties: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class GraphRelationship:
    """A directed, labelled edge between two database-neutral graph nodes."""

    source: GraphEntity
    target: GraphEntity
    relation: str


@dataclass(frozen=True, slots=True)
class TraversalOptions:
    """Bounded options for graph expansion and relationship retrieval."""

    direction: TraversalDirection = TraversalDirection.BOTH
    relations: tuple[str, ...] = ()
    max_depth: int = 1
    node_limit: int = 200
    edge_limit: int = 400
    cursor: str | None = None
    include_inferred: bool = True


@dataclass(frozen=True, slots=True)
class PathOptions:
    """Budgets and filters for bounded graph path discovery."""

    direction: TraversalDirection = TraversalDirection.BOTH
    relations: tuple[str, ...] = ()
    max_depth: int = 4
    visited_node_limit: int = 2_000
    include_inferred: bool = True


@dataclass(frozen=True, slots=True)
class PageInfo:
    """Continuation metadata returned by a bounded graph operation."""

    truncated: bool = False
    next_cursor: str | None = None


@dataclass(frozen=True, slots=True)
class GraphExpansion:
    """A bounded graph neighborhood independent of its storage backend."""

    center: GraphEntity
    nodes: tuple[GraphEntity, ...]
    relationships: tuple[GraphRelationship, ...]
    page_info: PageInfo = field(default_factory=PageInfo)


@dataclass(frozen=True, slots=True)
class GraphPath:
    """An ordered, database-neutral path between two graph entities."""

    entities: tuple[GraphEntity, ...]
    relations: tuple[str, ...]
