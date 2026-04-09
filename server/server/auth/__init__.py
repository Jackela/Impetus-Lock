"""Authentication module for Impetus Lock.

Provides user registration, login, logout, and session management.

@module auth
"""

from server.auth.dependencies import get_current_user, get_current_user_optional
from server.auth.router import router
from server.auth.service import AuthService, AuthResult
from server.auth.utils import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

__all__ = [
    "router",
    "AuthService",
    "AuthResult",
    "get_current_user",
    "get_current_user_optional",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
]
