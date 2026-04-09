"""Unit tests for GeminiLLMProvider.

This package contains focused test modules for the Gemini LLM provider:
- test_initialization.py: Provider initialization and configuration
- test_muse_mode.py: Muse mode intervention generation
- test_loki_mode.py: Loki mode intervention generation
- test_error_handling.py: Error handling and exception mapping
- test_streaming.py: Streaming intervention generation
- test_token_counting.py: Token counting and usage tracking
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, Mock, patch

import pytest

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

if TYPE_CHECKING:
    from collections.abc import Generator


@pytest.fixture
def mock_genai() -> Generator[Mock, None, None]:
    """Mock the google.generativeai module."""
    with patch("server.infrastructure.llm.gemini_provider.genai") as mock:
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
    """Create a provider instance with mocked model."""
    mock_model_instance = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model_instance
    return GeminiLLMProvider(api_key="test-key")
