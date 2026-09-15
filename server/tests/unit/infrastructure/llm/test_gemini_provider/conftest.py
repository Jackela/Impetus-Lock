"""Pytest configuration for Gemini provider tests.

Fixtures defined here are shared across all test modules in this package.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

if TYPE_CHECKING:
    pass

# Check if google.genai is available
try:
    import google.genai as _genai  # noqa: F401

    _GENAI_AVAILABLE = True
except ImportError:
    _GENAI_AVAILABLE = False

from server.infrastructure.llm.gemini_provider import GeminiLLMProvider

DEFAULT_RESPONSE_TEXT = '{"action": "provoke", "content": "Test intervention content"}'


def make_generate_response(text: str = DEFAULT_RESPONSE_TEXT) -> MagicMock:
    """Create a mock google-genai response with one successful text part."""
    part = MagicMock()
    part.text = text

    content = MagicMock()
    content.parts = [part]

    candidate = MagicMock()
    candidate.content = content
    candidate.finish_reason = None

    response = MagicMock()
    response.candidates = [candidate]
    response.prompt_feedback = MagicMock()
    response.prompt_feedback.block_reason = None
    return response


def make_blocked_prompt_response() -> MagicMock:
    """Create a mock response whose prompt was blocked before generation."""
    response = MagicMock()
    response.candidates = []
    response.prompt_feedback = MagicMock()
    response.prompt_feedback.block_reason = "SAFETY"
    return response


def make_stopped_candidate_response() -> MagicMock:
    """Create a mock response whose candidate was stopped by safety filters."""
    from google.genai.types import FinishReason

    candidate = MagicMock()
    candidate.content = MagicMock()
    candidate.content.parts = []
    candidate.finish_reason = FinishReason.SAFETY

    response = MagicMock()
    response.candidates = [candidate]
    response.prompt_feedback = MagicMock()
    response.prompt_feedback.block_reason = None
    return response


@pytest.fixture
def mock_response() -> MagicMock:
    """Create a mock Gemini response with successful completion."""
    return make_generate_response()


@pytest.fixture
def provider() -> GeminiLLMProvider:
    """Create a GeminiLLMProvider with stubbed SDK clients (no outbound call)."""
    if not _GENAI_AVAILABLE:
        pytest.skip("google.genai not installed")
    instance = GeminiLLMProvider(
        api_key="test-api-key",
        model="gemini-pro",
    )
    instance._client = MagicMock()
    instance._tokens_client = MagicMock()
    return instance
