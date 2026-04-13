"""Authentication API router.

@module auth.router
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth.dependencies import get_current_user
from server.auth.service import AuthResult, get_auth_service
from server.infrastructure.persistence.database import get_session
from server.models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])


class RegisterRequest(BaseModel):
    """User registration request."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "securePassword123",
            }
        }
    }

    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    """User login request."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "securePassword123",
            }
        }
    }

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response without sensitive data."""

    model_config = {"from_attributes": True}

    id: str
    email: str


class AuthResponse(BaseModel):
    """Authentication response with user data."""

    user: UserResponse


def _set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication cookie.

    Args:
        response: FastAPI response object.
        token: JWT access token.
    """
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=86400,  # 24 hours
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie.

    Args:
        response: FastAPI response object.
    """
    response.delete_cookie(key="access_token", path="/")


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    request: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Register a new user.

    Args:
        request: Registration request with email and password.
        response: Response object for setting cookies.
        session: Database session.

    Returns:
        User data on success.

    Raises:
        HTTPException: 400 if email already registered.
    """
    # Validate password length
    if len(request.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    service = get_auth_service(session)
    result: AuthResult = await service.register(request.email, request.password)

    if not result.success or result.user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.error_message or "Registration failed",
        )

    # Set auth cookie
    if result.token:
        _set_auth_cookie(response, result.token)

    return AuthResponse(user=UserResponse(id=str(result.user.id), email=result.user.email))


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
) -> AuthResponse:
    """Login a user.

    Args:
        request: Login request with email and password.
        response: Response object for setting cookies.
        session: Database session.

    Returns:
        User data on success.

    Raises:
        HTTPException: 401 if credentials invalid.
    """
    service = get_auth_service(session)
    result: AuthResult = await service.login(request.email, request.password)

    if not result.success or result.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result.error_message or "Authentication failed",
        )

    # Set auth cookie
    if result.token:
        _set_auth_cookie(response, result.token)

    return AuthResponse(user=UserResponse(id=str(result.user.id), email=result.user.email))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    access_token: Annotated[str | None, Cookie()] = None,
) -> None:
    """Logout the current user.

    Args:
        response: Response object for clearing cookies.
        access_token: Current access token (optional).
    """
    # Clear the auth cookie regardless of token state
    _clear_auth_cookie(response)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get current authenticated user info.

    Args:
        current_user: Current authenticated user from dependency.

    Returns:
        User data.
    """
    return UserResponse(id=str(current_user.id), email=current_user.email)
