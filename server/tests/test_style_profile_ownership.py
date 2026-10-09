"""R09 regression for authenticated style profile ownership over real HTTP/SQL."""

import os
from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.style_history_repository import StyleHistoryRepository
from server.models.style import StyleModel
from server.models.style_history import StyleHistoryModel
from server.models.user import User

POSTGRES_TEST_URL = os.getenv(
    "POSTGRES_TEST_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
)


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Replace root database setup: this module owns its PostgreSQL schema."""


@pytest.fixture
async def style_sessions() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Create real sessions and clean up only this test's unique schema."""
    schema = f"r09_style_ownership_{uuid4().hex}"
    engine = create_async_engine(
        POSTGRES_TEST_URL,
        execution_options={"schema_translate_map": {None: schema}},
        connect_args={"server_settings": {"statement_timeout": "10000"}},
    )
    schema_created = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
        schema_created = True
        async with engine.begin() as connection:
            await connection.run_sync(
                Base.metadata.create_all,
                tables=[User.__table__, StyleModel.__table__, StyleHistoryModel.__table__],
            )
        yield async_sessionmaker(engine, expire_on_commit=False)
    finally:
        try:
            if schema_created:
                async with engine.begin() as connection:
                    await connection.execute(DropSchema(schema, cascade=True))
        finally:
            await engine.dispose()


@pytest.fixture
async def authenticated_style_clients(
    monkeypatch: pytest.MonkeyPatch, style_sessions: async_sessionmaker[AsyncSession]
) -> AsyncIterator[tuple[AsyncClient, AsyncClient]]:
    """Keep mounted authentication real, injecting only isolated database sessions."""
    from server.api.main import app
    from server.api.routes.style_history import get_repository
    from server.infrastructure.persistence.database import get_session, get_session_optional

    monkeypatch.delenv("TESTING", raising=False)
    monkeypatch.setenv("JWT_SECRET", "r09-style-ownership-test-secret-only")

    async def isolated_session() -> AsyncIterator[AsyncSession]:
        async with style_sessions() as session:
            yield session

    async def isolated_repository() -> AsyncIterator[StyleHistoryRepository]:
        async with style_sessions() as session:
            yield StyleHistoryRepository(session=session)

    dependencies = (get_session, get_session_optional, get_repository)
    previous_overrides = {
        dependency: app.dependency_overrides.get(dependency) for dependency in dependencies
    }
    app.dependency_overrides[get_session] = isolated_session
    app.dependency_overrides[get_session_optional] = isolated_session
    app.dependency_overrides[get_repository] = isolated_repository
    try:
        transport = ASGITransport(app=app)
        async with (
            AsyncClient(transport=transport, base_url="http://test") as owner,
            AsyncClient(transport=transport, base_url="http://test") as non_owner,
        ):
            for client in (owner, non_owner):
                registered = await client.post(
                    "/auth/register",
                    json={"email": f"r09-{uuid4()}@example.com", "password": "securePassword123"},
                )
                assert registered.status_code == 201
                client.headers["X-CSRF-Token"] = client.cookies["csrf_token"]
                assert (await client.get("/auth/me")).status_code == 200
            yield owner, non_owner
    finally:
        for dependency, previous_override in previous_overrides.items():
            if previous_override is None:
                app.dependency_overrides.pop(dependency, None)
            else:
                app.dependency_overrides[dependency] = previous_override


