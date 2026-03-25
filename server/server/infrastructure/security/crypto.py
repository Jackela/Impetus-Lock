"""Cryptographic services for sensitive data protection."""

import os

from cryptography.fernet import Fernet


class CryptoService:
    def __init__(self) -> None:
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("ENCRYPTION_KEY environment variable not set")
        self._fernet = Fernet(key.encode())

    def encrypt(self, data: str) -> str:
        return self._fernet.encrypt(data.encode()).decode()

    def decrypt(self, token: str) -> str:
        return self._fernet.decrypt(token.encode()).decode()
