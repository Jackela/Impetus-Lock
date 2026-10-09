"""Tests for unique lock identifiers from the debug intervention provider."""

from datetime import UTC, datetime
from unittest.mock import patch

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.application.services.intervention_service import InterventionService
from server.domain.models.intervention import ClientMeta, InterventionRequest
from server.infrastructure.llm.debug_provider import DebugLLMProvider
from server.infrastructure.persistence.models import Base
from server.infrastructure.persistence.postgresql_task_repository import PostgreSQLTaskRepository
from server.models.user import User


def test_generate_intervention_issues_distinct_lock_ids_at_same_timestamp() -> None:
    """Each provoke intervention gets a distinct lock ID at one frozen instant."""
    frozen_issued_at = datetime(2026, 9, 14, 12, 0, 0, tzinfo=UTC)
    provider = DebugLLMProvider()

    with patch("server.infrastructure.llm.debug_provider.datetime") as datetime_clock:
        datetime_clock.now.return_value = frozen_issued_at
        first = provider.generate_intervention(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            selection_from=12,
            selection_to=12,
        )
        second = provider.generate_intervention(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            selection_from=12,
            selection_to=12,
        )

    assert first.action == second.action == "provoke"
    assert first.source == second.source == "muse"
    assert first.content == second.content
    assert first.anchor == second.anchor
    assert first.issued_at == second.issued_at == frozen_issued_at
    assert first.lock_id != second.lock_id
    assert first.lock_id.startswith("lock_debug_muse_")
    assert second.lock_id.startswith("lock_debug_muse_")


async def test_distinct_debug_generations_both_persist_in_action_history() -> None:
    """Separate debug generations remain independently retrievable after commit."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    request = InterventionRequest(
        context="The door opened.",
        mode="muse",
        client_meta=ClientMeta(doc_version=1, selection_from=16, selection_to=16),
    )

    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        async with sessions() as session:
            user = User(email="debug-history@example.com", password_hash="test-hash")
            session.add(user)
            await session.flush()
            repository = PostgreSQLTaskRepository(session)
            task = await repository.create_task(request.context, [], user_id=user.id)
            service = InterventionService(
                llm_provider=DebugLLMProvider(), task_repository=repository
            )

            first = await service.generate_intervention_async(request, task_id=task.id)
            await session.commit()
            second = await service.generate_intervention_async(request, task_id=task.id)
            await session.commit()

        async with sessions() as session:
            history = await PostgreSQLTaskRepository(session).get_actions(task.id)

        assert first.action_id and second.action_id
        assert first.action_id != second.action_id
        assert first.lock_id and second.lock_id
        assert first.lock_id != second.lock_id
        assert len(history) == 2
        assert {action.action_id for action in history} == {first.action_id, second.action_id}
        assert {action.lock_id for action in history} == {first.lock_id, second.lock_id}
        assert first.action == second.action == "provoke"
        assert first.source == second.source == "muse"
        assert first.content == second.content == "The door opened.（继续深入这个抉择。）"
        assert all(action.content == first.content and action.mode == "muse" for action in history)
    finally:
        await engine.dispose()
