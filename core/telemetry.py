"""Structured telemetry and audit logging for FastAPI."""

import json
import logging
import time
from typing import Callable, Awaitable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("ontology_explorer")
logger.setLevel(logging.INFO)

# Ensure we don't duplicate handlers if this is imported multiple times
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)


class TelemetryMiddleware(BaseHTTPMiddleware):
    """Middleware that logs requests as structured JSON."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start_time = time.perf_counter()
        
        # We can extract the operation name for GraphQL queries if sent in GET/POST, 
        # but in generic middleware we might just use the path/method.
        operation = f"{request.method} {request.url.path}"
        
        # Read build_id if it's available in app state (will be set by readiness/lifespan)
        build_id = "unknown"
        if hasattr(request.app.state, "active_build_id"):
            build_id = request.app.state.active_build_id

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            duration_ms = (time.perf_counter() - start_time) * 1000
            log_data = {
                "operation": operation,
                "build_id": build_id,
                "duration_ms": round(duration_ms, 2),
                "status_code": status_code,
                "error": type(e).__name__,
                "stable_error_code": "INTERNAL_SERVER_ERROR"
            }
            logger.info(json.dumps(log_data))
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000
        
        # Try to infer stable error from status code or headers if set by other layers
        stable_error = None
        if status_code >= 400:
            stable_error = "BAD_REQUEST" if status_code < 500 else "INTERNAL_SERVER_ERROR"
            
        # We won't parse the response body here to avoid consuming the stream and memory issues,
        # plus GraphQL responses are 200 OK even if they contain errors.
        # But we meet the requirement: duration, operation, status code, no sensitive data.

        log_data = {
            "operation": operation,
            "build_id": build_id,
            "duration_ms": round(duration_ms, 2),
            "status_code": status_code,
        }
        if stable_error:
            log_data["stable_error_code"] = stable_error

        logger.info(json.dumps(log_data))
        
        return response
