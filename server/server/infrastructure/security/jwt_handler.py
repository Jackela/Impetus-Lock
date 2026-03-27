"""JWT token generation and validation."""

import os
from datetime import datetime, timedelta
from typing import Any

import jwt


class JWTHandler:
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE = timedelta(hours=24)

    @classmethod
    def create_token(cls, user_id: str, **claims: Any) -> str:
        payload = {
            "sub": user_id,
            "exp": datetime.utcnow() + cls.ACCESS_TOKEN_EXPIRE,
            "iat": datetime.utcnow(),
            **claims,
        }
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise ValueError("JWT_SECRET not set")
        return str(jwt.encode(payload, secret, algorithm=cls.ALGORITHM))

    @classmethod
    def verify_token(cls, token: str) -> dict[str, Any]:
        secret = os.getenv("JWT_SECRET")
        if not secret:
            raise ValueError("JWT_SECRET not set")
        return dict(jwt.decode(token, secret, algorithms=[cls.ALGORITHM]))
