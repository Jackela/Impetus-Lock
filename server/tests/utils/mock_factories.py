"""Mock factories for LLM providers and responses.

Provides utilities for mocking LLM provider responses in tests without
making actual API calls. Includes builders for Anthropic and Gemini
responses, as well as context managers for provider mocking.

Example:
    >>> with LLMProviderMocker() as mocker:
    ...     mocker.mock_anthropic(action="provoke", content="Test content")
    ...     # Run test code that calls Anthropic provider

    >>> builder = MockResponseBuilder()
    >>> response = builder.with_action("provoke").with_content("Hello").build()
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Callable, Generator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Literal
from unittest.mock import MagicMock, Mock, patch

from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse

if TYPE_CHECKING:
    from collections.abc import Sequence


def generate_lock_id() -> str:
    """Generate a unique lock ID for testing."""
    return f"lock_{uuid.uuid4()}"


def generate_action_id() -> str:
    """Generate a unique action ID for testing."""
    return f"act_{uuid.uuid4()}"


class MockResponseBuilder:
    """Fluent builder for creating mock InterventionResponse objects.

    Provides a chainable interface for constructing test responses
    with sensible defaults and validation.

    Attributes:
        action: The intervention action type.
        content: Optional content for provoke/rewrite actions.
        lock_id: Optional lock ID for provoke/rewrite actions.
        anchor: Target position anchor (pos or range).
        action_id: Unique action identifier.
        source: The intervention source (muse or loki).
        issued_at: Timestamp when action was generated.

    Example:
        >>> response = (
        ...     MockResponseBuilder()
        ...     .with_action("provoke")
        ...     .with_content("Test content")
        ...     .with_source("muse")
        ...     .build()
        ... )
    """

    def __init__(self) -> None:
        """Initialize builder with default values."""
        self.action: Literal["provoke", "delete", "rewrite"] = "provoke"
        self.content: str | None = "Default test content"
        self.lock_id: str | None = generate_lock_id()
        self.anchor: AnchorPos | AnchorRange = AnchorPos(from_=0)
        self.action_id: str = generate_action_id()
        self.source: Literal["muse", "loki"] = "muse"
        self.issued_at: datetime = datetime.now(UTC)

    def with_action(self, action: Literal["provoke", "delete", "rewrite"]) -> MockResponseBuilder:
        """Set the action type.

        Args:
            action: The intervention action (provoke, delete, or rewrite).

        Returns:
            Self for method chaining.
        """
        self.action = action
        if action == "delete":
            self.content = None
            self.lock_id = None
            if self.anchor.type == "pos":
                self.anchor = AnchorRange(from_=0, to=10)
        return self

    def with_content(self, content: str | None) -> MockResponseBuilder:
        """Set the intervention content.

        Args:
            content: The content text (required for provoke/rewrite).

        Returns:
            Self for method chaining.
        """
        self.content = content
        return self

    def with_lock_id(self, lock_id: str | None) -> MockResponseBuilder:
        """Set the lock ID.

        Args:
            lock_id: The lock identifier (required for provoke/rewrite).

        Returns:
            Self for method chaining.
        """
        self.lock_id = lock_id
        return self

    def with_anchor(self, anchor: AnchorPos | AnchorRange) -> MockResponseBuilder:
        """Set the target anchor.

        Args:
            anchor: The position or range anchor.

        Returns:
            Self for method chaining.
        """
        self.anchor = anchor
        return self

    def with_pos_anchor(self, pos: int) -> MockResponseBuilder:
        """Set a position anchor.

        Args:
            pos: The cursor position.

        Returns:
            Self for method chaining.
        """
        self.anchor = AnchorPos(from_=pos)
        return self

    def with_range_anchor(self, from_pos: int, to_pos: int) -> MockResponseBuilder:
        """Set a range anchor.

        Args:
            from_pos: Start position.
            to_pos: End position.

        Returns:
            Self for method chaining.
        """
        self.anchor = AnchorRange(from_=from_pos, to=to_pos)
        return self

    def with_source(self, source: Literal["muse", "loki"]) -> MockResponseBuilder:
        """Set the intervention source.

        Args:
            source: The mode source (muse or loki).

        Returns:
            Self for method chaining.
        """
        self.source = source
        return self

    def with_action_id(self, action_id: str) -> MockResponseBuilder:
        """Set a custom action ID.

        Args:
            action_id: The action identifier.

        Returns:
            Self for method chaining.
        """
        self.action_id = action_id
        return self

    def with_issued_at(self, issued_at: datetime) -> MockResponseBuilder:
        """Set the issued timestamp.

        Args:
            issued_at: The timestamp.

        Returns:
            Self for method chaining.
        """
        self.issued_at = issued_at
        return self

    def build(self) -> InterventionResponse:
        """Build the InterventionResponse object.

        Returns:
            A validated InterventionResponse instance.
        """
        return InterventionResponse(
            action=self.action,
            content=self.content,
            lock_id=self.lock_id,
            anchor=self.anchor,
            action_id=self.action_id,
            source=self.source,
            issued_at=self.issued_at,
        )


class AnthropicMockFactory:
    """Factory for creating Anthropic API mock responses.

    Creates realistic mock responses that match Anthropic's
    Message API structure for testing without actual API calls.

    Example:
        >>> factory = AnthropicMockFactory()
        >>> mock_message = factory.create_message(action="provoke", content="Hello")
        >>> mock_error = factory.create_rate_limit_error()
    """

    @staticmethod
    def create_message(
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
    ) -> MagicMock:
        """Create a mock Anthropic Message response.

        Args:
            action: The intervention action.
            content: The content (None for delete actions).

        Returns:
            A mock Message object with content blocks.
        """
        response_data = {"action": action}
        if content is not None:
            response_data["content"] = content

        mock_message = MagicMock()
        mock_block = MagicMock()
        mock_block.text = json.dumps(response_data)
        mock_block.type = "text"
        mock_message.content = [mock_block]
        mock_message.id = f"msg_{uuid.uuid4()}"
        mock_message.model = "claude-3-5-haiku-latest"
        mock_message.role = "assistant"
        mock_message.stop_reason = "end_turn"
        mock_message.usage.input_tokens = 100
        mock_message.usage.output_tokens = 50

        return mock_message

    @staticmethod
    def create_text_block(text: str) -> MagicMock:
        """Create a mock TextBlock.

        Args:
            text: The text content.

        Returns:
            A mock TextBlock instance.
        """
        mock_block = MagicMock()
        mock_block.text = text
        mock_block.type = "text"
        return mock_block

    @staticmethod
    def create_rate_limit_error() -> Exception:
        """Create a mock RateLimitError.

        Returns:
            A RateLimitError instance for testing error handling.
        """
        from anthropic import RateLimitError

        return RateLimitError(
            message="Rate limit exceeded",
            request=MagicMock(),
            body={"error": {"message": "Rate limit exceeded"}},
        )

    @staticmethod
    def create_auth_error() -> Exception:
        """Create a mock AuthenticationError.

        Returns:
            An AuthenticationError instance for testing error handling.
        """
        from anthropic import AuthenticationError

        return AuthenticationError(
            message="Invalid API key",
            request=MagicMock(),
            body={"error": {"message": "Invalid API key"}},
        )

    @staticmethod
    def create_api_error(status_code: int = 500, message: str = "API Error") -> Exception:
        """Create a mock generic APIError.

        Args:
            status_code: HTTP status code.
            message: Error message.

        Returns:
            An APIError instance for testing error handling.
        """
        from anthropic import APIError

        return APIError(
            message=message,
            request=MagicMock(),
            body={"error": {"message": message}},
        )


class GeminiMockFactory:
    """Factory for creating Google Gemini API mock responses.

    Creates realistic mock responses that match Gemini's
    GenerativeModel API structure for testing without actual API calls.

    Example:
        >>> factory = GeminiMockFactory()
        >>> mock_response = factory.create_response(action="provoke", content="Hello")
        >>> mock_error = factory.create_blocked_error()
    """

    @staticmethod
    def create_response(
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
    ) -> MagicMock:
        """Create a mock Gemini GenerateContentResponse.

        Args:
            action: The intervention action.
            content: The content (None for delete actions).

        Returns:
            A mock response object with candidates and content parts.
        """
        response_data = {"action": action}
        if content is not None:
            response_data["content"] = content

        mock_part = MagicMock()
        mock_part.text = json.dumps(response_data)

        mock_content = MagicMock()
        mock_content.parts = [mock_part]
        mock_content.role = "model"

        mock_candidate = MagicMock()
        mock_candidate.content = mock_content
        mock_candidate.finish_reason = "STOP"
        mock_candidate.index = 0
        mock_candidate.safety_ratings = []

        mock_response = MagicMock()
        mock_response.candidates = [mock_candidate]
        mock_response.prompt_feedback = None
        mock_response.usage_metadata = MagicMock()
        mock_response.usage_metadata.prompt_token_count = 100
        mock_response.usage_metadata.candidates_token_count = 50
        mock_response.usage_metadata.total_token_count = 150

        return mock_response

    @staticmethod
    def create_empty_response() -> MagicMock:
        """Create a mock response with no candidates (error case).

        Returns:
            A mock response with empty candidates list.
        """
        mock_response = MagicMock()
        mock_response.candidates = []
        mock_response.prompt_feedback = MagicMock()
        mock_response.prompt_feedback.block_reason = "SAFETY"
        return mock_response

    @staticmethod
    def create_blocked_error() -> Exception:
        """Create a mock BlockedPromptException.

        Returns:
            A BlockedPromptException for testing content blocking.
        """
        import google.generativeai as genai

        return genai.types.BlockedPromptException("Content blocked by safety filters")

    @staticmethod
    def create_quota_error() -> Exception:
        """Create a mock ResourceExhaustedError.

        Returns:
            A ResourceExhaustedError for testing rate limiting.
        """
        import google.generativeai as genai

        return genai.api_key.api_errors.ResourceExhaustedError("Quota exceeded")

    @staticmethod
    def create_auth_error() -> Exception:
        """Create a mock InvalidAPIKeyError.

        Returns:
            An InvalidAPIKeyError for testing authentication failures.
        """
        import google.generativeai as genai

        return genai.api_key.api_errors.InvalidAPIKeyError("Invalid API key")


class LLMProviderMocker:
    """Context manager for mocking LLM providers in tests.

    Provides a convenient interface for patching multiple LLM provider
    methods simultaneously. Automatically cleans up patches on exit.

    Attributes:
        patches: List of active patch objects.
        mocks: Dictionary of mock objects by provider name.

    Example:
        >>> with LLMProviderMocker() as mocker:
        ...     mocker.mock_all(action="provoke", content="Test")
        ...     # Run test code

        >>> with LLMProviderMocker() as mocker:
        ...     mocker.mock_anthropic(action="delete")
        ...     mocker.mock_gemini(action="provoke", content="Hello")
        ...     # Run test code
    """

    PROVIDER_PATHS = {
        "instructor": "server.infrastructure.llm.instructor_provider.InstructorLLMProvider.generate_intervention",
        "anthropic": "server.infrastructure.llm.anthropic_provider.AnthropicLLMProvider.generate_intervention",
        "gemini": "server.infrastructure.llm.gemini_provider.GeminiLLMProvider.generate_intervention",
        "claude": "server.infrastructure.llm.claude_provider.ClaudeLLMProvider.generate_intervention",
    }

    def __init__(self) -> None:
        """Initialize the mocker with empty patch lists."""
        self.patches: list[Any] = []
        self.mocks: dict[str, Mock] = {}

    def __enter__(self) -> LLMProviderMocker:
        """Enter the context manager.

        Returns:
            Self for method chaining within the context.
        """
        return self

    def __exit__(self, exc_type: type | None, exc_val: Exception | None, exc_tb: Any) -> None:
        """Exit the context manager and clean up patches.

        Args:
            exc_type: Exception type if an error occurred.
            exc_val: Exception value if an error occurred.
            exc_tb: Exception traceback if an error occurred.
        """
        for patch_obj in self.patches:
            patch_obj.stop()

    def _create_patch(self, path: str, return_value: Any) -> Mock:
        """Create and start a patch.

        Args:
            path: The import path to patch.
            return_value: The value to return from the patched method.

        Returns:
            The mock object.
        """
        patch_obj = patch(path, return_value=return_value)
        mock = patch_obj.start()
        self.patches.append(patch_obj)
        return mock

    def mock_all(
        self,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
        **kwargs: Any,
    ) -> dict[str, Mock]:
        """Mock all LLM providers with the same response.

        Args:
            action: The intervention action.
            content: The content (None for delete).
            **kwargs: Additional arguments for MockResponseBuilder.

        Returns:
            Dictionary of mock objects by provider name.
        """
        builder = MockResponseBuilder()
        builder.with_action(action)
        if content is not None:
            builder.with_content(content)

        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)

        response = builder.build()

        for name in self.PROVIDER_PATHS:
            self.mocks[name] = self._create_patch(
                self.PROVIDER_PATHS[name],
                response,
            )

        return self.mocks

    def mock_anthropic(
        self,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
        **kwargs: Any,
    ) -> Mock:
        """Mock only the Anthropic provider.

        Args:
            action: The intervention action.
            content: The content (None for delete).
            **kwargs: Additional arguments for MockResponseBuilder.

        Returns:
            The mock object for the Anthropic provider.
        """
        builder = MockResponseBuilder()
        builder.with_action(action)
        if content is not None:
            builder.with_content(content)

        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)

        self.mocks["anthropic"] = self._create_patch(
            self.PROVIDER_PATHS["anthropic"],
            builder.build(),
        )
        return self.mocks["anthropic"]

    def mock_gemini(
        self,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
        **kwargs: Any,
    ) -> Mock:
        """Mock only the Gemini provider.

        Args:
            action: The intervention action.
            content: The content (None for delete).
            **kwargs: Additional arguments for MockResponseBuilder.

        Returns:
            The mock object for the Gemini provider.
        """
        builder = MockResponseBuilder()
        builder.with_action(action)
        if content is not None:
            builder.with_content(content)

        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)

        self.mocks["gemini"] = self._create_patch(
            self.PROVIDER_PATHS["gemini"],
            builder.build(),
        )
        return self.mocks["gemini"]

    def mock_instructor(
        self,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
        **kwargs: Any,
    ) -> Mock:
        """Mock only the Instructor/OpenAI provider.

        Args:
            action: The intervention action.
            content: The content (None for delete).
            **kwargs: Additional arguments for MockResponseBuilder.

        Returns:
            The mock object for the Instructor provider.
        """
        builder = MockResponseBuilder()
        builder.with_action(action)
        if content is not None:
            builder.with_content(content)

        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)

        self.mocks["instructor"] = self._create_patch(
            self.PROVIDER_PATHS["instructor"],
            builder.build(),
        )
        return self.mocks["instructor"]

    def mock_claude(
        self,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = "Test content",
        **kwargs: Any,
    ) -> Mock:
        """Mock only the Claude provider.

        Args:
            action: The intervention action.
            content: The content (None for delete).
            **kwargs: Additional arguments for MockResponseBuilder.

        Returns:
            The mock object for the Claude provider.
        """
        builder = MockResponseBuilder()
        builder.with_action(action)
        if content is not None:
            builder.with_content(content)

        for key, value in kwargs.items():
            if hasattr(builder, f"with_{key}"):
                getattr(builder, f"with_{key}")(value)

        self.mocks["claude"] = self._create_patch(
            self.PROVIDER_PATHS["claude"],
            builder.build(),
        )
        return self.mocks["claude"]


@contextmanager
def mock_anthropic_response(
    action: Literal["provoke", "delete", "rewrite"] = "provoke",
    content: str | None = "Test content",
) -> Generator[InterventionResponse, None, None]:
    """Context manager for mocking a single Anthropic response.

    Convenience context manager for simple one-off Anthropic mocks.

    Args:
        action: The intervention action.
        content: The content (None for delete).

    Yields:
        The mock response that will be returned.

    Example:
        >>> with mock_anthropic_response(action="provoke", content="Hello") as response:
        ...     # Run test code
        ...     assert response.action == "provoke"
    """
    builder = MockResponseBuilder()
    builder.with_action(action)
    if content is not None:
        builder.with_content(content)
    response = builder.build()

    with patch(
        "server.infrastructure.llm.anthropic_provider.AnthropicLLMProvider.generate_intervention",
        return_value=response,
    ):
        yield response


@contextmanager
def mock_gemini_response(
    action: Literal["provoke", "delete", "rewrite"] = "provoke",
    content: str | None = "Test content",
) -> Generator[InterventionResponse, None, None]:
    """Context manager for mocking a single Gemini response.

    Convenience context manager for simple one-off Gemini mocks.

    Args:
        action: The intervention action.
        content: The content (None for delete).

    Yields:
        The mock response that will be returned.

    Example:
        >>> with mock_gemini_response(action="delete") as response:
        ...     # Run test code
        ...     assert response.action == "delete"
    """
    builder = MockResponseBuilder()
    builder.with_action(action)
    if content is not None:
        builder.with_content(content)
    response = builder.build()

    with patch(
        "server.infrastructure.llm.gemini_provider.GeminiLLMProvider.generate_intervention",
        return_value=response,
    ):
        yield response


def async_mock(return_value: Any) -> Mock:
    """Create an async mock that returns the given value.

    Helper function for creating async mock functions that can be
    awaited in async tests.

    Args:
        return_value: The value to return when the mock is awaited.

    Returns:
        An async mock object.

    Example:
        >>> mock = async_mock(InterventionResponse(...))
        >>> result = await mock()  # Returns the mock response
    """

    async def _async_mock(*args: Any, **kwargs: Any) -> Any:
        return return_value

    return Mock(side_effect=_async_mock)


def async_mock_generator(items: Sequence[Any]) -> Mock:
    """Create an async mock that yields items from a sequence.

    Helper function for creating async generator mocks that can be
    used with async for loops.

    Args:
        items: Sequence of items to yield.

    Returns:
        An async mock generator.

    Example:
        >>> mock_gen = async_mock_generator(["chunk1", "chunk2"])
        >>> async for chunk in mock_gen():
        ...     print(chunk)  # Prints "chunk1", then "chunk2"
    """

    async def _async_gen(*args: Any, **kwargs: Any) -> Any:
        for item in items:
            yield item

    return Mock(side_effect=_async_gen)


def create_coroutine_mock(return_value: Any = None) -> Mock:
    """Create a mock for an async function.

    Creates a mock that properly simulates a coroutine function
    that can be awaited.

    Args:
        return_value: The value to return when awaited.

    Returns:
        A mock that can be awaited.
    """
    mock = Mock()

    async def coro(*args: Any, **kwargs: Any) -> Any:
        return return_value

    mock.side_effect = coro
    return mock
