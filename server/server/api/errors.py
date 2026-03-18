"""Global exception handlers for FastAPI application."""

import logging
import uuid
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from server.domain.errors import AppError, LLMProviderError

logger = logging.getLogger("server.api.errors")


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle application-specific errors with structured responses.

    Args:
        request: FastAPI request object.
        exc: Application error instance.

    Returns:
        JSONResponse with error details and request ID.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    logger.warning(
        "Application error: %s",
        exc.code,
        extra={
            "request_id": request_id,
            "error_code": exc.code,
            "error_message": exc.message,
            "path": request.url.path,
            "method": request.method,
        },
    )

    headers = {"X-Request-ID": request_id}
    if exc.status_code == 429 and exc.details:
        retry_after = exc.details.get("retry_after", 60)
        headers["Retry-After"] = str(retry_after)

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        headers=headers,
    )


async def llm_provider_error_handler(request: Request, exc: LLMProviderError) -> JSONResponse:
    """Handle LLM provider errors.

    Args:
        request: FastAPI request object.
        exc: LLM provider error instance.

    Returns:
        JSONResponse with error details and request ID.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    logger.warning(
        "LLM provider error: %s",
        exc.code,
        extra={
            "request_id": request_id,
            "error_code": exc.code,
            "provider": exc.provider,
            "path": request.url.path,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_dict(),
        headers={"X-Request-ID": request_id},
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors.

    Formats Pydantic validation errors into a structured response.

    Args:
        request: FastAPI request object.
        exc: Request validation error instance.

    Returns:
        JSONResponse with validation error details.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    errors = []
    for error in exc.errors():
        errors.append(
            {
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            }
        )

    logger.info(
        "Validation error",
        extra={
            "request_id": request_id,
            "error_count": len(errors),
            "path": request.url.path,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": errors},
            }
        },
        headers={"X-Request-ID": request_id},
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected errors with generic response.

    Logs full exception details but returns generic error to client
    to avoid exposing internal implementation details.

    Args:
        request: FastAPI request object.
        exc: Unhandled exception instance.

    Returns:
        JSONResponse with generic error message.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    logger.exception(
        "Unexpected error",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "exception_type": exc.__class__.__name__,
        },
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
                "details": {"request_id": request_id},
            }
        },
        headers={"X-Request-ID": request_id},
    )
