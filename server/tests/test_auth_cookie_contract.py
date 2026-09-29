"""Regression tests for the mounted cookie authentication contract."""

from collections.abc import AsyncIterator
from http.cookies import SimpleCookie

import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

# Import before the fixture sets JWT_SECRET to exercise configuration time-of-read.
from server.auth.utils import create_access_token
from server.infrastructure.security.jwt_handler import JWTHandler


@pytest.fixture
async def mounted_auth_client(
    monkeypatch: pytest.MonkeyPatch, db_session: AsyncSession
) -> AsyncIterator[AsyncClient]:
    """Use the real app and auth service with middleware enabled and an isolated DB."""
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("JWT_SECRET", "r04-cookie-contract-test-secret-only")

    from server.api.main import app
    from server.infrastructure.persistence.database import get_session

    async def isolated_session() -> AsyncIterator[AsyncSession]:
        yield db_session

    previous_override = app.dependency_overrides.get(get_session)
    app.dependency_overrides[get_session] = isolated_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
        ) as client:
            yield client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_session, None)
        else:
            app.dependency_overrides[get_session] = previous_override


@pytest.mark.asyncio
async def test_protected_requests_reject_fallback_token_without_configured_secret(
    mounted_auth_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Missing JWT_SECRET must not authorize a real user with the development fallback."""
    registered = await mounted_auth_client.post(
        "/auth/register",
        json={"email": "r04-secret-boundary@example.com", "password": "securePassword123"},
    )
    assert registered.status_code == 201
    user_id = registered.json()["user"]["id"]

    # Set up a valid identity first, then sign with the utility's historical fallback.
    # Neither the middleware bypass nor a configured signing secret is available.
    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    mounted_auth_client.cookies.clear()
    mounted_auth_client.cookies.set("access_token", create_access_token(user_id))
    mounted_auth_client.cookies.set("csrf_token", "r04-boundary-csrf")

    read = await mounted_auth_client.get("/auth/me")
    write = await mounted_auth_client.post(
        "/auth/logout", headers={"X-CSRF-Token": "r04-boundary-csrf"}
    )
    # Report statuses only: failure evidence must never expose cookies or tokens.
    assert (read.status_code, write.status_code) == (401, 401)
    assert "email" not in read.json() and "id" not in read.json()


@pytest.mark.asyncio
async def test_mounted_middleware_accepts_existing_jwt_handler_token(
    mounted_auth_client: AsyncClient,
) -> None:
    """Existing UUID tokens need no added claims to pass the mounted middleware."""
    registered = await mounted_auth_client.post(
        "/auth/register",
        json={"email": "r04-legacy-token@example.com", "password": "securePassword123"},
    )
    assert registered.status_code == 201
    user_id = registered.json()["user"]["id"]
    mounted_auth_client.cookies.clear()
    mounted_auth_client.cookies.set("access_token", JWTHandler.create_token(user_id))
    mounted_auth_client.cookies.set("csrf_token", "r04-legacy-csrf")

    # /auth/me is GET-only: HEAD returning 405 shows that middleware admitted the
    # safe request, without involving the auth router's separate token decoder.
    safe = await mounted_auth_client.head("/auth/me")
    write = await mounted_auth_client.post(
        "/auth/logout", headers={"X-CSRF-Token": "r04-legacy-csrf"}
    )
    assert (safe.status_code, write.status_code) == (405, 204)


@pytest.mark.asyncio
async def test_register_issues_readable_csrf_cookie_with_auth_cookie_scope(
    mounted_auth_client: AsyncClient,
) -> None:
    """Registration supplies both cookies needed for subsequent authenticated writes."""
    response = await mounted_auth_client.post(
        "/auth/register",
        json={"email": "r04-cookie-contract@example.com", "password": "securePassword123"},
    )

    assert response.status_code == 201
    cookies: SimpleCookie[str] = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        cookies.load(header)

    # Compare names only so a failure never prints the access token.
    assert {"access_token", "csrf_token"}.issubset(set(cookies)), (
        f"Registration must issue access_token and csrf_token; got {sorted(cookies)}"
    )
    access_cookie = cookies["access_token"]
    csrf_cookie = cookies["csrf_token"]
    assert access_cookie["httponly"]
    assert csrf_cookie.value
    assert not csrf_cookie["httponly"]
    for attribute in ("path", "domain", "samesite", "secure", "max-age"):
        assert csrf_cookie[attribute] == access_cookie[attribute]


@pytest.mark.asyncio
async def test_login_read_and_logout_with_runtime_signing_configuration(
    mounted_auth_client: AsyncClient,
) -> None:
    """Issued cookies work for reads and CSRF-protected logout with a runtime secret."""
    credentials = {"email": "r04-flow@example.com", "password": "securePassword123"}
    registered = await mounted_auth_client.post("/auth/register", json=credentials)
    assert registered.status_code == 201
    initial_csrf = mounted_auth_client.cookies.get("csrf_token")
    # Login must independently issue both cookies, including a fresh CSRF value.
    mounted_auth_client.cookies.clear()
    logged_in = await mounted_auth_client.post("/auth/login", json=credentials)
    assert logged_in.status_code == 200
    assert sorted(mounted_auth_client.cookies.keys()) == ["access_token", "csrf_token"]
    csrf = mounted_auth_client.cookies.get("csrf_token")
    assert bool(csrf) and csrf != initial_csrf

    me = await mounted_auth_client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == credentials["email"]

    logged_out = await mounted_auth_client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logged_out.status_code == 204
    assert sorted(mounted_auth_client.cookies.keys()) == []
    assert (await mounted_auth_client.get("/auth/me")).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "claims",
    [
        pytest.param({"exp": 4102444800, "type": "access"}, id="missing-sub"),
        pytest.param({"sub": "not-a-uuid", "exp": 4102444800, "type": "access"}, id="bad-sub"),
        pytest.param({"sub": None, "exp": 4102444800, "type": "access"}, id="null-sub"),
        pytest.param({"sub": 123, "exp": 4102444800, "type": "access"}, id="numeric-sub"),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "type": "access"}, id="missing-exp"
        ),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "exp": 1, "type": "access"},
            id="expired",
        ),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "exp": "bad", "type": "access"},
            id="bad-exp",
        ),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "exp": None, "type": "access"},
            id="null-exp",
        ),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "exp": float("inf"), "type": "access"},
            id="infinite-exp",
        ),
        pytest.param(
            {"sub": "12345678-1234-1234-1234-123456789abc", "exp": 4102444800, "type": "refresh"},
            id="wrong-type",
        ),
    ],
)
async def test_signed_invalid_identity_returns_401(
    mounted_auth_client: AsyncClient, claims: dict[str, object]
) -> None:
    """Signed malformed or expired identities reject without server errors or DB access."""
    mounted_auth_client.cookies.set(
        "access_token",
        jwt.encode(claims, "r04-cookie-contract-test-secret-only", algorithm="HS256"),
    )
    response = await mounted_auth_client.get("/auth/me")
    assert response.status_code == 401
    mounted_auth_client.cookies.set("csrf_token", "r04-test-csrf")
    write = await mounted_auth_client.post(
        "/auth/logout", headers={"X-CSRF-Token": "r04-test-csrf"}
    )
    assert write.status_code == 401


@pytest.mark.asyncio
async def test_csrf_rejects_missing_or_wrong_values_and_preserves_safe_methods(
    mounted_auth_client: AsyncClient,
) -> None:
    """Authenticated unsafe requests require matching CSRF; safe methods reach the router."""
    assert (await mounted_auth_client.get("/auth/me")).status_code == 401
    registered = await mounted_auth_client.post(
        "/auth/register", json={"email": "r04-csrf@example.com", "password": "securePassword123"}
    )
    assert registered.status_code == 201
    csrf = mounted_auth_client.cookies.get("csrf_token")
    for headers in ({}, {"X-CSRF-Token": "wrong"}):
        rejected = await mounted_auth_client.post("/auth/logout", headers=headers)
        assert rejected.status_code == 403
    mounted_auth_client.cookies.delete("csrf_token")
    rejected = await mounted_auth_client.post("/auth/logout", headers={"X-CSRF-Token": csrf})
    assert rejected.status_code == 403
    for method in ("HEAD", "OPTIONS"):
        # The GET-only route returns 405; middleware must not turn safe reads into 403.
        response = await mounted_auth_client.request(method, "/auth/me")
        assert response.status_code == 405
    mounted_auth_client.cookies.set("access_token", "invalid.token.here")
    assert (await mounted_auth_client.get("/auth/me")).status_code == 401
