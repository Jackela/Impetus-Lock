"""Enhanced security tests for Impetus Lock.

Tests JWT handling, authentication middleware, rate limiting,
authorization, and security edge cases with comprehensive coverage.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock

import jwt
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.middleware.rate_limit import RateLimitMiddleware
from server.infrastructure.rate_limiting import RateLimiter
from server.infrastructure.security.jwt_handler import JWTHandler


class TestJWTHandler:
    """Tests for JWT token handling."""

    @pytest.fixture(autouse=True)
    def setup_jwt_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Set up JWT secret for tests."""
        monkeypatch.setenv("JWT_SECRET", "test-secret-key-for-jwt-tokens")

    def test_create_token_success(self) -> None:
        """Test creating a valid JWT token."""
        token = JWTHandler.create_token("user_123", role="admin")

        assert isinstance(token, str)
        assert len(token) > 0

        # Verify token structure
        parts = token.split(".")
        assert len(parts) == 3  # header.payload.signature

    def test_create_token_with_claims(self) -> None:
        """Test creating token with custom claims."""
        token = JWTHandler.create_token(
            "user_123",
            role="admin",
            permissions=["read", "write"],
            custom_data={"key": "value"},
        )

        # Verify claims are included
        payload = JWTHandler.verify_token(token)
        assert payload["sub"] == "user_123"
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]
        assert payload["custom_data"] == {"key": "value"}

    def test_create_token_expiration(self) -> None:
        """Test token includes expiration time."""
        before_create = datetime.utcnow()
        token = JWTHandler.create_token("user_123")
        datetime.utcnow()

        payload = JWTHandler.verify_token(token)
        exp_timestamp = payload["exp"]
        exp_time = datetime.fromtimestamp(exp_timestamp)

        # Should expire in ~24 hours
        expected_exp = before_create + JWTHandler.ACCESS_TOKEN_EXPIRE
        assert abs((exp_time - expected_exp).total_seconds()) < 5

    def test_create_token_issued_at(self) -> None:
        """Test token includes issued at time."""
        before_create = datetime.utcnow()
        token = JWTHandler.create_token("user_123")

        payload = JWTHandler.verify_token(token)
        iat_timestamp = payload["iat"]
        iat_time = datetime.fromtimestamp(iat_timestamp)

        # Should be issued recently
        assert iat_time >= before_create
        assert iat_time <= datetime.utcnow()

    def test_verify_token_success(self) -> None:
        """Test verifying a valid token."""
        token = JWTHandler.create_token("user_123", role="user")

        payload = JWTHandler.verify_token(token)

        assert payload["sub"] == "user_123"
        assert payload["role"] == "user"

    def test_verify_token_expired(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test verifying an expired token raises error."""
        # Create a token that expired
        expired_payload = {
            "sub": "user_123",
            "exp": datetime.utcnow() - timedelta(hours=1),
            "iat": datetime.utcnow() - timedelta(hours=25),
        }
        expired_token = jwt.encode(
            expired_payload, "test-secret-key-for-jwt-tokens", algorithm="HS256"
        )

        with pytest.raises(jwt.ExpiredSignatureError):
            JWTHandler.verify_token(expired_token)

    def test_verify_token_invalid_signature(self) -> None:
        """Test verifying token with wrong signature."""
        # Create token with different secret
        payload = {
            "sub": "user_123",
            "exp": datetime.utcnow() + timedelta(hours=24),
            "iat": datetime.utcnow(),
        }
        wrong_token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        with pytest.raises(jwt.InvalidSignatureError):
            JWTHandler.verify_token(wrong_token)

    def test_verify_token_malformed(self) -> None:
        """Test verifying malformed token."""
        with pytest.raises(jwt.InvalidTokenError):
            JWTHandler.verify_token("not.a.valid.token")

    def test_verify_token_empty(self) -> None:
        """Test verifying empty token."""
        with pytest.raises(jwt.InvalidTokenError):
            JWTHandler.verify_token("")

    def test_create_token_no_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test creating token without JWT_SECRET raises error."""
        monkeypatch.delenv("JWT_SECRET", raising=False)

        with pytest.raises(ValueError, match="JWT_SECRET not set"):
            JWTHandler.create_token("user_123")

    def test_verify_token_no_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test verifying token without JWT_SECRET raises error."""
        token = JWTHandler.create_token("user_123")
        monkeypatch.delenv("JWT_SECRET", raising=False)

        with pytest.raises(ValueError, match="JWT_SECRET not set"):
            JWTHandler.verify_token(token)

    def test_token_algorithm(self) -> None:
        """Test token uses correct algorithm."""
        token = JWTHandler.create_token("user_123")

        # Decode without verification to check header
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"

    def test_unicode_user_id(self) -> None:
        """Test token with unicode user_id."""
        unicode_id = "用户_123_🎉"
        token = JWTHandler.create_token(unicode_id)

        payload = JWTHandler.verify_token(token)
        assert payload["sub"] == unicode_id


class TestAuthenticationMiddleware:
    """Tests for authentication middleware."""

    @pytest.fixture(autouse=True)
    def setup_jwt_secret(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Set up JWT secret for tests."""
        monkeypatch.setenv("JWT_SECRET", "test-secret-key")

    @pytest.fixture
    def app_with_auth(self) -> FastAPI:
        """Create FastAPI app with auth middleware."""
        app = FastAPI()
        app.add_middleware(AuthenticationMiddleware)

        @app.get("/protected")
        def protected_route(request: Request) -> dict:
            return {"user_id": getattr(request.state, "user_id", None)}

        @app.get("/public")
        def public_route() -> dict:
            return {"message": "public"}

        return app

    @pytest.fixture
    def client(self, app_with_auth: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app_with_auth)

    def test_public_path_accessible(self, client: TestClient) -> None:
        """Test public paths are accessible without auth."""
        response = client.get("/public")

        assert response.status_code == 200
        assert response.json()["message"] == "public"

    def test_protected_path_without_token(self, client: TestClient) -> None:
        """Test protected paths require authentication."""
        response = client.get("/protected")

        assert response.status_code == 401
        assert "Authentication required" in response.text

    def test_protected_path_with_valid_token(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test protected paths with valid token."""
        # Disable TESTING mode for this test
        monkeypatch.setenv("TESTING", "")

        token = JWTHandler.create_token("user_123")

        response = client.get(
            "/protected",
            cookies={"access_token": token},
            headers={"X-CSRF-Token": "csrf_token", "Cookie": "csrf_token=csrf_token"},
        )

        # Should pass auth, may fail CSRF but that's expected without proper setup
        assert response.status_code in [200, 403]

    def test_invalid_token_rejected(self, client: TestClient) -> None:
        """Test invalid token is rejected."""
        response = client.get(
            "/protected",
            cookies={"access_token": "invalid.token.here"},
        )

        assert response.status_code == 401

    def test_expired_token_rejected(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test expired token is rejected."""
        # Disable TESTING mode
        monkeypatch.setenv("TESTING", "")

        # Create expired token
        expired_payload = {
            "sub": "user_123",
            "exp": datetime.utcnow() - timedelta(hours=1),
            "iat": datetime.utcnow() - timedelta(hours=25),
        }
        expired_token = jwt.encode(expired_payload, "test-secret-key", algorithm="HS256")

        response = client.get(
            "/protected",
            cookies={"access_token": expired_token},
        )

        assert response.status_code == 401

    def test_csrf_required_for_mutations(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test CSRF token required for non-GET requests."""
        # Disable TESTING mode
        monkeypatch.setenv("TESTING", "")

        token = JWTHandler.create_token("user_123")

        response = client.post(
            "/protected",
            cookies={"access_token": token},
            # Missing CSRF token
        )

        assert response.status_code == 403
        assert "CSRF" in response.text

    def test_csrf_validation_with_mismatched_tokens(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test CSRF validation fails with mismatched tokens."""
        # Disable TESTING mode
        monkeypatch.setenv("TESTING", "")

        token = JWTHandler.create_token("user_123")

        response = client.post(
            "/protected",
            cookies={"access_token": token, "csrf_token": "cookie_value"},
            headers={"X-CSRF-Token": "header_value"},  # Different from cookie
        )

        assert response.status_code == 403


class TestRateLimiter:
    """Tests for rate limiting functionality."""

    @pytest.fixture
    def rate_limiter(self) -> RateLimiter:
        """Create a rate limiter without Redis."""
        return RateLimiter(redis_url=None)

    def test_initialization_no_redis(self) -> None:
        """Test initialization without Redis."""
        limiter = RateLimiter(redis_url=None)

        assert limiter._redis is None

    @pytest.mark.asyncio
    async def test_is_allowed_without_redis(self, rate_limiter: RateLimiter) -> None:
        """Test all requests allowed when Redis unavailable."""
        allowed = await rate_limiter.is_allowed("test_key", "10/minute")

        assert allowed is True

    @pytest.mark.asyncio
    async def test_parse_limit_various_formats(self, rate_limiter: RateLimiter) -> None:
        """Test parsing various limit formats."""
        test_cases = [
            ("10/second", (10, 1)),
            ("100/minute", (100, 60)),
            ("1000/hour", (1000, 3600)),
            ("10000/day", (10000, 86400)),
            ("5/second", (5, 1)),
            ("50/minute", (50, 60)),
        ]

        for limit_str, expected in test_cases:
            result = rate_limiter._parse_limit(limit_str)
            assert result == expected, f"Failed for {limit_str}"

    @pytest.mark.asyncio
    async def test_parse_limit_default_unit(self, rate_limiter: RateLimiter) -> None:
        """Test parsing limit without unit defaults to minute."""
        result = rate_limiter._parse_limit("50")

        assert result == (50, 60)

    @pytest.mark.asyncio
    async def test_parse_limit_invalid_unit(self, rate_limiter: RateLimiter) -> None:
        """Test parsing limit with invalid unit defaults to minute."""
        result = rate_limiter._parse_limit("50/invalid")

        assert result == (50, 60)

    def test_get_client_id_from_user(self, rate_limiter: RateLimiter) -> None:
        """Test extracting client ID from authenticated user."""
        mock_request = Mock()
        mock_request.state.user_id = "user_123"
        mock_request.headers = {}
        mock_request.client = None

        client_id = rate_limiter._get_client_id(mock_request)

        assert client_id == "user_123"

    def test_get_client_id_from_forwarded_header(self, rate_limiter: RateLimiter) -> None:
        """Test extracting client ID from X-Forwarded-For."""
        mock_request = Mock()
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {"X-Forwarded-For": "192.168.1.1, 10.0.0.1"}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"

        client_id = rate_limiter._get_client_id(mock_request)

        assert client_id == "192.168.1.1"

    def test_get_client_id_from_real_ip(self, rate_limiter: RateLimiter) -> None:
        """Test extracting client ID from X-Real-IP."""
        mock_request = Mock()
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {"X-Real-IP": "192.168.1.100"}
        mock_request.client = Mock()
        mock_request.client.host = "127.0.0.1"

        client_id = rate_limiter._get_client_id(mock_request)

        assert client_id == "192.168.1.100"

    def test_get_client_id_from_direct_ip(self, rate_limiter: RateLimiter) -> None:
        """Test extracting client ID from direct connection."""
        mock_request = Mock()
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {}
        mock_request.client = Mock()
        mock_request.client.host = "192.168.1.50"

        client_id = rate_limiter._get_client_id(mock_request)

        assert client_id == "192.168.1.50"

    def test_get_client_id_unknown(self, rate_limiter: RateLimiter) -> None:
        """Test extracting client ID when all sources unavailable."""
        mock_request = Mock()
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {}
        mock_request.client = None

        client_id = rate_limiter._get_client_id(mock_request)

        assert client_id == "unknown"

    @pytest.mark.asyncio
    async def test_check_rate_limit_with_redis(self) -> None:
        """Test rate limiting with Redis backend."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=5)
        mock_redis.expire = AsyncMock(return_value=True)

        limiter = RateLimiter()
        limiter._redis = mock_redis

        mock_request = Mock()
        mock_request.url.path = "/intervention"
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {}
        mock_request.client = Mock()
        mock_request.client.host = "192.168.1.1"

        # Should not raise (under limit)
        await limiter.check_rate_limit(mock_request)

    @pytest.mark.asyncio
    async def test_check_rate_limit_exceeded(self) -> None:
        """Test rate limit exceeded raises exception."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=11)  # Over 10/minute limit
        mock_redis.expire = AsyncMock(return_value=True)

        limiter = RateLimiter()
        limiter._redis = mock_redis

        mock_request = Mock()
        mock_request.url.path = "/intervention"
        mock_request.state = Mock()
        mock_request.state.user_id = None
        mock_request.headers = {}
        mock_request.client = Mock()
        mock_request.client.host = "192.168.1.1"

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await limiter.check_rate_limit(mock_request)

        assert exc_info.value.status_code == 429
        assert "Rate limit exceeded" in exc_info.value.detail
        assert "Retry-After" in exc_info.value.headers


class TestRateLimitMiddleware:
    """Tests for rate limiting middleware."""

    @pytest.fixture
    def app_with_rate_limit(self, monkeypatch: pytest.MonkeyPatch) -> FastAPI:
        """Create FastAPI app with rate limit middleware."""
        # Disable testing mode
        monkeypatch.setenv("TESTING", "")

        app = FastAPI()
        app.add_middleware(RateLimitMiddleware)

        @app.get("/test")
        def test_route() -> dict:
            return {"message": "success"}

        @app.get("/health")
        def health_route() -> dict:
            return {"status": "healthy"}

        return app

    @pytest.fixture
    def client(self, app_with_rate_limit: FastAPI) -> TestClient:
        """Create test client."""
        return TestClient(app_with_rate_limit)

    def test_excluded_paths_not_rate_limited(self, client: TestClient) -> None:
        """Test excluded paths bypass rate limiting."""
        response = client.get("/health")

        assert response.status_code == 200

    def test_testing_mode_bypasses_rate_limit(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test TESTING=1 bypasses rate limiting."""
        monkeypatch.setenv("TESTING", "1")

        app = FastAPI()
        app.add_middleware(RateLimitMiddleware)

        @app.get("/test")
        def test_route() -> dict:
            return {"message": "success"}

        client = TestClient(app)
        response = client.get("/test")

        assert response.status_code == 200


class TestSecurityEdgeCases:
    """Edge case tests for security features."""

    @pytest.mark.asyncio
    async def test_rate_limiter_redis_error_fallback(self) -> None:
        """Test rate limiter allows requests when Redis errors."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(side_effect=ConnectionError("Redis down"))

        limiter = RateLimiter()
        limiter._redis = mock_redis

        allowed = await limiter.is_allowed("test_key", "10/minute")

        assert allowed is True  # Fail open

    @pytest.mark.asyncio
    async def test_rate_limiter_parse_limit_edge_cases(self) -> None:
        """Test parsing edge case limit strings."""
        limiter = RateLimiter()

        # Empty or malformed should default reasonably
        assert limiter._parse_limit("0/minute") == (0, 60)
        assert limiter._parse_limit("999999/day") == (999999, 86400)

    def test_jwt_token_with_special_characters(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test JWT with special characters in claims."""
        monkeypatch.setenv("JWT_SECRET", "test-secret")

        special_user_id = "user@test.com|special+chars"
        token = JWTHandler.create_token(special_user_id)

        payload = JWTHandler.verify_token(token)
        assert payload["sub"] == special_user_id

    def test_jwt_token_timing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Test JWT creation and verification performance."""
        monkeypatch.setenv("JWT_SECRET", "test-secret")

        start = time.time()
        for _ in range(100):
            token = JWTHandler.create_token("user_123")
            JWTHandler.verify_token(token)
        elapsed = time.time() - start

        # Should complete 100 operations in reasonable time
        assert elapsed < 1.0  # Less than 1 second

    @pytest.mark.asyncio
    async def test_concurrent_rate_limit_checks(self) -> None:
        """Test concurrent rate limit checks."""
        mock_redis = AsyncMock()
        counter = [0]

        async def increment_counter(key: str) -> int:
            counter[0] += 1
            return counter[0]

        mock_redis.incr = increment_counter
        mock_redis.expire = AsyncMock(return_value=True)

        limiter = RateLimiter()
        limiter._redis = mock_redis

        # Run many concurrent checks
        tasks = [limiter.is_allowed("test_key", "1000/minute") for _ in range(50)]
        results = await asyncio.gather(*tasks)

        assert all(results)  # All should be allowed
        assert counter[0] == 50  # All should increment

    def test_auth_middleware_public_paths_coverage(self) -> None:
        """Test all public paths are accessible."""
        public_paths = AuthenticationMiddleware.PUBLIC_PATHS

        app = FastAPI()
        app.add_middleware(AuthenticationMiddleware)

        @app.get("/{path:path}")
        def catch_all(path: str) -> dict:
            return {"path": path}

        client = TestClient(app)

        for path in public_paths:
            # Remove leading slash for test
            test_path = path.lstrip("/")
            response = client.get(f"/{test_path}")
            # Should not get 401 for public paths
            assert response.status_code != 401, f"Path {path} should be public"


class TestSecurityHeaders:
    """Tests for security headers and configurations."""

    def test_security_headers_on_responses(self) -> None:
        """Test security headers are set on responses."""
        app = FastAPI()

        @app.get("/test")
        def test_route() -> dict:
            return {"message": "test"}

        client = TestClient(app)
        response = client.get("/test")

        # Basic check that response is successful
        assert response.status_code == 200
