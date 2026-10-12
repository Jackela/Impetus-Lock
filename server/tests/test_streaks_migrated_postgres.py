"""Real authentication/streak API against the authoritative Sprint 3 migration."""

import os
import runpy
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.api.auth.middleware import AuthenticationMiddleware
from server.api.routes.streaks import router as streak_router
from server.auth.router import router as auth_router
from server.infrastructure.persistence.database import get_session, get_session_optional
from server.infrastructure.persistence.models import Base
from server.models.user import User

POSTGRES_TEST_URL = os.getenv(
    "POSTGRES_TEST_URL",
    os.getenv(
        "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
    ),
)


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Only use this module's migrated schema, without shared table initialization."""


@pytest.fixture
async def migrated_streak_client(
    monkeypatch: pytest.MonkeyPatch,
) -> AsyncIterator[tuple[AsyncClient, async_sessionmaker[AsyncSession]]]:
    """Apply the original migration in a unique schema and keep auth/SQL real."""
    schema = f"streak_migration_{uuid4().hex}"
    engine = create_async_engine(
        POSTGRES_TEST_URL, connect_args={"server_settings": {"search_path": schema}}
    )
    migration = runpy.run_path(
        str(Path(__file__).parents[1] / "alembic/versions/20260413130000_add_sprint3_tables.py")
    )

    def apply_migration(connection: Connection) -> None:
        with Operations.context(MigrationContext.configure(connection)):
            migration["upgrade"]()

    created = False
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
            created = True
            await connection.run_sync(Base.metadata.create_all, tables=[User.__table__])
            await connection.run_sync(apply_migration)
        sessions = async_sessionmaker(engine, expire_on_commit=False)

        async def isolated_session() -> AsyncIterator[AsyncSession]:
            async with sessions() as session:
                yield session

        monkeypatch.delenv("TESTING", raising=False)
        monkeypatch.setenv("JWT_SECRET", "streak-real-migration-auth-secret-only")
        app = FastAPI()
        app.add_middleware(AuthenticationMiddleware)
        app.include_router(auth_router)
        app.include_router(streak_router)
        app.dependency_overrides[get_session] = isolated_session
        app.dependency_overrides[get_session_optional] = isolated_session
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
        ) as client:
            registered = await client.post(
                "/auth/register",
                json={"email": f"streak-{uuid4()}@example.com", "password": "securePassword123"},
            )
            assert registered.status_code == 201
            client.headers["X-CSRF-Token"] = client.cookies["csrf_token"]
            client.headers["X-Expected-User-ID"] = registered.json()["user"]["id"]
            yield client, sessions
    finally:
        try:
            if created:
                async with engine.begin() as connection:
                    await connection.execute(DropSchema(schema, cascade=True))
        finally:
            await engine.dispose()


@pytest.mark.integration
async def test_real_user_activity_persists_utc_time_under_existing_migration(
    migrated_streak_client: tuple[AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    """Normal activity must write/read migrated UTC timestamps, without schema changes."""
    client, sessions = migrated_streak_client
    response = await client.post("/streaks/update", json={})
    assert response.status_code == 200
    first = response.json()
    assert first["current_streak_days"] == first["longest_streak_days"] == 1
    observed = datetime.fromisoformat(first["last_activity_date"])
    assert observed.tzinfo == UTC
    assert observed.date() == datetime.now(UTC).date()
    assert (await client.get("/streaks/")).json() == first
    assert (await client.post("/streaks/update", json={})).json() == first
    async with sessions() as session:
        stored = (
            await session.execute(text("SELECT streak_start_date,last_activity_date FROM streaks"))
        ).one()
        assert stored.streak_start_date == stored.last_activity_date == observed
        assert stored.last_activity_date.tzinfo == UTC
