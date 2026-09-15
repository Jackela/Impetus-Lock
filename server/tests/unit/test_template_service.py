"""Unit tests for the user-scoped TemplateService.

Written BEFORE extraction (openspec/changes/refactor-route-service-boundaries
task 1.3) and kept as the service regression suite afterwards. They pin
owner-scoped behavior: foreign fetches raise, foreign deletions never delete,
listing is scoped, and repository failures are never returned as success.
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import pytest

from server.application.services.template_service import (
    TemplateNotFoundError,
    TemplateService,
)
from server.domain.entities.template import Template
from server.domain.repositories.template_repository import TemplateRepository

pytestmark = pytest.mark.asyncio


class FakeTemplateRepository(TemplateRepository):
    """In-memory fake used to observe what the service asks persistence to do."""

    def __init__(self) -> None:
        self.rows: dict[UUID, Template] = {}
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def list_by_user(
        self, user_id: UUID, limit: int, offset: int
    ) -> tuple[list[Template], int]:
        self.calls.append(("list_by_user", {"user_id": user_id}))
        owned = [t for t in self.rows.values() if t.user_id == user_id]
        owned.sort(key=lambda t: t.created_at, reverse=True)
        return owned[offset : offset + limit], len(owned)

    async def get_by_user(self, template_id: UUID, user_id: UUID) -> Template | None:
        self.calls.append(("get_by_user", {"template_id": template_id, "user_id": user_id}))
        template = self.rows.get(template_id)
        if template is None or template.user_id != user_id:
            return None
        return template

    async def create(self, name: str, content: str, user_id: UUID) -> Template:
        self.calls.append(("create", {"name": name, "content": content, "user_id": user_id}))
        now = datetime.now(UTC)
        template = Template(
            id=uuid4(),
            name=name,
            content=content,
            user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        self.rows[template.id] = template
        return template

    async def delete_by_user(self, template_id: UUID, user_id: UUID) -> None:
        self.calls.append(("delete_by_user", {"template_id": template_id, "user_id": user_id}))
        template = self.rows.get(template_id)
        if template is not None and template.user_id == user_id:
            del self.rows[template_id]


@pytest.fixture
def repository() -> FakeTemplateRepository:
    """Fresh fake repository."""
    return FakeTemplateRepository()


@pytest.fixture
def service(repository: FakeTemplateRepository) -> TemplateService:
    """TemplateService wired to the fake repository."""
    return TemplateService(repository)


@pytest.fixture
def owner_id() -> UUID:
    """Synthetic owner user ID."""
    return uuid4()


@pytest.fixture
def foreign_id() -> UUID:
    """Synthetic foreign user ID."""
    return uuid4()


async def seed(repository: FakeTemplateRepository, user_id: UUID, name: str = "tpl") -> Template:
    """Create one template row for the given user."""
    return await repository.create(name, "body", user_id)


class TestListTemplates:
    """list_templates is scoped to the requesting user."""

    async def test_returns_only_the_user_rows_with_total(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
        foreign_id: UUID,
    ) -> None:
        """Only the requesting user's rows are returned, with their total."""
        owned = await seed(repository, owner_id, "mine")
        await seed(repository, foreign_id, "theirs")

        templates, total = await service.list_templates(owner_id, limit=100, offset=0)

        assert [t.id for t in templates] == [owned.id]
        assert total == 1
        assert ("list_by_user", {"user_id": owner_id}) in repository.calls


class TestCreateTemplate:
    """create_template delegates with the authenticated user id."""

    async def test_create_passes_name_content_and_user(
        self, service: TemplateService, owner_id: UUID
    ) -> None:
        """Created template carries the owner's user id and given fields."""
        template = await service.create_template(owner_id, "Morning", "pages")

        assert template.name == "Morning"
        assert template.content == "pages"
        assert template.user_id == owner_id

    async def test_create_propagates_repository_failure(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
    ) -> None:
        """A repository error surfaces instead of a fake success."""

        async def exploding_create(name: str, content: str, user_id: UUID) -> Template:
            raise RuntimeError("database unavailable")

        repository.create = exploding_create  # type: ignore[method-assign]

        with pytest.raises(RuntimeError, match="database unavailable"):
            await service.create_template(owner_id, "x", "y")


class TestGetTemplate:
    """get_template enforces ownership before returning data."""

    async def test_returns_owned_template(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
    ) -> None:
        """Owned templates come back unchanged."""
        owned = await seed(repository, owner_id)

        assert await service.get_template(owner_id, owned.id) == owned

    async def test_foreign_template_raises_not_found(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
        foreign_id: UUID,
    ) -> None:
        """Another user's template raises TemplateNotFoundError with route detail."""
        owned = await seed(repository, owner_id)

        with pytest.raises(TemplateNotFoundError) as excinfo:
            await service.get_template(foreign_id, owned.id)

        assert str(excinfo.value) == "Template not found"

    async def test_missing_template_raises_not_found(
        self, service: TemplateService, owner_id: UUID
    ) -> None:
        """Unknown ids raise TemplateNotFoundError."""
        with pytest.raises(TemplateNotFoundError):
            await service.get_template(owner_id, uuid4())


class TestDeleteTemplate:
    """delete_template keeps the current delete-by-owner semantics."""

    async def test_deletes_owned_template(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
    ) -> None:
        """Owned rows are removed."""
        owned = await seed(repository, owner_id)

        await service.delete_template(owner_id, owned.id)

        assert owned.id not in repository.rows

    async def test_foreign_delete_does_not_delete(
        self,
        service: TemplateService,
        repository: FakeTemplateRepository,
        owner_id: UUID,
        foreign_id: UUID,
    ) -> None:
        """A foreign deletion request never removes the owner's row."""
        owned = await seed(repository, owner_id)

        await service.delete_template(foreign_id, owned.id)

        assert repository.rows[owned.id] == owned
        assert repository.calls[-1] == (
            "delete_by_user",
            {"template_id": owned.id, "user_id": foreign_id},
        )

    async def test_missing_delete_is_silent(self, service: TemplateService, owner_id: UUID) -> None:
        """Deleting an unknown id must not raise (route answers 204)."""
        await service.delete_template(owner_id, uuid4())
