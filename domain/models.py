"""Database-neutral domain objects shared by the graph layers."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class EntityKind(str, Enum):
    """Kinds exposed by the public graph facade."""

    WINE = "WINE"
    WINERY = "WINERY"
    REGION = "REGION"
    GRAPE = "GRAPE"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True, slots=True)
class GraphEntity:
    """A graph node normalized independently of the backing database."""

    id: str
    label: str
    kind: EntityKind
    description: str | None = None
    properties: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class GraphRelationship:
    """A directed, labelled edge between two database-neutral graph nodes."""

    source: GraphEntity
    target: GraphEntity
    relation: str


@dataclass(frozen=True, slots=True)
class GraphPath:
    """An ordered, database-neutral path between two graph entities."""

    entities: tuple[GraphEntity, ...]
    relations: tuple[str, ...]
