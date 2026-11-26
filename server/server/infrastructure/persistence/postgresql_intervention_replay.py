"""Serialize and replay one owned task intervention across PostgreSQL sessions."""

from datetime import timedelta
from hashlib import sha256
from uuid import UUID

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.errors import TaskMissingError
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.persistence.models import InterventionActionModel, TaskModel
from server.models.intervention_receipt import InterventionReceipt


class PostgreSQLInterventionReplay:
    """Use the writing transaction to coordinate one scoped intervention key."""

    def __init__(
        self, session: AsyncSession, user_id: UUID, task_id: UUID, scoped_key: str, ttl: int
    ) -> None:
        """Hash the scoped key and keep its transaction-bound receipt state."""
        self._session = session
        self._user_id = user_id
        self._task_id = task_id
        self._digest = sha256(scoped_key.encode()).hexdigest()
        self._window = timedelta(seconds=ttl)

    async def lock_and_read(self) -> InterventionResponse | None:
        """Acquire the transaction lock, recheck ownership and read the committed result."""
        advisory_key = int.from_bytes(bytes.fromhex(self._digest[:16]), "big", signed=True)
        await self._session.execute(select(func.pg_advisory_xact_lock(advisory_key)))

        # Key-share locks protect the owned task from deletion through commit.
        # Updates to content and versions can run alongside the intervention.
        owned = await self._session.scalar(
            select(TaskModel.id)
            .where(TaskModel.id == self._task_id, TaskModel.user_id == self._user_id)
            .with_for_update(read=True, key_share=True)
        )
        if owned is None:
            raise TaskMissingError(self._task_id)

        receipt = InterventionReceipt
        action = InterventionActionModel
        result = await self._session.scalar(
            select(action)
            .join(receipt, receipt.action_id == action.action_id)
            .where(
                receipt.user_id == self._user_id,
                receipt.task_id == self._task_id,
                receipt.key_digest == self._digest,
                receipt.expires_at >= func.clock_timestamp(),
                action.task_id == self._task_id,
            )
        )
        if result is None:
            return None

        return InterventionResponse.model_validate(
            {
                "action": result.action_type,
                "content": result.content,
                "lock_id": result.lock_id,
                "anchor": result.anchor,
                "action_id": result.action_id,
                "source": result.mode,
                "issued_at": result.issued_at,
            }
        )

    async def store(self, action_id: str) -> None:
        """Store a reference in the committing action transaction and reclaim expired receipts."""
        receipt = InterventionReceipt
        statement = insert(receipt).values(
            user_id=self._user_id,
            task_id=self._task_id,
            key_digest=self._digest,
            action_id=action_id,
            expires_at=func.clock_timestamp() + self._window,
        )
        await self._session.execute(
            statement.on_conflict_do_update(
                index_elements=[receipt.user_id, receipt.task_id, receipt.key_digest],
                set_={
                    "action_id": statement.excluded.action_id,
                    "expires_at": statement.excluded.expires_at,
                },
            )
        )

        identity = (receipt.user_id, receipt.task_id, receipt.key_digest)
        expired = (
            select(*identity)
            .where(receipt.expires_at < func.clock_timestamp())
            .order_by(receipt.expires_at)
            .limit(50)
            .with_for_update(skip_locked=True)
        )
        # Store the current key first so cleanup cannot take a lock needed by
        # another transaction whose own receipt row is already being written.
        await self._session.execute(delete(receipt).where(tuple_(*identity).in_(expired)))
