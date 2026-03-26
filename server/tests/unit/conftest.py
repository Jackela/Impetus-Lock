"""Unit test fixtures for fast, isolated tests.

Provides factories and mocks for domain models and infrastructure components.
All fixtures here should have no external dependencies and run in <100ms.

Constitutional Compliance:
- Article I (Simplicity): Fast, focused fixtures
- Article III (TDD): Support for TDD workflows
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest

if TYPE_CHECKING:
    from server.domain.models.anchor import AnchorPos, AnchorRange
    from server.domain.models.intervention import (
        ClientMeta,
        InterventionRequest,
        InterventionResponse,
    )


@pytest.fixture
def intervention_response_factory() -> type:
    """Factory for creating InterventionResponse instances.

    Returns:
        Factory class for InterventionResponse.
    """
    from server.domain.models.anchor import AnchorPos, AnchorRange
    from server.domain.models.intervention import InterventionResponse

    class InterventionResponseFactory:
        """Factory for creating intervention responses."""

        @staticmethod
        def provoke(
            content: str = "Test provoke content",
            lock_id: str | None = None,
            action_id: str | None = None,
            source: str = "muse",
            anchor_from: int = 100,
        ) -> InterventionResponse:
            """Create a provoke action response.

            Args:
                content: Provocation content.
                lock_id: Optional lock ID (generated if None).
                action_id: Optional action ID (generated if None).
                source: Source mode (muse/loki).
                anchor_from: Anchor position.

            Returns:
                InterventionResponse with provoke action.
            """
            return InterventionResponse(
                action="provoke",
                content=content,
                lock_id=lock_id or f"lock_{uuid4()}",
                anchor=AnchorPos.model_validate({"type": "pos", "from": anchor_from}),
                action_id=action_id or f"act_{uuid4()}",
                source=source,  # type: ignore[arg-type]
                issued_at=datetime.now(UTC),
            )

        @staticmethod
        def delete(
            action_id: str | None = None,
            source: str = "loki",
            anchor_from: int = 100,
            anchor_to: int = 150,
        ) -> InterventionResponse:
            """Create a delete action response.

            Args:
                action_id: Optional action ID (generated if None).
                source: Source mode (muse/loki).
                anchor_from: Range start position.
                anchor_to: Range end position.

            Returns:
                InterventionResponse with delete action.
            """
            return InterventionResponse(
                action="delete",
                content=None,
                lock_id=None,
                anchor=AnchorRange.model_validate(
                    {"type": "range", "from": anchor_from, "to": anchor_to}
                ),
                action_id=action_id or f"act_{uuid4()}",
                source=source,  # type: ignore[arg-type]
                issued_at=datetime.now(UTC),
            )

        @staticmethod
        def rewrite(
            content: str = "Test rewrite content",
            lock_id: str | None = None,
            action_id: str | None = None,
            source: str = "muse",
            anchor_from: int = 100,
            anchor_to: int = 150,
        ) -> InterventionResponse:
            """Create a rewrite action response.

            Args:
                content: Rewritten content.
                lock_id: Optional lock ID (generated if None).
                action_id: Optional action ID (generated if None).
                source: Source mode (muse/loki).
                anchor_from: Range start position.
                anchor_to: Range end position.

            Returns:
                InterventionResponse with rewrite action.
            """
            return InterventionResponse(
                action="rewrite",
                content=content,
                lock_id=lock_id or f"lock_{uuid4()}",
                anchor=AnchorRange.model_validate(
                    {"type": "range", "from": anchor_from, "to": anchor_to}
                ),
                action_id=action_id or f"act_{uuid4()}",
                source=source,  # type: ignore[arg-type]
                issued_at=datetime.now(UTC),
            )

    return InterventionResponseFactory


@pytest.fixture
def muse_request_factory() -> type:
    """Factory for creating Muse mode intervention requests.

    Returns:
        Factory class for InterventionRequest (muse mode).
    """
    from server.domain.models.intervention import ClientMeta, InterventionRequest

    class MuseRequestFactory:
        """Factory for Muse mode requests."""

        DEFAULT_CONTEXT = "他打开门，犹豫着要不要进去。"

        @staticmethod
        def create(
            context: str | None = None,
            doc_version: int = 42,
            selection_from: int = 100,
            selection_to: int | None = None,
        ) -> InterventionRequest:
            """Create a Muse mode request.

            Args:
                context: Writing context (uses default if None).
                doc_version: Document version.
                selection_from: Selection start position.
                selection_to: Selection end position (defaults to selection_from).

            Returns:
                InterventionRequest configured for Muse mode.
            """
            return InterventionRequest(
                context=context or MuseRequestFactory.DEFAULT_CONTEXT,
                mode="muse",
                client_meta=ClientMeta(
                    doc_version=doc_version,
                    selection_from=selection_from,
                    selection_to=selection_to or selection_from,
                ),
            )

    return MuseRequestFactory


@pytest.fixture
def loki_request_factory() -> type:
    """Factory for creating Loki mode intervention requests.

    Returns:
        Factory class for InterventionRequest (loki mode).
    """
    from server.domain.models.intervention import ClientMeta, InterventionRequest

    class LokiRequestFactory:
        """Factory for Loki mode requests."""

        DEFAULT_CONTEXT = (
            "This is a sufficiently long context that exceeds fifty characters "
            "to allow delete actions in Loki mode."
        )

        @staticmethod
        def create(
            context: str | None = None,
            doc_version: int = 10,
            selection_from: int = 200,
            selection_to: int | None = None,
        ) -> InterventionRequest:
            """Create a Loki mode request.

            Args:
                context: Writing context (uses default if None).
                doc_version: Document version.
                selection_from: Selection start position.
                selection_to: Selection end position (defaults to selection_from).

            Returns:
                InterventionRequest configured for Loki mode.
            """
            return InterventionRequest(
                context=context or LokiRequestFactory.DEFAULT_CONTEXT,
                mode="loki",
                client_meta=ClientMeta(
                    doc_version=doc_version,
                    selection_from=selection_from,
                    selection_to=selection_to or selection_from,
                ),
            )

    return LokiRequestFactory


@pytest.fixture
def mock_llm_provider() -> Mock:
    """Create a mock LLM provider for unit tests.

    Returns:
        Mock object configured as LLMProvider.
    """
    mock = Mock(spec="server.domain.llm_provider.LLMProvider")
    mock.provider_name = "mock"
    mock.model = "mock-model"
    return mock


@pytest.fixture
def mock_claude_provider() -> Mock:
    """Create a mock Claude provider.

    Returns:
        Mock configured as ClaudeProvider.
    """
    from server.infrastructure.llm.claude_provider import ClaudeProvider

    mock = Mock(spec=ClaudeProvider)
    mock.provider_name = "claude"
    mock.model = "claude-3-5-sonnet-20241022"
    mock.temperature = 0.8
    mock.max_tokens = 400
    return mock


@pytest.fixture
def mock_anthropic_response_factory() -> type:
    """Factory for creating mock Anthropic API responses.

    Returns:
        Factory class for mock Anthropic responses.
    """
    from anthropic.types import Message, TextBlock, Usage

    class MockAnthropicResponseFactory:
        """Factory for Anthropic API response mocks."""

        @staticmethod
        def provoke(
            content: str = "门后传来低沉的呼吸声。",
            input_tokens: int = 100,
            output_tokens: int = 50,
        ) -> MagicMock:
            """Create mock response for provoke action.

            Args:
                content: Provocation content.
                input_tokens: Input token count.
                output_tokens: Output token count.

            Returns:
                Mock Message object.
            """
            mock_message = MagicMock(spec=Message)
            mock_message.content = [
                TextBlock(
                    text=json.dumps({"action": "provoke", "content": content}),
                    type="text",
                )
            ]
            mock_message.stop_reason = "end_turn"
            mock_message.usage = Usage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )
            return mock_message

        @staticmethod
        def rewrite(
            content: str = "门后其实是台手术桌。",
            input_tokens: int = 90,
            output_tokens: int = 40,
        ) -> MagicMock:
            """Create mock response for rewrite action.

            Args:
                content: Rewritten content.
                input_tokens: Input token count.
                output_tokens: Output token count.

            Returns:
                Mock Message object.
            """
            mock_message = MagicMock(spec=Message)
            mock_message.content = [
                TextBlock(
                    text=json.dumps({"action": "rewrite", "content": content}),
                    type="text",
                )
            ]
            mock_message.stop_reason = "end_turn"
            mock_message.usage = Usage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )
            return mock_message

        @staticmethod
        def delete(
            anchor_from: int = 100,
            anchor_to: int = 150,
            input_tokens: int = 80,
            output_tokens: int = 30,
        ) -> MagicMock:
            """Create mock response for delete action.

            Args:
                anchor_from: Range start.
                anchor_to: Range end.
                input_tokens: Input token count.
                output_tokens: Output token count.

            Returns:
                Mock Message object.
            """
            mock_message = MagicMock(spec=Message)
            mock_message.content = [
                TextBlock(
                    text=json.dumps(
                        {
                            "action": "delete",
                            "anchor": {"type": "range", "from": anchor_from, "to": anchor_to},
                        }
                    ),
                    type="text",
                )
            ]
            mock_message.stop_reason = "end_turn"
            mock_message.usage = Usage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )
            return mock_message

        @staticmethod
        def error_rate_limit() -> Exception:
            """Create rate limit error.

            Returns:
                RateLimitError exception.
            """
            from anthropic import RateLimitError

            return RateLimitError(
                message="Rate limit exceeded",
                request=MagicMock(),
                body={"error": {"message": "Rate limit exceeded"}},
            )

        @staticmethod
        def error_auth() -> Exception:
            """Create authentication error.

            Returns:
                AuthenticationError exception.
            """
            from anthropic import AuthenticationError

            return AuthenticationError(
                message="Invalid API key",
                request=MagicMock(),
                body={"error": {"message": "Invalid API key"}},
            )

    return MockAnthropicResponseFactory


@pytest.fixture
def mock_intervention_service() -> Mock:
    """Create a mock intervention service.

    Returns:
        Mock configured as InterventionService.
    """
    from server.application.services.intervention_service import InterventionService

    mock = Mock(spec=InterventionService)
    mock.llm_provider = None
    mock.task_repository = None
    mock.observability = None
    return mock


@pytest.fixture
def client_meta_factory() -> type:
    """Factory for ClientMeta instances.

    Returns:
        Factory class for ClientMeta.
    """
    from server.domain.models.intervention import ClientMeta

    class ClientMetaFactory:
        """Factory for client metadata."""

        @staticmethod
        def create(
            doc_version: int = 1,
            selection_from: int = 100,
            selection_to: int | None = None,
        ) -> ClientMeta:
            """Create ClientMeta instance.

            Args:
                doc_version: Document version.
                selection_from: Selection start.
                selection_to: Selection end (defaults to selection_from).

            Returns:
                ClientMeta instance.
            """
            return ClientMeta(
                doc_version=doc_version,
                selection_from=selection_from,
                selection_to=selection_to or selection_from,
            )

    return ClientMetaFactory


@pytest.fixture
def anchor_factory() -> type:
    """Factory for anchor instances.

    Returns:
        Factory class for Anchor types.
    """
    from server.domain.models.anchor import AnchorPos, AnchorRange

    class AnchorFactory:
        """Factory for anchor types."""

        @staticmethod
        def pos(from_: int = 100) -> AnchorPos:
            """Create position anchor.

            Args:
                from_: Position value.

            Returns:
                AnchorPos instance.
            """
            return AnchorPos.model_validate({"type": "pos", "from": from_})

        @staticmethod
        def range(from_: int = 100, to: int = 150) -> AnchorRange:
            """Create range anchor.

            Args:
                from_: Start position.
                to: End position.

            Returns:
                AnchorRange instance.
            """
            return AnchorRange.model_validate({"type": "range", "from": from_, "to": to})

    return AnchorFactory


@pytest.fixture
def task_repository_mock() -> Mock:
    """Create a mock task repository.

    Returns:
        Mock configured as TaskRepository.
    """
    mock = Mock(spec="server.domain.repositories.task_repository.TaskRepository")
    mock.get_by_id = Mock(return_value=None)
    mock.save = Mock(return_value=None)
    mock.delete = Mock(return_value=None)
    mock.list_all = Mock(return_value=[])
    return mock


@pytest.fixture
def in_memory_task_repository() -> Any:
    """Create an in-memory task repository.

    Returns:
        InMemoryTaskRepository instance.
    """
    from server.infrastructure.persistence.in_memory_task_repository import (
        InMemoryTaskRepository,
    )

    return InMemoryTaskRepository()
