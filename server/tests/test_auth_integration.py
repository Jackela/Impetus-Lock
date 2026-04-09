"""Integration tests for authentication flow.

Tests complete auth flow: register -> login -> access protected resource -> logout

@module tests/test_auth_integration
"""

import pytest
from httpx import AsyncClient


class TestAuthFlow:
    """Test complete authentication flow."""

    @pytest.mark.asyncio
    async def test_complete_auth_flow(self, async_client: AsyncClient) -> None:
        """Test register -> login -> access protected -> logout flow."""
        # 1. Register
        register_response = await async_client.post(
            "/auth/register",
            json={
                "email": "flowtest@example.com",
                "password": "securePassword123",
            },
        )
        assert register_response.status_code == 201
        assert "set-cookie" in register_response.headers

        # 2. Access protected resource (should work with cookie)
        me_response = await async_client.get("/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["email"] == "flowtest@example.com"

        # 3. Logout
        logout_response = await async_client.post("/auth/logout")
        assert logout_response.status_code == 204

        # 4. Access protected resource (should fail after logout)
        me_after_logout = await async_client.get("/auth/me")
        assert me_after_logout.status_code == 401

    @pytest.mark.asyncio
    async def test_login_with_wrong_password(self, async_client: AsyncClient) -> None:
        """Test login with incorrect password."""
        # Register first
        await async_client.post(
            "/auth/register",
            json={
                "email": "wrongpass@example.com",
                "password": "correctPassword123",
            },
        )

        # Try login with wrong password
        login_response = await async_client.post(
            "/auth/login",
            json={
                "email": "wrongpass@example.com",
                "password": "wrongPassword123",
            },
        )
        assert login_response.status_code == 401
        data = login_response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_access_protected_without_auth(self, async_client: AsyncClient) -> None:
        """Test accessing protected endpoint without authentication."""
        response = await async_client.get("/tasks/")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_user_isolation(self, async_client: AsyncClient) -> None:
        """Test that users cannot see each other's tasks."""
        # Register user 1 and create task
        await async_client.post(
            "/auth/register",
            json={
                "email": "user1@example.com",
                "password": "securePassword123",
            },
        )

        create_response = await async_client.post(
            "/tasks/",
            json={
                "content": "User 1's private task",
                "lock_ids": [],
            },
        )
        assert create_response.status_code == 201
        task_id = create_response.json()["id"]

        # Logout user 1
        await async_client.post("/auth/logout")

        # Register user 2
        await async_client.post(
            "/auth/register",
            json={
                "email": "user2@example.com",
                "password": "securePassword123",
            },
        )

        # User 2 tries to access user 1's task
        get_response = await async_client.get(f"/tasks/{task_id}")
        assert get_response.status_code == 404  # Not found for user 2

        # User 2's task list should be empty
        list_response = await async_client.get("/tasks/")
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert list_data["total"] == 0
