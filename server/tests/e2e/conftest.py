"""End-to-end test fixtures for full application testing.

Provides fixtures for E2E tests including full app lifecycle management,
browser automation, and production-like environment setup.

Note: This file is a placeholder. Add E2E fixtures when e2e tests are implemented.

Constitutional Compliance:
- Article V (Documentation): Document E2E test requirements
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import Mock, patch

import pytest

if TYPE_CHECKING:
    pass


# Mark all tests in this directory as e2e
pytestmark = pytest.mark.e2e


@pytest.fixture(scope="session")
def e2e_test_enabled(pytestconfig: Any) -> bool:
    """Check if E2E tests are enabled.

    Args:
        pytestconfig: Pytest configuration.

    Returns:
        True if --e2e flag is set.
    """
    return pytestconfig.getoption("--e2e", default=False)


@pytest.fixture(scope="session")
def e2e_base_url() -> str:
    """Provide base URL for E2E tests.

    Returns:
        Base URL for the application under test.
    """
    import os

    return os.getenv("E2E_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def playwright_enabled() -> bool:
    """Check if Playwright is available.

    Returns:
        True if playwright is installed.
    """
    try:
        import playwright  # noqa: F401

        return True
    except ImportError:
        return False


@pytest.fixture
def mock_production_services() -> Mock:
    """Mock external services for isolated E2E testing.

    Returns:
        Mock object for external service dependencies.
    """
    mock = Mock()
    mock.llm_response = Mock(return_value={"action": "provoke", "content": "Test content"})
    mock.email_service = Mock(return_value=True)
    mock.notification_service = Mock(return_value=True)
    return mock


# Browser fixtures (commented out - uncomment when implementing E2E tests with Playwright)
#
# @pytest.fixture(scope="session")
# async def browser(playwright_enabled: bool) -> AsyncGenerator[Browser, None]:
#     """Provide Playwright browser instance."""
#     if not playwright_enabled:
#         pytest.skip("Playwright not installed")
#
#     from playwright.async_api import async_playwright
#
#     async with async_playwright() as p:
#         browser = await p.chromium.launch()
#         yield browser
#         await browser.close()
#
# @pytest.fixture
# async def page(browser: Browser) -> AsyncGenerator[Page, None]:
#     """Provide Playwright page instance."""
#     page = await browser.new_page()
#     yield page
#     await page.close()


# App lifecycle fixtures


@pytest.fixture(scope="session")
def app_settings() -> dict[str, Any]:
    """Provide E2E test application settings.

    Returns:
        Dictionary with application settings.
    """
    return {
        "debug": False,
        "testing": True,
        "log_level": "INFO",
        "enable_metrics": True,
        "rate_limit_enabled": False,  # Disable for E2E tests
    }


@pytest.fixture
def production_like_env(monkeypatch: Any) -> None:
    """Set up production-like environment variables.

    Args:
        monkeypatch: Pytest monkeypatch fixture.
    """
    monkeypatch.setenv("TESTING", "1")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    monkeypatch.setenv("ENABLE_METRICS", "true")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
