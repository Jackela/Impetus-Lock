"""FastAPI dependencies for authentication.

@module auth.dependencies
"""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from server.auth.service import UserRepository, get_auth_service
from server.auth.utils import decode_access_token
from server.infrastructure.persistence.database import get_session
from server.models.user import User


async def get_current_user(
    access_token: Annotated[str | None, Cookie()] = None,
    session: AsyncSession = Depends(get_session),
) -> User:
    """Get current authenticated user from access token cookie.

    Args:
        access_token: JWT token from HttpOnly cookie.
        session: Database session.

    Returns:
        Authenticated User instance.

    Raises:
        HTTPException: 401 if token is missing or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if access_token is None:
        raise credentials_exception

    # Decode and validate token
    payload = decode_access_token(access_token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Get user from database
    from sqlalchemy import select
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_user_optional(
    access_token: Annotated[str | None, Cookie()] = None,
    session: AsyncSession = Depends(get_session),
) -> User | None:
    """Get current user if authenticated, None otherwise.

    Args:
        access_token: JWT token from HttpOnly cookie.
        session: Database session.

    Returns:
        User if authenticated, None otherwise.
    """
    if access_token is None:
        return None

    payload = decode_access_token(access_token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    from sqlalchemy import select
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()
