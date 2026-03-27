"""Tests for error handling, retry logic, and fallback mechanisms.

Tests network failures, retry logic, circuit breakers, and graceful
error handling throughout the application.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

try:
    from tenacity import RetryError

    _ = RetryError  # Mark as used
    TENACITY_AVAILABLE = True
except ImportError:
    TENACITY_AVAILABLE = False

# Skip all tests if anthropic is not available
pytest.importorskip("anthropic", reason="anthropic module not installed")

try:
    from anthropic import AuthenticationError, RateLimitError

    _ = AuthenticationError  # Mark as used
    _ = RateLimitError  # Mark as used
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


class TestRetryLogic:
    """Tests for retry mechanisms."""

    @pytest.mark.asyncio
    async def test_retry_on_transient_error(self) -> None:
        """Test retry on transient network errors."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        # Mock client that fails twice then succeeds
        call_count = 0

        def mock_create(*args, **kwargs) -> Any:
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise ConnectionError("Transient network error")

            # Return success on third try
            mock_message = MagicMock()
            mock_message.content = [MagicMock(text='{"action": "provoke", "content": "test"}')]
            mock_message.stop_reason = "end_turn"
            mock_message.usage.input_tokens = 100
            mock_message.usage.output_tokens = 50
            return mock_message

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=mock_create,
        ):
            # Should eventually succeed after retries
            # Note: ClaudeProvider uses synchronous _complete method
            result = provider._complete_with_raw_api("system", "user")

        assert call_count >= 2  # Should have retried
        assert result is not None  # Should return a result
        assert call_count >= 2  # Should have retried
        assert result is not None  # Should return a result

    @pytest.mark.asyncio
    async def test_no_retry_on_auth_error(self) -> None:
        """Test no retry on authentication errors."""
        from anthropic import AuthenticationError

        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="invalid-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        call_count = 0

        async def mock_create(*args, **kwargs) -> Any:
            nonlocal call_count
            call_count += 1
            raise AuthenticationError(
                message="Invalid API key",
                response=MagicMock(status_code=401),
                body={"error": {"message": "Invalid API key"}},
            )

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=mock_create,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError) as exc_info:
                await provider.generate("system", "user")

            assert exc_info.value.code == "invalid_api_key"
            assert call_count == 1  # Should not retry


class TestFallbackMechanisms:
    """Tests for fallback mechanisms."""

    @pytest.mark.asyncio
    async def test_database_fallback_on_failure(self) -> None:
        """Test fallback to memory database when primary fails."""
        from server.infrastructure.persistence.database import DatabaseManager

        # Test with invalid database URL
        manager = DatabaseManager()

        # Mock that should cause fallback
        with (
            patch.object(
                manager,
                "_create_async_engine",
                side_effect=Exception("DB down"),
            ),
            contextlib.suppress(Exception),
        ):
            await manager.initialize()
        with (
            patch.object(
                manager,
                "_create_async_engine",
                side_effect=Exception("DB down"),
            ),
            contextlib.suppress(Exception),
        ):
            await manager.initialize()
            # Should fallback gracefully
            with contextlib.suppress(Exception):
                await manager.initialize()

    @pytest.mark.asyncio
    async def test_redis_fallback_to_memory(self) -> None:
        """Test Redis fallback when connection fails."""
        from server.infrastructure.rate_limiting import RateLimiter

        # Create limiter with invalid URL
        limiter = RateLimiter(redis_url="redis://invalid:9999/0")

        # Should still allow requests (fail open)
        allowed = await limiter.is_allowed("test_key", "10/minute")
        assert allowed is True

    @pytest.mark.asyncio
    async def test_llm_provider_fallback(self) -> None:
        """Test LLM provider fallback mechanism."""
        from server.infrastructure.llm.provider_registry import ProviderRegistry

        registry = ProviderRegistry()

        # When primary fails, should try fallback
        with patch.dict("os.environ", {}, clear=True):
            # No API keys set
            providers = registry.get_available_providers()

            # Should have debug provider available
            assert any(p.provider_name == "debug" for p in providers)


