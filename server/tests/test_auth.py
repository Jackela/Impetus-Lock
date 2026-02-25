"""Tests for authentication endpoints.

Tests cover:
- User registration
- Login and token generation
- Token validation
- Current user profile
"""

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.infrastructure.persistence.database import get_session
from tests.conftest import init_test_db, get_test_session, cleanup_test_db

# Override dependency
app.dependency_overrides[get_session] = get_test_session

# Initialize database synchronously before tests
import asyncio
asyncio.run(init_test_db())

client = TestClient(app)


class TestAuthEndpoints:
    """Test suite for authentication endpoints."""

    def test_register_user_success(self):
        """Test successful user registration."""
        response = client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"
        assert data["subscription_tier"] == "free"
        assert "id" in data

    def test_register_duplicate_username(self):
        """Test registration with duplicate username."""
        # First registration
        client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test1@example.com",
                "password": "test123456",
            },
        )

        # Second registration with same username
        response = client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test2@example.com",
                "password": "test123456",
            },
        )

        assert response.status_code == 400
        assert "Username already exists" in response.json()["detail"]

    def test_register_duplicate_email(self):
        """Test registration with duplicate email."""
        # First registration
        client.post(
            "/auth/register",
            json={
                "username": "testuser1",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        # Second registration with same email
        response = client.post(
            "/auth/register",
            json={
                "username": "testuser2",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        assert response.status_code == 400
        assert "Email already exists" in response.json()["detail"]

    def test_login_success(self):
        """Test successful login."""
        # Register user
        client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        # Login
        response = client.post(
            "/auth/login",
            json={
                "username": "testuser",
                "password": "test123456",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == 1800  # 30 minutes

    def test_login_invalid_username(self):
        """Test login with invalid username."""
        response = client.post(
            "/auth/login",
            json={
                "username": "nonexistent",
                "password": "test123456",
            },
        )

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_login_invalid_password(self):
        """Test login with invalid password."""
        # Register user
        client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        # Login with wrong password
        response = client.post(
            "/auth/login",
            json={
                "username": "testuser",
                "password": "wrongpassword",
            },
        )

        assert response.status_code == 401
        assert "Incorrect username or password" in response.json()["detail"]

    def test_get_current_user_success(self):
        """Test getting current user with valid token."""
        # Register and login
        client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        login_response = client.post(
            "/auth/login",
            json={
                "username": "testuser",
                "password": "test123456",
            },
        )

        token = login_response.json()["access_token"]

        # Get current user
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_get_current_user_invalid_token(self):
        """Test getting current user with invalid token."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token"},
        )

        assert response.status_code == 401

    def test_refresh_token_success(self):
        """Test refreshing access token."""
        # Register and login
        client.post(
            "/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "test123456",
            },
        )

        login_response = client.post(
            "/auth/login",
            json={
                "username": "testuser",
                "password": "test123456",
            },
        )

        refresh_token = login_response.json()["refresh_token"]

        # Refresh token
        response = client.post(
            "/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
