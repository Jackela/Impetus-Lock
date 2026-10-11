"""Seed disposable export boundary data for a real UI-registered test account."""

import asyncio
import json
import os
import sys
from uuid import UUID, uuid4

from runtime import DATABASE, ROOT, environment

env = environment()
os.environ.clear()
os.environ.update(env)
sys.path.insert(0, str(ROOT / "server"))
from server.infrastructure.persistence.models import InterventionActionModel, TaskModel
from server.models.user import User
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def main():
    """Reset only an explicitly identified disposable account in the named DB."""
    user_id, count = UUID(sys.argv[1]), int(sys.argv[2])
    append = len(sys.argv) > 3 and sys.argv[3] == "append"
    assert count in {0, 100, 101, 201}
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with async_sessionmaker(engine)() as session:
        assert (
            await session.execute(text("SELECT current_database()"))
        ).scalar_one() == DATABASE
        user = (
            await session.execute(select(User).where(User.id == user_id))
        ).scalar_one()
        assert user.email.startswith("browser-") and user.email.endswith("@example.com")
        task_ids = select(TaskModel.id).where(TaskModel.user_id == user_id)
        if not append:
            await session.execute(
                delete(InterventionActionModel).where(
                    InterventionActionModel.task_id.in_(task_ids)
                )
            )
            await session.execute(delete(TaskModel).where(TaskModel.user_id == user_id))
        for number in range(count):
            session.add(
                TaskModel(
                    id=uuid4(),
                    user_id=user_id,
                    title=f"Boundary {number}",
                    content=f"Export boundary row {number}",
                    lock_ids=[],
                    version=number,
                )
            )
        await session.commit()
        rows = (
            await session.execute(select(TaskModel).where(TaskModel.user_id == user_id))
        ).scalars()
        print(
            json.dumps(
                [
                    {
                        "id": str(row.id),
                        "user_id": str(row.user_id),
                        "content": row.content,
                        "lock_ids": row.lock_ids,
                        "version": row.version,
                    }
                    for row in rows
                ]
            )
        )
    await engine.dispose()


asyncio.run(main())
