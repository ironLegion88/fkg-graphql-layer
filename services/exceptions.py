"""Errors expressed by the database-neutral service boundary."""

from enum import Enum


class GraphQLErrorCode(str, Enum):
    NOT_FOUND = "NOT_FOUND"
    INVALID_CURSOR = "INVALID_CURSOR"
    BUDGET_EXHAUSTED = "BUDGET_EXHAUSTED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    INVALID_ARGUMENT = "INVALID_ARGUMENT"


class GraphServiceError(Exception):
    """Base exception for graph operations that cannot be completed."""
    def __init__(self, message: str, code: GraphQLErrorCode = GraphQLErrorCode.INTERNAL_ERROR):
        super().__init__(message)
        self.code = code
        self.message = message


class EntityNotFoundError(GraphServiceError):
    """Raised when a requested entity does not exist."""
    def __init__(self, message: str):
        super().__init__(message, GraphQLErrorCode.NOT_FOUND)


class InvalidTraversalError(GraphServiceError):
    """Raised when graph traversal options or cursors are invalid."""
    def __init__(self, message: str):
        super().__init__(message, GraphQLErrorCode.INVALID_ARGUMENT)


class GraphBackendError(GraphServiceError):
    """Raised when the backing graph database rejects or fails a request."""
    def __init__(self, message: str):
        super().__init__(message, GraphQLErrorCode.INTERNAL_ERROR)

