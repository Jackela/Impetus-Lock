"""Authentication routes."""

from fastapi import APIRouter, Response

from server.api.auth.models import LoginRequest
from server.infrastructure.security.csrf import CSRFProtection
from server.infrastructure.security.jwt_handler import JWTHandler

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
async def login(credentials: LoginRequest, response: Response):
    # TODO: Implement actual user authentication
    # For now, create a demo token
    token = JWTHandler.create_token("demo-user-id")

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=86400,
    )

    csrf_token = CSRFProtection().generate_token()
    response.set_cookie(key="csrf_token", value=csrf_token, secure=True, samesite="strict")

    return {"message": "Login successful", "csrf_token": csrf_token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("csrf_token")
    return {"message": "Logout successful"}
