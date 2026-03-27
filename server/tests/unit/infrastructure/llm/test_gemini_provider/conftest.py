"""Pytest configuration for Gemini provider tests.

Fixtures defined here are shared across all test modules in this package.
"""

from __future__ import annotations

import json
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

    with patch("google.generativeai") as mock:
        yield mock


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
