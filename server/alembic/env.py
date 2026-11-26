"""Alembic environment configuration for async PostgreSQL migrations.

This module configures Alembic to work with SQLAlchemy 2.0 async engine
and our domain models.

Constitutional Compliance:
- Article I (Simplicity): Uses Alembic's standard async patterns
- Article IV (SOLID - SRP): Pure configuration, no business logic
- Article V (Documentation): Complete Google-style docstrings
"""

import asyncio
import os
from logging.config import fileConfig

from alembic.migration import MigrationContext
from sqlalchemy import Column, cast, literal_column, pool, select
from sqlalchemy.dialects.postgresql import JSON, JSONB
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from server.infrastructure.persistence.models import Base

# Register every production mapping without importing the application at startup.
from server.models import (
    achievement,
    intervention_receipt,
    streak,
    style,
    style_history,
    task,
    template,
    user,
    user_stats,
    wechat_identity,
    wechat_runs,
    wechat_works,
)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Get DATABASE_URL from environment variable
database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Execute migrations in online mode.
    
    Args:
        connection: SQLAlchemy connection to use for migrations.
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_server_default=compare_server_default,
    )

    with context.begin_transaction():
        context.run_migrations()


def compare_server_default(
    migration_context: MigrationContext,
    inspected_column: Column,
    _metadata_column: Column,
    inspected_default: str | None,
    _metadata_default: object,
    rendered_metadata_default: str | None,
) -> bool | None:
    """Compare JSON defaults through JSONB because PostgreSQL JSON lacks equality."""
    if type(inspected_column.type) is not JSON:
        return None
    if inspected_default is None or rendered_metadata_default is None:
        return None
    connection = migration_context.connection
    assert connection is not None
    return connection.scalar(
        select(
            cast(literal_column(inspected_default), JSONB).is_distinct_from(
                cast(literal_column(rendered_metadata_default), JSONB)
            )
        )
    )


async def run_async_migrations() -> None:
    """Run migrations in async mode.
    
    Creates an async engine and runs migrations through it.
    This is required for asyncpg driver.
    """
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
elif (connection := config.attributes.get("connection")) is not None:
    # Programmatic callers can supply an existing connection and its search path.
    do_run_migrations(connection)
else:
    run_migrations_online()
