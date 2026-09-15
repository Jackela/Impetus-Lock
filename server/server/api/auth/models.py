"""Authentication models."""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Credentials submitted by a user to obtain an access token.

    Attributes:
        email: The user's email address.
        password: The user's plaintext password.
    """

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Access token issued after a successful login.

    Attributes:
        access_token: The signed JWT to send as a bearer credential.
        token_type: Token scheme; always "bearer".
    """

    access_token: str
    token_type: str = "bearer"