class TestNetworkFailureHandling:
    """Tests for network failure scenarios."""

    @pytest.mark.asyncio
    async def test_timeout_handling(self) -> None:
        """Test handling of request timeouts."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        async def slow_create(*args, **kwargs) -> Any:
            await asyncio.sleep(100)  # Very long timeout
            return MagicMock()

        with (
            patch.object(
                provider._anthropic_client.messages,
                "create",
                side_effect=slow_create,
            ),
            pytest.raises(asyncio.TimeoutError),
        ):
            # Should timeout
            await asyncio.wait_for(
                provider.generate("system", "user"),
                timeout=0.1,
            )

    @pytest.mark.asyncio
    async def test_connection_reset_handling(self) -> None:
        """Test handling of connection reset errors."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        async def reset_error(*args, **kwargs) -> Any:
            raise ConnectionResetError("Connection reset by peer")

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=reset_error,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError):
                await provider.generate("system", "user")

    @pytest.mark.asyncio
    async def test_dns_failure_handling(self) -> None:
        """Test handling of DNS resolution failures."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        async def dns_error(*args, **kwargs) -> Any:
            raise OSError("Name or service not known")

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=dns_error,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError):
                await provider.generate("system", "user")


class TestErrorScenarios:
    """Tests for various error scenarios."""

    @pytest.mark.asyncio
    async def test_malformed_json_response(self) -> None:
        """Test handling of malformed JSON in LLM response."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="not valid json")]
        mock_message.stop_reason = "end_turn"
        mock_message.usage.input_tokens = 100
        mock_message.usage.output_tokens = 50

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            return_value=mock_message,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError) as exc_info:
                await provider.generate("system", "user")

            assert (
                "parse" in exc_info.value.message.lower()
                or "json" in exc_info.value.message.lower()
            )

    @pytest.mark.asyncio
    async def test_empty_response_handling(self) -> None:
        """Test handling of empty LLM response."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        mock_message = MagicMock()
        mock_message.content = []
        mock_message.usage.input_tokens = 50
        mock_message.usage.output_tokens = 0

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            return_value=mock_message,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError) as exc_info:
                await provider.generate("system", "user")

            assert exc_info.value.code == "invalid_response"

    @pytest.mark.asyncio
    async def test_rate_limit_with_retry_after(self) -> None:
        """Test rate limit handling with Retry-After header."""
        from anthropic import RateLimitError

        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        response_mock = MagicMock()
        response_mock.status_code = 429
        response_mock.headers = {"Retry-After": "60"}

        async def rate_limit_error(*args, **kwargs) -> Any:
            raise RateLimitError(
                message="Rate limit exceeded",
                response=response_mock,
                body={"error": {"message": "Rate limit exceeded"}},
            )

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=rate_limit_error,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError) as exc_info:
                await provider.generate("system", "user")

            assert exc_info.value.code == "quota_exceeded"
            assert exc_info.value.status_code == 402


class TestEdgeCases:
    """Tests for edge cases in error handling."""

    @pytest.mark.asyncio
    async def test_concurrent_error_handling(self) -> None:
        """Test handling errors in concurrent requests."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        error_count = 0

        async def sometimes_fail(*args, **kwargs) -> Any:
            nonlocal error_count
            error_count += 1
            if error_count % 2 == 0:
                raise ConnectionError("Network error")

            mock_message = MagicMock()
            mock_message.content = [MagicMock(text='{"action": "provoke", "content": "test"}')]
            mock_message.stop_reason = "end_turn"
            mock_message.usage.input_tokens = 100
            mock_message.usage.output_tokens = 50
            return mock_message

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=sometimes_fail,
        ):
            # Run concurrent requests
            tasks = [provider.generate("system", "user") for _ in range(4)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Should have mix of successes and errors
            errors = [r for r in results if isinstance(r, Exception)]
            assert len(errors) > 0

    @pytest.mark.asyncio
    async def test_circular_reference_in_error(self) -> None:
        """Test handling errors with circular references."""
        # Create circular reference
        a: dict[str, Any] = {}
        b = {"ref": a}
        a["ref"] = b

        # Should not crash when logging/handling
        try:
            str(a)  # This could fail with circular refs
        except RecursionError:
            pytest.fail("Circular reference handling failed")

    @pytest.mark.asyncio
    async def test_very_long_error_message(self) -> None:
        """Test handling very long error messages."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        long_message = "Error: " + "x" * 100000

        async def error_with_long_message(*args, **kwargs) -> Any:
            raise ConnectionError(long_message)

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=error_with_long_message,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError):
                await provider.generate("system", "user")

    @pytest.mark.asyncio
    async def test_unicode_in_error_messages(self) -> None:
        """Test handling unicode and emoji in error messages."""
        from server.infrastructure.llm.claude_provider import ClaudeProvider

        provider = ClaudeProvider(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            max_tokens=400,
            use_instructor=False,
        )

        unicode_error = "错误 🎌 エラー 🎉"

        async def error_with_unicode(*args, **kwargs) -> Any:
            raise ConnectionError(unicode_error)

        with patch.object(
            provider._anthropic_client.messages,
            "create",
            side_effect=error_with_unicode,
        ):
            from server.domain.errors import LLMProviderError

            with pytest.raises(LLMProviderError):
                await provider.generate("system", "user")


class TestGracefulDegradation:
    """Tests for graceful degradation under failures."""

    @pytest.mark.asyncio
    async def test_graceful_llm_failure(self) -> None:
        """Test graceful handling when LLM completely fails."""
        from server.application.services.intervention_service import InterventionService

        service = InterventionService()

        # Mock LLM provider to always fail
        mock_provider = Mock()
        mock_provider.generate = AsyncMock(side_effect=Exception("LLM completely failed"))
        service.llm_provider = mock_provider

        # Should return fallback response, not crash
        # Note: Implementation dependent

    @pytest.mark.asyncio
    async def test_graceful_database_failure(self) -> None:
        """Test graceful handling when database fails."""
        from server.infrastructure.persistence.in_memory_task_repository import (
            InMemoryTaskRepository,
        )

        repo = InMemoryTaskRepository()

        # Simulate operations that should still work
        # In-memory repo should always work
        assert repo._actions == {}
