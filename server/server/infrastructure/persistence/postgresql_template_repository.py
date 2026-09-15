"""SQLAlchemy implementation of TemplateRepository.

Implements user-scoped template persistence with SQLAlchemy async,
preserving the exact queries and commit/refresh sequences previously
embedded in the template routes.

Constitutional Compliance:
- Article I (Simplicity): Uses framework-native SQLAlchemy async patterns
- Article IV (SOLID - DIP): Implements TemplateRepository abstraction
- Article IV (SOLID - SRP): Single responsibility (template persistence only)
- Article V (Documentation): Complete Google-style docstrings
"""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.entities.template import Template as TemplateEntity
from server.domain.repositories.template_repository import TemplateRepository
from server.models.template import Template as TemplateModel


class PostgreSQLTemplateRepository(TemplateRepository):
    """SQLAlchemy async implementation of TemplateRepository.

    Attributes:
        _session: SQLAlchemy async session (injected via constructor).
    """

    def __init__(self, session: AsyncSession) -> None:
        """Initialize repository with async session.

        Args:
            session: SQLAlchemy async session (constructor injection for DIP).
        """
        self._session = session

    async def list_by_user(
        self, user_id: UUID, limit: int, offset: int
    ) -> tuple[list[TemplateEntity], int]:
        """List a user's templates newest-first with their total count.

        Args:
            user_id: User UUID to filter by.
            limit: Maximum number of templates to return.
            offset: Number of templates to skip.

        Returns:
            tuple[list[TemplateEntity], int]: Newest-first page and user total.
        """
        count_stmt = select(func.count(TemplateModel.id)).where(TemplateModel.user_id == user_id)
        total = (await self._session.execute(count_stmt)).scalar_one_or_none() or 0

        page_stmt = (
            select(TemplateModel)
            .where(TemplateModel.user_id == user_id)
            .order_by(TemplateModel.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._session.execute(page_stmt)

        return [self._to_entity(model) for model in result.scalars().all()], total

    async def get_by_user(self, template_id: UUID, user_id: UUID) -> TemplateEntity | None:
        """Get a template by ID if it belongs to the given user.

        Args:
            template_id: Template UUID.
            user_id: Owning user UUID to verify.

        Returns:
            TemplateEntity | None: Template if found and owned, None otherwise.
        """
        stmt = select(TemplateModel).where(
            TemplateModel.id == template_id,
            TemplateModel.user_id == user_id,
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()

        return self._to_entity(model) if model else None

    async def create(self, name: str, content: str, user_id: UUID) -> TemplateEntity:
        """Create a template and finish the commit/refresh sequence.

        Args:
            name: Template name.
            content: Template content.
            user_id: Owning user UUID.

        Returns:
            TemplateEntity: Created template with generated id and timestamps.
        """
        model = TemplateModel(
            name=name,
            content=content,
            user_id=user_id,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)

        return self._to_entity(model)

    async def delete_by_user(self, template_id: UUID, user_id: UUID) -> None:
        """Delete a template only when it belongs to the given user.

        Args:
            template_id: Template UUID.
            user_id: Owning user UUID to verify.
        """
        stmt = delete(TemplateModel).where(
            TemplateModel.id == template_id,
            TemplateModel.user_id == user_id,
        )
        await self._session.execute(stmt)
        await self._session.commit()

    @staticmethod
    def _to_entity(model: TemplateModel) -> TemplateEntity:
        """Convert TemplateModel (ORM) to Template (domain entity).

        Args:
            model: SQLAlchemy ORM model.

        Returns:
            TemplateEntity: Domain entity.
        """
        return TemplateEntity(
            id=model.id,
            name=model.name,
            content=model.content,
            user_id=model.user_id,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
