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
