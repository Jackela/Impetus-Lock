"""FastAPI main application entry point with structured logging."""

import logging
import os
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.api.routes import intervention, metrics, tasks
from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderRegistry
from server.infrastructure.logging.json_formatter import setup_json_logging
from server.infrastructure.persistence.database import (
    get_db_manager,
    init_database,
    is_database_initialized,
)

# Load environment variables from .env file
load_dotenv()
setup_json_logging(os.getenv("LOG_LEVEL", "INFO"))

logger = logging.getLogger("server.api")

# Conditionally import testing routes
if os.getenv("TESTING"):
    from server.api.routes import testing


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize shared resources and close them on shutdown."""

    init_database()
    app.state.idempotency_cache = AsyncIdempotencyCache(ttl=15)
    app.state.provider_registry = ProviderRegistry()
    try:
        yield
    finally:
        if is_database_initialized():
            await get_db_manager().close()


app = FastAPI(
    title="Impetus Lock API",
    version="0.1.0",
    description="Un-deletable task pressure system API",
    lifespan=lifespan,
)


# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(intervention.router)
app.include_router(tasks.router)
app.include_router(metrics.router)

# Include testing routes (only when TESTING=true)
if os.getenv("TESTING"):
    app.include_router(testing.router)


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