@pytest.mark.integration
@pytest.mark.asyncio
async def test_style_profile_read_rejects_authenticated_non_owner(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient],
) -> None:
    """A different logged-in user cannot read an existing owner's style profile."""
    owner, non_owner = authenticated_style_clients
    owner_id = (await owner.get("/auth/me")).json()["id"]
    sample = "The writer observed the quiet river and recorded each detail carefully. " * 50
    created = await owner.post("/style/analyze", json={"user_id": owner_id, "text": sample})
    assert created.status_code == 201
    profile_path = f"/style/profile/{owner_id}"
    own_read = await owner.get(profile_path)
    assert own_read.status_code == 200
    assert own_read.json()["user_id"] == owner_id
    assert own_read.json()["samples_count"] == 1
    assert own_read.json()["version"] == 1

    foreign_read = await non_owner.get(profile_path)
    after = await owner.get(profile_path)
    assert after.status_code == 200
    assert after.json() == own_read.json()
    assert foreign_read.status_code == 404
    assert "style_vector" not in foreign_read.json()


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["analyze", "apply", "delete"])
async def test_style_profile_operations_reject_foreign_identity(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient], operation: str
) -> None:
    """Body and path identities cannot target another user's profile."""
    owner, non_owner = authenticated_style_clients
    owner_id = (await owner.get("/auth/me")).json()["id"]
    sample = "The writer observed the quiet river and recorded each detail carefully. " * 50
    assert (
        await owner.post("/style/analyze", json={"user_id": owner_id, "text": sample})
    ).status_code == 201
    profile_path = f"/style/profile/{owner_id}"
    before = (await owner.get(profile_path)).json()
    if operation == "delete":
        foreign_response = await non_owner.delete(profile_path)
    else:
        foreign_response = await non_owner.post(
            f"/style/{operation}", json={"user_id": owner_id, "text": sample}
        )
    assert foreign_response.status_code == 404
    assert "style_vector" not in foreign_response.json()
    assert "styled_text" not in foreign_response.json()
    assert (await owner.get(profile_path)).json() == before

    # An arbitrary nonexistent identity must be rejected too, without creating a profile.
    missing_id = str(uuid4())
    if operation == "delete":
        missing_response = await non_owner.delete(f"/style/profile/{missing_id}")
    else:
        missing_response = await non_owner.post(
            f"/style/{operation}", json={"user_id": missing_id, "text": sample}
        )
    assert missing_response.status_code == 404
    non_owner_id = (await non_owner.get("/auth/me")).json()["id"]
    assert (await non_owner.get(f"/style/profile/{non_owner_id}")).status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_owned_style_profile_lifecycle(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient],
) -> None:
    """The owner can create, update, apply and delete their profile."""
    owner, _ = authenticated_style_clients
    owner_id = (await owner.get("/auth/me")).json()["id"]
    profile_path = f"/style/profile/{owner_id}"
    assert (await owner.get(profile_path)).status_code == 404
    assert (await owner.delete(profile_path)).status_code == 404

    assert (
        await owner.post("/style/apply", json={"user_id": owner_id, "text": "Hello river."})
    ).status_code == 404
    sample = "The writer observed the quiet river and recorded each detail carefully. " * 50
    for _ in range(2):
        assert (
            await owner.post("/style/analyze", json={"user_id": owner_id, "text": sample})
        ).status_code == 201
    profile = (await owner.get(profile_path)).json()
    assert profile["samples_count"] == 2
    assert profile["version"] == 2
    applied = await owner.post(
        "/style/apply", json={"user_id": owner_id, "text": "Hello river.", "intensity": 0}
    )
    assert applied.status_code == 200
    assert applied.json()["styled_text"] == "Hello river."
    assert applied.json()["style_version"] == 2
    assert (await owner.delete(profile_path)).status_code == 204
    assert (await owner.get(profile_path)).status_code == 404
    assert (await owner.delete(profile_path)).status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["create", "list", "read", "delete"])
async def test_style_history_operations_reject_foreign_identity(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient], operation: str
) -> None:
    """Other users cannot create, list, read or delete the owner's history."""
    owner, non_owner = authenticated_style_clients
    owner_id = (await owner.get("/auth/me")).json()["id"]
    payload = {
        "user_id": owner_id,
        "text": "The writer recorded the river's changing light. " * 10,
        "style_vector": {"formality_score": 0.6},
    }
    created = await owner.post("/style/history", json=payload)
    assert created.status_code == 201
    history_path = f"/style/history/{created.json()['id']}"
    own_list_path = f"/style/history/user/{owner_id}"
    before = (await owner.get(own_list_path)).json()
    assert before["total"] == 1
    if operation == "create":
        response = await non_owner.post("/style/history", json=payload)
    elif operation == "list":
        response = await non_owner.get(own_list_path)
    elif operation == "read":
        response = await non_owner.get(history_path)
    else:
        response = await non_owner.delete(history_path)
    assert response.status_code == 404
    assert "text" not in response.json()
    assert "style_vector" not in response.json()
    assert (await owner.get(history_path)).json() == created.json()
    assert (await owner.get(own_list_path)).json() == before


