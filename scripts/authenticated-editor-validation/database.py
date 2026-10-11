"""Initialize and inspect only this round's named isolated PostgreSQL database."""

import asyncio
import importlib
import json
import os
import sys

from runtime import DATABASE, HERE, ROOT, environment

validation_environment = environment()
os.environ.clear()
os.environ.update(validation_environment)
sys.path.insert(0, str(ROOT / "server"))
from server.infrastructure.persistence.models import Base
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

for name in (
    "user",
    "style",
    "style_history",
    "user_stats",
    "achievement",
    "streak",
    "template",
):
    importlib.import_module(f"server.models.{name}")


async def main():
    """Create model tables or save a redacted exact persistence checkpoint."""
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with engine.begin() as connection:
        name = (
            await connection.execute(text("SELECT current_database()"))
        ).scalar_one()
        assert name == DATABASE
        if sys.argv[1] == "init":
            await connection.run_sync(Base.metadata.create_all)
            print(
                json.dumps({"database": name, "tables": sorted(Base.metadata.tables)})
            )
        else:
            rows = (
                await connection.execute(
                    text(
                        "SELECT id,user_id,title,content,lock_ids,version FROM tasks ORDER BY id"
                    )
                )
            ).mappings()
            payload = [dict(row) for row in rows]
            target = HERE / f"database-{sys.argv[1]}.json"
            target.write_text(json.dumps(payload, default=str, indent=2))
            print(
                json.dumps(
                    {"database": name, "tasks": len(payload), "checkpoint": str(target)}
                )
            )
    await engine.dispose()


asyncio.run(main())
