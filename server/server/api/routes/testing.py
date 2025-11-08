"""Test-only API routes.

Provides endpoints for E2E testing that are only available when TESTING=true.
These endpoints allow deterministic testing of random/timed behaviors.

Constitutional Compliance:
- Article I (Simplicity): Simple test helpers, no production code
- Article V (Documentation): Complete API documentation
"""

import os
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.domain.models.anchor import AnchorRange
from server.domain.models.intervention import InterventionResponse

router = APIRouter(prefix="/api/v1/test", tags=["testing"])


def _check_testing_enabled() -> None:
    """Verify testing mode is enabled.

    Raises:
        HTTPException: 403 if TESTING environment variable is not set.
    """
    if not os.getenv("TESTING"):
        raise HTTPException(
            status_code=403,
            detail="Test endpoints are disabled. Set TESTING=true to enable.",
        )


class TestTriggerDeleteRequest(BaseModel):
    """Request for triggering test DELETE action."""

    from_pos: int
    to_pos: int
    context: str = "Test context for DELETE action"


@router.post("/trigger-delete", response_model=InterventionResponse)
def trigger_delete_action(request: TestTriggerDeleteRequest) -> InterventionResponse:
    """Test-only: Trigger DELETE action immediately.

    This endpoint allows E2E tests to trigger DELETE actions without waiting
    for Loki mode's random timer (30-120s). Only available when TESTING=true.

    Args:
        request: DELETE action parameters.

    Returns:
        InterventionResponse: DELETE action response.

    Raises:
        HTTPException: 403 if testing mode disabled.

    Example:
        ```bash
        TESTING=true poetry run uvicorn server.api.main:app --reload

        curl -X POST http://localhost:8000/api/v1/test/trigger-delete \
          -H "Content-Type: application/json" \
          -d '{"from_pos": 10, "to_pos": 20, "context": "Test context"}'
        ```
    """
    _check_testing_enabled()

    return InterventionResponse(
        action="delete",
        anchor=AnchorRange(from_=request.from_pos, to=request.to_pos),
        action_id=f"act_test_{uuid4()}",
        issued_at=datetime.now(UTC),
    )


@router.post("/trigger-provoke", response_model=InterventionResponse)
def trigger_provoke_action() -> InterventionResponse:
    """Test-only: Trigger PROVOKE action immediately.

    This endpoint allows E2E tests to trigger PROVOKE actions on demand.
    Only available when TESTING=true.

    Returns:
        InterventionResponse: PROVOKE action response.

    Raises:
        HTTPException: 403 if testing mode disabled.

    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/test/trigger-provoke
        ```
    """
    _check_testing_enabled()

    return InterventionResponse(
        action="provoke",
        content="> [AI施压 - Test]: Test intervention content",
        lock_id=f"lock_test_{uuid4()}",
        anchor=AnchorRange(from_=0, to=0),  # Insert at start
        action_id=f"act_test_{uuid4()}",
        issued_at=datetime.now(UTC),
    )


class TestHealthResponse(BaseModel):
    """Test endpoint health response."""

    testing_enabled: bool
    message: str


@router.get("/health", response_model=TestHealthResponse)
def test_health() -> TestHealthResponse:
    """Test endpoint health check.

    Returns:
        TestHealthResponse: Testing mode status.

    Example:
        ```bash
        curl http://localhost:8000/api/v1/test/health
        ```
    """
    testing_enabled = bool(os.getenv("TESTING"))

    return TestHealthResponse(
        testing_enabled=testing_enabled,
        message="Test endpoints active" if testing_enabled else "Test endpoints disabled",
    )
