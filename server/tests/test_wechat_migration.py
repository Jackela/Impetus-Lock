"""Exercise the WeChat schema upgrade and downgrade on real PostgreSQL."""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.command import downgrade, upgrade
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.schema import CreateSchema, DropSchema

from server.infrastructure.persistence.models import Base

PREVIOUS_REVISION = "441c7e275255"
WECHAT_REVISION = "20261126110000"
WECHAT_TABLES = {
    "wechat_cards",
    "wechat_identities",
    "wechat_modes",
    "wechat_progress",
    "wechat_run_receipts",
    "wechat_runs",
    "wechat_works",
}
SERVER_DIR = Path(__file__).resolve().parents[1]
POSTGRES_TEST_URL = os.getenv(
    "POSTGRES_TEST_URL",
    os.getenv(
        "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres"
    ),
)


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database() -> None:
    """Leave schema creation to Alembic inside this module's isolated schema."""


def verify_schema(connection: Connection) -> None:
    """Check the newly migrated schema against the registered WeChat models."""
    metadata = MetaData()
    for name, table in Base.metadata.tables.items():
        if name.startswith("wechat_"):
            table.to_metadata(metadata)
    assert set(metadata.tables) == WECHAT_TABLES

    inspector = inspect(connection)
    for name, table in metadata.tables.items():
        assert inspector.get_pk_constraint(name)["constrained_columns"] == [
            column.name for column in table.primary_key
        ]

    context = MigrationContext.configure(
        connection,
        opts={
            "compare_server_default": True,
            "include_object": lambda _obj, name, kind, *_: kind != "table" or name in WECHAT_TABLES,
        },
    )
    assert compare_metadata(context, metadata) == []

    run_id = str(uuid4())
    connection.execute(
        text(
            """
            INSERT INTO wechat_runs (id, subject, start_request_id, version,
                                     initial, state, created_at)
            VALUES (:run_id, 'migration-fixture', 'start', 1, '{}', '{}', now())
            """
        ),
        {"run_id": run_id},
    )
    default_receipt = connection.execute(
        text(
            """
            INSERT INTO wechat_run_receipts (run_id, request_id)
            VALUES (:run_id, 'turn') RETURNING outcome, attempt_version
            """
        ),
        {"run_id": run_id},
    ).one()
    assert tuple(default_receipt) == ("committed", None)


def verify_wechat_migration(connection: Connection) -> None:
    """Apply the full chain and inspect the data before and after the WeChat revision."""
    config = Config()
    config.set_main_option("script_location", str(SERVER_DIR / "alembic"))
    config.attributes["connection"] = connection
    upgrade(config, PREVIOUS_REVISION)

    old_tables = set(inspect(connection).get_table_names())
    owner = connection.execute(
        text(
            "INSERT INTO users (email, password_hash) VALUES "
            "('legacy@example.test', 'fixture-hash') RETURNING id"
        )
    ).scalar_one()
    task = uuid4()
    connection.execute(
        text(
            """
            INSERT INTO tasks (id, user_id, content, lock_ids, created_at, updated_at, version)
            VALUES (:task, :owner, 'Original draft', '["old-lock"]', now(), now(), 7)
            """
        ),
        {"task": task, "owner": owner},
    )
    connection.execute(
        text(
            """
            INSERT INTO intervention_actions (
                id, task_id, action_type, action_id, lock_id, content,
                anchor, mode, context, issued_at, created_at
            )
            VALUES (
                :action, :task, 'provoke', 'old-action', 'old-lock', 'Preserved lock',
                '{"type": "pos", "from": 0}', 'muse', 'Original draft', now(), now()
            )
            """
        ),
        {"action": uuid4(), "task": task},
    )
    connection.commit()

    legacy_data = text(
        """
        SELECT users.email, tasks.content, tasks.lock_ids, tasks.version,
               intervention_actions.action_id, intervention_actions.content
        FROM tasks
        JOIN users ON users.id = tasks.user_id
        JOIN intervention_actions ON intervention_actions.task_id = tasks.id
        WHERE tasks.id = :task
        """
    )
    expected_legacy = (
        "legacy@example.test",
        "Original draft",
        ["old-lock"],
        7,
        "old-action",
        "Preserved lock",
    )
    for operation, revision in (
        (upgrade, WECHAT_REVISION),
        (downgrade, PREVIOUS_REVISION),
        (upgrade, WECHAT_REVISION),
    ):
        operation(config, revision)
        assert MigrationContext.configure(connection).get_current_revision() == revision
        tables = set(inspect(connection).get_table_names())
        if revision == PREVIOUS_REVISION:
            assert tables == old_tables
        else:
            assert tables == old_tables | WECHAT_TABLES
            verify_schema(connection)
        assert tuple(connection.execute(legacy_data, {"task": task}).one()) == expected_legacy
        connection.commit()


@pytest.mark.integration
async def test_wechat_migration_roundtrip() -> None:
    """Upgrade legacy data, downgrade only the new tables, and apply them again."""
    schema = f"wechat_migration_{uuid4().hex}"
    engine = create_async_engine(POSTGRES_TEST_URL)
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
        migrated_engine = create_async_engine(
            POSTGRES_TEST_URL, connect_args={"server_settings": {"search_path": schema}}
        )
        try:
            async with migrated_engine.connect() as connection:
                await connection.run_sync(verify_wechat_migration)
        finally:
            await migrated_engine.dispose()
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
    finally:
        await engine.dispose()