@pytest.mark.integration
@pytest.mark.asyncio
async def test_owned_style_history_lifecycle_and_pagination(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient],
) -> None:
    """Owned history remains readable, paginated and deletable with honest misses."""
    owner, non_owner = authenticated_style_clients
    owner_id = (await owner.get("/auth/me")).json()["id"]
    other_id = (await non_owner.get("/auth/me")).json()["id"]
    list_path = f"/style/history/user/{owner_id}"
    assert (await owner.get(list_path)).json()["total"] == 0
    records = []
    for client, user_id, index in [
        (owner, owner_id, 1),
        (non_owner, other_id, 2),
        (owner, owner_id, 3),
    ]:
        payload = {
            "user_id": user_id,
            "text": f"The writer recorded observation {index} at the river. " * 10,
            "style_vector": {"observation": index},
        }
        response = await client.post("/style/history", json=payload)
        assert response.status_code == 201
        assert response.json()["user_id"] == user_id
        assert response.json()["text"] == payload["text"]
        assert response.json()["style_vector"] == payload["style_vector"]
        records.append(response.json())
    first_page = (await owner.get(list_path, params={"limit": 1})).json()
    second_page = (await owner.get(list_path, params={"limit": 1, "offset": 1})).json()
    assert first_page == {"items": [records[2]], "total": 2, "limit": 1, "offset": 0}
    assert second_page == {"items": [records[0]], "total": 2, "limit": 1, "offset": 1}
    history_path = f"/style/history/{records[0]['id']}"
    assert (await owner.get(history_path)).json() == records[0]
    assert (await owner.delete(history_path)).status_code == 204
    assert (await owner.get(history_path)).status_code == 404
    assert (await owner.delete(history_path)).status_code == 404
    missing_path = f"/style/history/{uuid4()}"
    assert (await owner.get(missing_path)).status_code == 404
    assert (await owner.delete(missing_path)).status_code == 404
    assert (await owner.get(list_path)).json()["total"] == 1
    assert (await non_owner.get(f"/style/history/{records[1]['id']}")).json() == records[1]


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("POST", "/style/analyze"),
        ("POST", "/style/apply"),
        ("GET", "/style/profile/{user_id}"),
        ("DELETE", "/style/profile/{user_id}"),
        ("POST", "/style/history"),
        ("GET", "/style/history/user/{user_id}"),
        ("GET", "/style/history/{history_id}"),
        ("DELETE", "/style/history/{history_id}"),
    ],
)
async def test_style_operations_require_authentication(
    authenticated_style_clients: tuple[AsyncClient, AsyncClient], method: str, path: str
) -> None:
    """Every profile/history operation rejects an unauthenticated HTTP request."""
    from server.api.main import app

    owner, _ = authenticated_style_clients
    user_id = (await owner.get("/auth/me")).json()["id"]
    payload = {
        "user_id": user_id,
        "text": "The writer observed the quiet river and recorded each detail carefully. " * 50,
        "style_vector": {"formality_score": 0.6},
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anonymous:
        response = await anonymous.request(
            method, path.format(user_id=user_id, history_id=uuid4()), json=payload
        )
    assert response.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_history_repository_delete_reports_actual_outcome(
    style_sessions: async_sessionmaker[AsyncSession],
) -> None:
    """The public repository returns false for missing or foreign deletion."""
    async with style_sessions() as session:
        repo = StyleHistoryRepository(session=session)
        assert await repo.delete(uuid4()) is False
        created = await repo.create("owner", "A sample observation. " * 10, {"tone": 0.6})
        assert await repo.delete(created.id, user_id="other") is False
        assert await repo.get_by_id(created.id, user_id="other") is None
        assert await repo.get_by_id(created.id, user_id="owner") is not None
        assert await repo.delete(created.id, user_id="owner") is True
        assert await repo.delete(created.id, user_id="owner") is False
        assert await repo.get_by_id(created.id) is None
