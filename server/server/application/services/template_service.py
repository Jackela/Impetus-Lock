"""Template Service (Business Logic Layer).

Orchestrates user-scoped template operations while keeping the HTTP
boundary free of persistence concerns. Extracted from the template routes
by openspec/changes/refactor-route-service-boundaries; the external API
contract (statuses, payloads, ownership semantics) is unchanged.

Constitutional Compliance:
- Article IV (SOLID - SRP): Business logic separated from API and persistence
- Article IV (SOLID - DIP): Depends on TemplateRepository abstraction
- Article V (Documentation): Complete Google-style docstrings
"""

from uuid import UUID

from server.domain.entities.template import Template
from server.domain.repositories.template_repository import TemplateRepository


class TemplateServiceError(Exception):
    """Base exception for template service errors."""


class TemplateNotFoundError(TemplateServiceError):
    """Raised when a template does not exist or belongs to another user."""

    def __init__(self) -> None:
        """Initialize with the route-compatible detail message."""
        super().__init__("Template not found")


class TemplateService:
    """Service layer for user-scoped template operations.

    Every operation takes the authenticated user's id; cross-user access is
    rejected before any data is returned or mutated.

    Attributes:
        _repository: Template repository for persistence operations.

    Example:
        ```python
        service = TemplateService(PostgreSQLTemplateRepository(session))
        template = await service.create_template(user.id, "Morning", "pages")
        ```
    """

    def __init__(self, repository: TemplateRepository) -> None:
        """Initialize service with repository.

        Args:
            repository: Template repository implementation (constructor injection).
        """
        self._repository = repository

    async def list_templates(
        self, user_id: UUID, limit: int, offset: int
    ) -> tuple[list[Template], int]:
        """List the user's templates newest-first with their total.

        Args:
            user_id: Authenticated user's UUID.
            limit: Maximum number of templates to return.
            offset: Number of templates to skip.

        Returns:
            tuple[list[Template], int]: Newest-first page and user total.
        """
        return await self._repository.list_by_user(user_id, limit=limit, offset=offset)

    async def create_template(self, user_id: UUID, name: str, content: str) -> Template:
        """Create a template owned by the user.

        Args:
            user_id: Authenticated user's UUID.
            name: Template name.
            content: Template content.

        Returns:
            Template: Created template with generated id and timestamps.
        """
        return await self._repository.create(name=name, content=content, user_id=user_id)

    async def get_template(self, user_id: UUID, template_id: UUID) -> Template:
        """Get a template owned by the user.

        Args:
            user_id: Authenticated user's UUID.
            template_id: Template UUID.

        Returns:
            Template: The owned template.

        Raises:
            TemplateNotFoundError: If the template is missing or foreign.
        """
        template = await self._repository.get_by_user(template_id, user_id=user_id)

        if template is None:
            raise TemplateNotFoundError()

        return template

    async def delete_template(self, user_id: UUID, template_id: UUID) -> None:
        """Delete a template only when it belongs to the user.

        Deleting a missing or foreign template completes without error
        (the route answers 204), and never deletes another user's row.

        Args:
            user_id: Authenticated user's UUID.
            template_id: Template UUID.
        """
        await self._repository.delete_by_user(template_id, user_id=user_id)
