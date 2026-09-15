"""Characterization tests pinning the current /templates API contract.

Frozen safety net for the route-to-service extraction described in
openspec/changes/refactor-route-service-boundaries. These tests exercise the
real sqlite-backed session and pin the CURRENT external contract: paths,
methods, response fields, ordering, pagination, status codes, error details,
ownership semantics (foreign delete keeps 204 without deleting) and the
no-session degradation outcomes. They must pass UNCHANGED before and after
the refactor.
"""

import asyncio
import re
from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient

from server.api.main import app
from server.auth.dependencies import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.models.user import User

TEMPLATE_KEYS = {"id", "name", "content", "user_id", "created_at", "updated_at"}
LIST_KEYS = {"total", "limit", "offset", "templates"}

_ISO_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


def _make_user(email: str) -> User:
    """Create a synthetic authenticated user (auth dependency is overridden)."""
    return User(id=uuid4(), email=email, password_hash="mock_hash")


@pytest.fixture
def user_a() -> User:
    """First synthetic user (template owner in isolation tests)."""
    return _make_user(f"tpl-a-{uuid4()}@example.com")


@pytest.fixture
def user_b() -> User:
    """Second synthetic user (foreign user in isolation tests)."""
    return _make_user(f"tpl-b-{uuid4()}@example.com")


@pytest.fixture
def current_user(user_a: User) -> AsyncGenerator[dict[str, User], None]:
    """Override auth with a mutable holder so tests can switch users."""
    holder = {"user": user_a}
    app.dependency_overrides[get_current_user] = lambda: holder["user"]
    yield holder
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def no_session() -> AsyncGenerator[None, None]:
    """Simulate database unavailability for the optional session dependency."""
    app.dependency_overrides[get_session_optional] = lambda: None
    yield None
    app.dependency_overrides.pop(get_session_optional, None)


async def _create_template(
    client: AsyncClient, name: str = "Template", content: str = "body"
) -> dict[str, Any]:
    """Create a template through the API and return the response body."""
    response = await client.post("/templates/", json={"name": name, "content": content})
    assert response.status_code == 201, response.text
    return response.json()


