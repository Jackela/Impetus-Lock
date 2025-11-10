"""
FastAPI main application entry point.

This module defines the core FastAPI application with health check endpoint.
Follows Article IV (SOLID): Endpoints delegate to service layer when business logic emerges.
"""

import os
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.api.routes import intervention, tasks
from server.infrastructure.persistence.database import init_database

# Load environment variables from .env file
load_dotenv()

# Conditionally import testing routes
if os.getenv("TESTING"):
    from server.api.routes import testing

app = FastAPI(
    title="Impetus Lock API",
    version="0.1.0",
    description="Un-deletable task pressure system API",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize database connection on startup."""
    init_database()


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
