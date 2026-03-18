"""CSRF token generation and validation."""

import secrets
from itsdangerous import URLSafeTimedSerializer
import os


class CSRFProtection:
    def __init__(self):
        secret = os.getenv("SECRET_KEY")
        if not secret:
            raise ValueError("SECRET_KEY not set")
        self._serializer = URLSafeTimedSerializer(secret)

    def generate_token(self) -> str:
        return secrets.token_urlsafe(32)

    def validate_token(self, token: str, max_age: int = 3600) -> bool:
        try:
            self._serializer.loads(token, max_age=max_age)
            return True
        except:
            return False
