import pytest
from services.exceptions import (
    GraphServiceError,
    EntityNotFoundError,
    InvalidTraversalError,
    GraphBackendError,
    GraphQLErrorCode,
)

def test_entity_not_found_error_has_correct_code():
    error = EntityNotFoundError("not found")
    assert error.code == GraphQLErrorCode.NOT_FOUND
    assert error.message == "not found"

def test_invalid_traversal_error_has_correct_code():
    error = InvalidTraversalError("invalid traversal")
    assert error.code == GraphQLErrorCode.INVALID_ARGUMENT
    assert error.message == "invalid traversal"

def test_graph_backend_error_has_correct_code():
    error = GraphBackendError("backend error")
    assert error.code == GraphQLErrorCode.INTERNAL_ERROR
    assert error.message == "backend error"

def test_graph_service_error_base_defaults_to_internal():
    error = GraphServiceError("base error")
    assert error.code == GraphQLErrorCode.INTERNAL_ERROR
    assert error.message == "base error"
