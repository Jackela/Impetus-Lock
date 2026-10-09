"""Style History Repository - Database operations for style analysis history."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

from sqlalchemy import delete, desc, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from server.infrastructure.persistence.database import get_db_manager

if TYPE_CHECKING:
    from server.models.style_history import StyleHistoryModel


class StyleHistoryRepository:
    """Repository for style history database operations."""

    def __init__(self, session: AsyncSession | None = None):
        """Initialize repository with optional session for dependency injection.

        Args:
            session: Optional async session (for testing or dependency injection)
        """
        self.session = session

    async def create(
        self, user_id: str, text: str, style_vector: dict[str, Any]
    ) -> StyleHistoryModel:
        """Create a new style history record."""
        from server.models.style_history import StyleHistoryModel

        if self.session:
            history = StyleHistoryModel(
                user_id=user_id, text=text, style_vector=style_vector, created_at=datetime.now(UTC)
            )
            self.session.add(history)
            await self.session.commit()
            await self.session.refresh(history)
            return history
        else:
            async with get_db_manager().session() as session:
                history = StyleHistoryModel(
                    user_id=user_id,
                    text=text,
                    style_vector=style_vector,
                    created_at=datetime.now(UTC),
                )
                session.add(history)
                await session.commit()
                await session.refresh(history)
                return history

    async def get_by_user(
        self, user_id: str, limit: int = 10, offset: int = 0
    ) -> list[StyleHistoryModel]:
        """Get style history for a user with pagination."""
        from server.models.style_history import StyleHistoryModel

        if self.session:
            query = (
                select(StyleHistoryModel)
                .where(StyleHistoryModel.user_id == user_id)
                .order_by(desc(StyleHistoryModel.created_at))
                .limit(limit)
                .offset(offset)
            )
            result = await self.session.execute(query)
            return list(result.scalars().all())
        else:
            async with get_db_manager().session() as session:
                query = (
                    select(StyleHistoryModel)
                    .where(StyleHistoryModel.user_id == user_id)
                    .order_by(desc(StyleHistoryModel.created_at))
                    .limit(limit)
                    .offset(offset)
                )
                result = await session.execute(query)
                return list(result.scalars().all())

    async def get_by_id(
        self, history_id: UUID, user_id: str | None = None
    ) -> StyleHistoryModel | None:
        """Get a history record by ID, restricted to the owner when provided."""
        from server.models.style_history import StyleHistoryModel

        query = select(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
        if user_id is not None:
            query = query.where(StyleHistoryModel.user_id == user_id)

        if self.session:
            result = await self.session.execute(query)
            record: StyleHistoryModel | None = result.scalar_one_or_none()
            return record
        else:
            async with get_db_manager().session() as session:
                result = await session.execute(query)
            record_else: StyleHistoryModel | None = result.scalar_one_or_none()
            return record_else

    async def delete(self, history_id: UUID, user_id: str | None = None) -> bool:
        """Delete a history record, restricted to the owner when provided."""
        from server.models.style_history import StyleHistoryModel

        query = delete(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
        if user_id is not None:
            query = query.where(StyleHistoryModel.user_id == user_id)

        if self.session:
            result = await self.session.execute(query)
            await self.session.commit()
            return cast(CursorResult[Any], result).rowcount > 0
        else:
            async with get_db_manager().session() as session:
                result = await session.execute(query)
                await session.commit()
                return cast(CursorResult[Any], result).rowcount > 0

    async def count_by_user(self, user_id: str) -> int:
        """Count total style history records for a user."""
        from server.models.style_history import StyleHistoryModel

        if self.session:
            query = select(func.count()).where(StyleHistoryModel.user_id == user_id)
            result = await self.session.execute(query)
            count = result.scalar()
            return count if count is not None else 0
        else:
            async with get_db_manager().session() as session:
                query = select(func.count()).where(StyleHistoryModel.user_id == user_id)
                result = await session.execute(query)
                count = result.scalar()
                return count if count is not None else 0
