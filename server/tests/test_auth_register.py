"""Unit tests for user registration endpoint.

@module tests/test_auth_register
"""

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient

from server.auth.utils import verify_password


class TestRegisterEndpoint:
    """Test suite for POST /auth/register endpoint."""

    @pytest.mark.asyncio
    async def test_register_success(self, async_client: AsyncClient) -> None:
        """Test successful user registration."""
        response = await async_client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securePassword123",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "newuser@example.com"
        assert "id" in data["user"]
        # Password should not be in response
        assert "password" not in data["user"]

        # Check that cookie is set
        assert "set-cookie" in response.headers
        assert "access_token" in response.headers["set-cookie"]

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, async_client: AsyncClient) -> None:
        """Test registration with duplicate email fails."""
        # First registration
        await async_client.post(
            "/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "securePassword123",
            },
        )

        # Second registration with same email
        response = await async_client.post(
            "/auth/register",
            json={
                "email": "duplicate@example.com",
                "password": "anotherPassword123",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "already registered" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_weak_password(self, async_client: AsyncClient) -> None:
        """Test registration with weak password fails."""
        response = await async_client.post(
            "/auth/register",
            json={
                "email": "weak@example.com",
                "password": "short",
            },
        )

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "8 characters" in data["detail"]

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, async_client: AsyncClient) -> None:
        """Test registration with invalid email fails."""
        response = await async_client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "securePassword123",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_email(self, async_client: AsyncClient) -> None:
        """Test registration without email fails."""
        response = await async_client.post(
            "/auth/register",
            json={
                "password": "securePassword123",
            },
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_password(self, async_client: AsyncClient) -> None:
        """Test registration without password fails."""
        response = await async_client.post(
            "/auth/register",
            json={
                "email": "nopassword@example.com",
            },
        )

        assert response.status_code == 422
