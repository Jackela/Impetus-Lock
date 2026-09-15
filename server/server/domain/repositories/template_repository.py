"""Template repository abstraction.

Defines the narrow persistence interface required by TemplateService.
Implementations translate between the Template domain entity and storage.

Constitutional Compliance:
- Article I (Simplicity): Minimal interface, only essential operations
- Article IV (SOLID - DIP): Application layer depends on this abstraction
- Article IV (SOLID - ISP): Interface segregation (focused on templates)
- Article V (Documentation): Complete Google-style docstrings
"""

from abc import ABC, abstractmethod
from uuid import UUID

from server.domain.entities.template import Template


class TemplateRepository(ABC):
    """Repository abstraction for user-scoped template persistence.

    Every operation is scoped to a user id; implementations must never
    read or write another user's rows.

    Implementations:
        - PostgreSQLTemplateRepository: SQLAlchemy async persistence
    """

    @abstractmethod
    async def list_by_user(
        self, user_id: UUID, limit: int, offset: int
    ) -> tuple[list[Template], int]:
        """List a user's templates (paginated) with their total count.

        Args:
            user_id: User UUID to filter by.
            limit: Maximum number of templates to return.
            offset: Number of templates to skip.

        Returns:
            tuple[list[Template], int]: Newest-first page and user total.
        """

    @abstractmethod
    async def get_by_user(self, template_id: UUID, user_id: UUID) -> Template | None:
        """Get a template by ID if it belongs to the given user.

        Args:
            template_id: Template UUID.
            user_id: Owning user UUID to verify.

        Returns:
            Template | None: Template if found and owned, None otherwise.
        """

    @abstractmethod
    async def create(self, name: str, content: str, user_id: UUID) -> Template:
        """Create a template for the given user.

        Finishes the current commit/refresh sequence before returning.

        Args:
            name: Template name.
            content: Template content.
            user_id: Owning user UUID.

        Returns:
            Template: Created template with generated id and timestamps.
        """

    @abstractmethod
    async def delete_by_user(self, template_id: UUID, user_id: UUID) -> None:
        """Delete a template only when it belongs to the given user.

        Finishes the current commit sequence before returning. Deleting a
        missing or foreign template is a no-op (never raises).

        Args:
            template_id: Template UUID.
            user_id: Owning user UUID to verify.
        """
