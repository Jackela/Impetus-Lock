"""FastAPI main application entry point with structured logging."""

import logging
import os
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any, Literal, cast

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.errors import (
    app_error_handler,
    global_exception_handler,
    llm_provider_error_handler,
    validation_error_handler,
)
from server.api.middleware.rate_limit import RateLimitMiddleware
from server.api.routes import (
    achievements,
    collaboration,
    intervention,
    metrics,
    stats,
    streaks,
    style,
    style_comparison,
    style_history,
    tasks,
    templates,
)
from server.auth import router as auth_router
from server.domain.errors import AppError, LLMProviderError
from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderRegistry
from server.infrastructure.logging.json_formatter import setup_json_logging
from server.infrastructure.persistence.database import (
    get_db_manager,
    init_database,
    is_database_initialized,
)
from server.infrastructure.persistence.database import (
    health_check as db_health_check,
)

# Load environment variables from .env file
load_dotenv()
setup_json_logging(os.getenv("LOG_LEVEL", "INFO"))

logger = logging.getLogger("server.api")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize shared resources and close them on shutdown."""

    await init_database()
    app.state.idempotency_cache = AsyncIdempotencyCache(ttl=15)
    app.state.provider_registry = ProviderRegistry()

    # Initialize collaboration service
    from server.api.routes.collaboration import collab_service

    await collab_service.initialize()
    app.state.collab_service = collab_service

    try:
        yield
    finally:
        if is_database_initialized():
            await get_db_manager().close()
        # Shutdown collaboration service
        await collab_service.shutdown()


app = FastAPI(
    title="Impetus Lock API",
    version="0.1.0",
    description="Un-deletable task pressure system API",
    lifespan=lifespan,
)

app.add_exception_handler(AppError, cast(Any, app_error_handler))
app.add_exception_handler(LLMProviderError, cast(Any, llm_provider_error_handler))
app.add_exception_handler(RequestValidationError, cast(Any, validation_error_handler))
app.add_exception_handler(Exception, global_exception_handler)

# Add middleware (order matters - rate limit first, then auth, then CORS)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthenticationMiddleware)


# P2 Security Fix: Environment-specific CORS configuration
# Production: Only allow configured origins
# Development: Allow localhost on standard Vite ports
env = os.getenv("ENV", "development")
if env == "production":
    # Production: Use configured origins only
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]
    if not allowed_origins:
        # Fallback to empty list if not configured (blocks all cross-origin)
        allowed_origins = []
    logger.info(f"CORS configured for production with {len(allowed_origins)} origins")
else:
    # Development: Allow standard Vite dev server ports only
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    logger.debug(f"CORS configured for development: {allowed_origins}")

# P2 Security Fix: Explicit method specification
allowed_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=allowed_methods,
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth_router)
app.include_router(intervention.router)
app.include_router(tasks.router)
app.include_router(metrics.router)
app.include_router(style.router)
app.include_router(style_history.router)
app.include_router(style_comparison.router)
app.include_router(collaboration.router)
app.include_router(achievements.router)
app.include_router(stats.router)
app.include_router(streaks.router)
app.include_router(templates.router)

# Include testing routes (only when TESTING=true)
if os.getenv("TESTING"):
    from server.api.routes import testing

    app.include_router(testing.router)

    # Override get_current_user for E2E tests to bypass database lookup
    from uuid import UUID

    from server.auth.dependencies import get_current_user
    from server.models.user import User

    _test_user = User(
        id=UUID("12345678-1234-1234-1234-123456789abc"),
        email="e2e-test@example.com",
        password_hash="test-hash",
    )
    app.dependency_overrides[get_current_user] = lambda: _test_user


class HealthResponse(BaseModel):
    """Health check response model.

    Attributes:
        status: Service health status (always 'ok' if responding)
        service: Service name identifier
        version: API version number
    """

    status: Literal["ok"]
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Health check endpoint.

    Returns basic service information to verify API is running.
    This is the minimal P2 infrastructure endpoint (non-Vibe feature).

    Returns:
        HealthResponse: Service health status and metadata

    Example:
        >>> response = client.get("/health")
        >>> response.json()
        {"status": "ok", "service": "impetus-lock", "version": "0.1.0"}
    """
    return HealthResponse(
        status="ok",
        service="impetus-lock",
        version="0.1.0",
    )


@app.get("/health/db")
async def health_db() -> dict[str, Any]:
    """Database health check endpoint with pool metrics.

    Returns detailed database connectivity status and pool utilization.

    Returns:
        dict: Database health status with metrics.
    """
    health = await db_health_check()
    return health.to_dict()


@app.middleware("http")
async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Log every HTTP request with duration and LLM metadata."""

    request_id = uuid.uuid4().hex
    request.state.request_id = request_id
    start = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": status_code,
            "duration_ms": duration_ms,
            "llm_provider": getattr(request.state, "llm_provider", None),
            "llm_override": getattr(request.state, "llm_override", False),
        }
        logger.info("http_request", extra=extra)
