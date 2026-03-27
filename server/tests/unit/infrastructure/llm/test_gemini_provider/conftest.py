"""Pytest configuration for Gemini provider tests.

Fixtures defined here are shared across all test modules in this package.
"""

from __future__ import annotations

import json
import sys
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, Mock, patch

import pytest

if TYPE_CHECKING:
    from collections.abc import Generator

# Check if google.generativeai is available
try:
    import google.generativeai as _genai  # noqa: F401

    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider


@pytest.fixture
def mock_genai() -> Generator[Mock, None, None]:
    """Mock the google.generativeai module."""
    if not _GENAI_AVAILABLE:
        pytest.skip("google.generativeai not installed")

    # Create proper exception classes that inherit from Exception
    class BlockedPromptException(Exception):
        """Mock BlockedPromptException."""

        pass

    class StopCandidateException(Exception):
        """Mock StopCandidateException."""

        pass

    class InvalidArgument(Exception):
        """Mock InvalidArgument."""

        pass

    class InvalidAPIKeyError(Exception):
        """Mock InvalidAPIKeyError."""

        pass

    class PermissionDeniedError(Exception):
        """Mock PermissionDeniedError."""

        pass

    class ResourceExhaustedError(Exception):
        """Mock ResourceExhaustedError."""

        pass

    class InternalServerError(Exception):
        """Mock InternalServerError."""

        pass

    class UnavailableError(Exception):
        """Mock UnavailableError."""

        pass

    class ResourceExhausted(Exception):
        """Mock ResourceExhausted."""

        pass

    # Patch both modules
    with patch("google.api_core.exceptions") as mock_api_core, patch("google.generativeai") as mock:
        # Set up the mock types
        mock.types = MagicMock()
        mock.types.BlockedPromptException = BlockedPromptException
        mock.types.StopCandidateException = StopCandidateException
        mock.types.InvalidArgument = InvalidArgument

        # Set up api_key errors
        mock.api_key = MagicMock()
        mock.api_key.api_errors = MagicMock()
        mock.api_key.api_errors.InvalidAPIKeyError = InvalidAPIKeyError
        mock.api_key.api_errors.PermissionDeniedError = PermissionDeniedError
        mock.api_key.api_errors.ResourceExhaustedError = ResourceExhaustedError
        mock.api_key.api_errors.InternalServerError = InternalServerError
        mock.api_key.api_errors.UnavailableError = UnavailableError

        # Set up google.api_core.exceptions
        mock_api_core.ResourceExhausted = ResourceExhausted

        # Inject into sys.modules so direct imports work in tests
        # This ensures `from google.generativeai.types import X` works
        mock_types_module = MagicMock()
        mock_types_module.BlockedPromptException = BlockedPromptException
        mock_types_module.StopCandidateException = StopCandidateException
        mock_types_module.InvalidArgument = InvalidArgument
        sys.modules["google.generativeai.types"] = mock_types_module

        mock_api_errors_module = MagicMock()
        mock_api_errors_module.InvalidAPIKeyError = InvalidAPIKeyError
        mock_api_errors_module.PermissionDeniedError = PermissionDeniedError
        mock_api_errors_module.ResourceExhaustedError = ResourceExhaustedError
        mock_api_errors_module.InternalServerError = InternalServerError
        mock_api_errors_module.UnavailableError = UnavailableError
        sys.modules["google.generativeai.api_errors"] = mock_api_errors_module

        yield mock

        # Cleanup
        del sys.modules["google.generativeai.types"]
        del sys.modules["google.generativeai.api_errors"]


@pytest.fixture
def mock_response() -> MagicMock:
    """Create a mock Gemini response with successful completion."""
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content.parts = [MagicMock()]
    response.candidates[0].content.parts[0].text = json.dumps(
        {"action": "provoke", "content": "Test intervention content"}
    )
    return response


@pytest.fixture
def provider(mock_genai: Mock) -> GeminiLLMProvider:
    """Create a GeminiLLMProvider instance with mocked genai."""
    return GeminiLLMProvider(
        api_key="test-api-key",
        model="gemini-pro",
    )
