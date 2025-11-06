"""
FastAPI main application entry point.

This module defines the core FastAPI application with health check endpoint.
Follows Article IV (SOLID): Endpoints delegate to service layer when business logic emerges.
"""

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Impetus Lock API",
    version="0.1.0",
    description="Un-deletable task pressure system API",
)


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
