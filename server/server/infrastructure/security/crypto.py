"""Cryptographic services for sensitive data protection."""

import os

from cryptography.fernet import Fernet


class CryptoService:
    """Encrypt and decrypt sensitive strings using Fernet symmetric encryption."""

    def __init__(self) -> None:
        """Create a Fernet instance from the ENCRYPTION_KEY environment variable.

        Raises:
            ValueError: If ENCRYPTION_KEY is not set.
        """
        key = os.getenv("ENCRYPTION_KEY")
        if not key:
            raise ValueError("ENCRYPTION_KEY environment variable not set")
        self._fernet = Fernet(key.encode())

    def encrypt(self, data: str) -> str:
        """Encrypt a plaintext string.

        Args:
            data: The plaintext to encrypt.

        Returns:
            The encrypted, URL-safe token string.
        """
        return str(self._fernet.encrypt(data.encode()).decode())

    def decrypt(self, token: str) -> str:
        """Decrypt a token produced by encrypt.

        Args:
            token: The encrypted token string.

        Returns:
            The decrypted plaintext.

        Raises:
            cryptography.fernet.InvalidToken: If the token is invalid.
        """
        return str(self._fernet.decrypt(token.encode()).decode())
