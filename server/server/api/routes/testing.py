"""Test-only API routes.

Provides endpoints for E2E testing that are only available when TESTING=true.
These endpoints allow deterministic testing of random/timed behaviors.

Constitutional Compliance:
- Article I (Simplicity): Simple test helpers, no production code
- Article V (Documentation): Complete API documentation
"""

import logging
import os
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.security.csrf import CSRFProtection
from server.infrastructure.security.jwt_handler import JWTHandler

router = APIRouter(prefix="/test", tags=["testing"])
logger = logging.getLogger("server.api.testing")


def _check_testing_enabled() -> None:
    """Verify testing mode is enabled.

    Raises:
        HTTPException: 403 if TESTING environment variable is not set to "1".
    """
    # P1 Security Fix: Strict check for TESTING="1" only
    if os.getenv("TESTING") != "1":
        logger.warning(
            "Attempted access to test endpoints with invalid TESTING value",
            extra={
                "testing_env": os.getenv("TESTING"),
                "remote_addr": None,  # Will be set by middleware if available
            },
        )
        raise HTTPException(
            status_code=403,
            detail="Test endpoints are disabled. Set TESTING=1 to enable.",
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

        curl -X POST http://localhost:8000/test/trigger-delete \
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
        source="loki",
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
        curl -X POST http://localhost:8000/test/trigger-provoke
        ```
    """
    _check_testing_enabled()

    return InterventionResponse(
        action="provoke",
        content="Test intervention content",
        lock_id=f"lock_test_{uuid4()}",
        anchor=AnchorPos(from_=0),  # Insert at start
        action_id=f"act_test_{uuid4()}",
        issued_at=datetime.now(UTC),
        source="muse",
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
        curl http://localhost:8000/test/health
        ```
    """
    testing_enabled = bool(os.getenv("TESTING"))

    return TestHealthResponse(
        testing_enabled=testing_enabled,
        message="Test endpoints active" if testing_enabled else "Test endpoints disabled",
    )


# Debug authentication endpoints for E2E testing
# These allow E2E tests to authenticate without database credentials


class TestLoginResponse(BaseModel):
    """Test login response with CSRF token."""

    message: str
    csrf_token: str


@router.post("/login", response_model=TestLoginResponse)
async def test_login(response: Response) -> TestLoginResponse:
    """Test-only: Debug login for E2E tests.

    Creates a test JWT token and CSRF token without requiring database credentials.
    Only available when TESTING=true.

    Returns:
        TestLoginResponse: Login success message and CSRF token.

    Example:
        ```bash
        curl -X POST http://localhost:8000/test/login
        ```
    """
    _check_testing_enabled()

    # Ensure JWT_SECRET is set for testing
    os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-e2e-only")
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-e2e-only")

    # Create test token
    token = JWTHandler.create_token("demo-user-id")

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,  # Allow HTTP for local E2E testing
        samesite="lax",
        max_age=86400,
    )

    csrf_token = CSRFProtection().generate_token()
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        secure=False,  # Allow HTTP for local E2E testing
        samesite="lax",
    )

    return TestLoginResponse(message="Login successful", csrf_token=csrf_token)


@router.post("/logout")
async def test_logout(response: Response) -> dict[str, str]:
    """Test-only: Debug logout for E2E tests.

    Clears authentication cookies. Only available when TESTING=true.

    Returns:
        dict: Logout success message.

    Example:
        ```bash
        curl -X POST http://localhost:8000/test/logout
        ```
    """
    _check_testing_enabled()

    response.delete_cookie(key="access_token")
    response.delete_cookie(key="csrf_token")

    return {"message": "Logout successful"}
