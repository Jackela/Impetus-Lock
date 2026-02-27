"""Style History Repository - Database operations for style analysis history."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.infrastructure.persistence.database import get_db_manager


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
    ) -> "StyleHistoryModel":
        """Create a new style history record.

        Args:
            user_id: User identifier
            text: Original analyzed text
            style_vector: Style analysis results

        Returns:
            Created StyleHistoryModel instance
        """
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
    ) -> list["StyleHistoryModel"]:
        """Get style history for a user with pagination.

        Args:
            user_id: User identifier
            limit: Maximum number of records to return
            offset: Number of records to skip

        Returns:
            List of StyleHistoryModel instances (newest first)
        """
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

    async def get_by_id(self, history_id: UUID) -> "StyleHistoryModel | None":
        """Get a specific style history record by ID.

        Args:
            history_id: History record UUID

        Returns:
            StyleHistoryModel instance or None if not found
        """
        from server.models.style_history import StyleHistoryModel

        if self.session:
            query = select(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
            result = await self.session.execute(query)
            return result.scalar_one_or_none()
        else:
            async with get_db_manager().session() as session:
                query = select(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
                result = await session.execute(query)
                return result.scalar_one_or_none()

    async def delete(self, history_id: UUID) -> bool:
        """Delete a style history record.

        Args:
            history_id: History record UUID to delete

        Returns:
            True if deleted, False if not found
        """
        from server.models.style_history import StyleHistoryModel

        if self.session:
            query = delete(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
            result = await self.session.execute(query)
            await self.session.commit()
            return result.rowcount > 0
        else:
            async with get_db_manager().session() as session:
                query = delete(StyleHistoryModel).where(StyleHistoryModel.id == history_id)
                result = await session.execute(query)
                await session.commit()
                return result.rowcount > 0

    async def count_by_user(self, user_id: str) -> int:
        """Count total style history records for a user.

        Args:
            user_id: User identifier

        Returns:
            Total count of records
        """
        from server.models.style_history import StyleHistoryModel

        if self.session:
            query = select(func.count()).where(StyleHistoryModel.user_id == user_id)
            result = await self.session.execute(query)
            return result.scalar() or 0
        else:
            async with get_db_manager().session() as session:
                query = select(func.count()).where(StyleHistoryModel.user_id == user_id)
                result = await session.execute(query)
                return result.scalar() or 0
