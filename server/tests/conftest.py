"""Pytest configuration and fixtures for test suite.

Sets up test environment with mocked OpenAI API key.
"""

import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment() -> None:
    """Set up test environment variables.

    Auto-used for all tests to ensure OPENAI_API_KEY is available.
    Uses a dummy key since actual LLM calls are mocked in tests.
    """
    os.environ["OPENAI_API_KEY"] = "test-key-for-unit-tests"