class TestTemplateCreateAndGetContract:
    """Pins POST /templates/ and GET /templates/{id}."""

    async def test_create_returns_201_with_full_field_set(
        self, async_client: AsyncClient, current_user: dict[str, User], user_a: User
    ) -> None:
        """Creation returns 201 with the exact current field set."""
        data = await _create_template(async_client, "Morning pages", "Write three pages")

        assert set(data.keys()) == TEMPLATE_KEYS
        assert data["name"] == "Morning pages"
        assert data["content"] == "Write three pages"
        assert data["user_id"] == str(user_a.id)
        assert _ISO_DATETIME.match(data["created_at"])
        assert _ISO_DATETIME.match(data["updated_at"])

    async def test_get_returns_identical_serialization(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """GET returns the exact same serialized values as the create response."""
        created = await _create_template(async_client, "Stable", "byte-identical")

        response = await async_client.get(f"/templates/{created['id']}")

        assert response.status_code == 200
        assert response.json() == created

    async def test_get_missing_template_returns_404_with_exact_detail(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Missing template returns 404 with detail 'Template not found'."""
        response = await async_client.get("/templates/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 404
        assert response.json() == {"detail": "Template not found"}

    async def test_get_invalid_uuid_returns_422(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Malformed UUID path parameter returns 422."""
        response = await async_client.get("/templates/not-a-uuid")

        assert response.status_code == 422


class TestTemplateCreateValidation:
    """Pins POST /templates/ request validation."""

    async def test_missing_or_empty_name_returns_422(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Missing name and empty name are rejected with 422."""
        missing = await async_client.post("/templates/", json={"content": "x"})
        assert missing.status_code == 422

        empty = await async_client.post("/templates/", json={"name": "", "content": "x"})
        assert empty.status_code == 422

    async def test_name_length_boundary(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Names of exactly 100 chars are accepted; 101 chars are rejected 422."""
        ok = await async_client.post("/templates/", json={"name": "n" * 100})
        assert ok.status_code == 201

        too_long = await async_client.post("/templates/", json={"name": "n" * 101})
        assert too_long.status_code == 422

    async def test_content_defaults_to_empty_string(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Omitting content creates a template with empty content."""
        response = await async_client.post("/templates/", json={"name": "No content"})
        assert response.status_code == 201

        assert response.json()["content"] == ""


class TestTemplateListContract:
    """Pins GET /templates/ pagination, ordering and user scoping."""

    async def test_list_returns_user_scoped_newest_first(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        user_a: User,
        user_b: User,
    ) -> None:
        """Listing is scoped to the current user, newest first, with totals."""
        older = await _create_template(async_client, "older")
        await asyncio.sleep(0.01)
        newer = await _create_template(async_client, "newer")

        current_user["user"] = user_b
        await _create_template(async_client, "foreign")

        current_user["user"] = user_a
        response = await async_client.get("/templates/")

        assert response.status_code == 200
        data = response.json()
        assert set(data.keys()) == LIST_KEYS
        assert data["total"] == 2
        assert data["limit"] == 100
        assert data["offset"] == 0
        assert [t["id"] for t in data["templates"]] == [newer["id"], older["id"]]
        assert all(t["user_id"] == str(user_a.id) for t in data["templates"])

    async def test_list_pagination_slice_and_bounds(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """limit/offset slice the list, and out-of-bounds values return 422."""
        await _create_template(async_client, "one")
        await asyncio.sleep(0.01)
        await _create_template(async_client, "two")

        page = (await async_client.get("/templates/?limit=1&offset=1")).json()
        assert page["total"] == 2
        assert page["limit"] == 1
        assert page["offset"] == 1
        assert len(page["templates"]) == 1

        for query in ("?limit=0", "?limit=101", "?offset=-1"):
            response = await async_client.get(f"/templates/{query}")
            assert response.status_code == 422, query


class TestTemplateDeleteContract:
    """Pins DELETE /templates/{id} ownership semantics."""

    async def test_delete_returns_204_then_row_is_gone(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Deleting an owned template returns 204 with empty body."""
        created = await _create_template(async_client, "doomed")

        response = await async_client.delete(f"/templates/{created['id']}")

        assert response.status_code == 204
        assert response.content == b""

        assert (await async_client.get(f"/templates/{created['id']}")).status_code == 404

    async def test_delete_missing_template_returns_204(
        self, async_client: AsyncClient, current_user: dict[str, User]
    ) -> None:
        """Deleting a non-existent template still returns 204."""
        response = await async_client.delete("/templates/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 204

    async def test_delete_foreign_template_returns_204_without_deleting(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        user_a: User,
        user_b: User,
    ) -> None:
        """Foreign deletion keeps 204 but must not delete the owner's row."""
        created = await _create_template(async_client, "owned by A")

        current_user["user"] = user_b
        response = await async_client.delete(f"/templates/{created['id']}")
        assert response.status_code == 204

        current_user["user"] = user_a
        assert (await async_client.get(f"/templates/{created['id']}")).status_code == 200

    async def test_get_foreign_template_returns_404(
        self,
        async_client: AsyncClient,
        current_user: dict[str, User],
        user_b: User,
    ) -> None:
        """Fetching another user's template returns 404 without leaking it."""
        created = await _create_template(async_client, "private")

        current_user["user"] = user_b
        response = await async_client.get(f"/templates/{created['id']}")

        assert response.status_code == 404
        assert response.json() == {"detail": "Template not found"}


class TestTemplateNoSessionContract:
    """Pins degraded outcomes when no database session is available."""

    async def test_list_returns_empty_200(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session listing returns the empty paginated response."""
        response = await async_client.get("/templates/")

        assert response.status_code == 200
        assert response.json() == {"total": 0, "limit": 100, "offset": 0, "templates": []}

    async def test_create_returns_500_database_not_available(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session creation returns 500 'Database not available'."""
        response = await async_client.post("/templates/", json={"name": "x", "content": "y"})

        assert response.status_code == 500
        assert response.json() == {"detail": "Database not available"}

    async def test_get_returns_500_database_not_available(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session fetching returns 500 'Database not available'."""
        response = await async_client.get("/templates/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 500
        assert response.json() == {"detail": "Database not available"}

    async def test_delete_returns_500_database_not_available(
        self, async_client: AsyncClient, current_user: dict[str, User], no_session: None
    ) -> None:
        """Without a session deletion returns 500 'Database not available'."""
        response = await async_client.delete("/templates/00000000-0000-0000-0000-000000000000")

        assert response.status_code == 500
        assert response.json() == {"detail": "Database not available"}


class TestTemplateAuthContract:
    """Pins authentication failure behavior."""

    async def test_unauthenticated_requests_return_401(self, async_client: AsyncClient) -> None:
        """Without authentication every template endpoint returns 401."""
        for method, path in [
            ("GET", "/templates/"),
            ("POST", "/templates/"),
            ("GET", "/templates/00000000-0000-0000-0000-000000000000"),
            ("DELETE", "/templates/00000000-0000-0000-0000-000000000000"),
        ]:
            response = await async_client.request(method, path, json={"name": "x"})
            assert response.status_code == 401, (method, path)
            assert response.json()["detail"] == "Not authenticated"
