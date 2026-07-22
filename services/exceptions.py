"""Errors expressed by the database-neutral service boundary."""


class GraphServiceError(Exception):
    """Base exception for graph operations that cannot be completed."""


class EntityNotFoundError(GraphServiceError):
    """Raised when a requested entity does not exist."""


class GraphBackendError(GraphServiceError):
    """Raised when the backing graph database rejects or fails a request."""
