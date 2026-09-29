"""Public error and retry contracts of the shared LLM provider helpers."""

import pytest

from server.domain.errors import LLMProviderError
from server.infrastructure.llm.base_provider import LLMErrorHandlerMixin, RetryMixin


@pytest.mark.parametrize(
    ("error", "code", "status"),
    [
        (RuntimeError("rate limit 429"), "quota_exceeded", 402),
        (RuntimeError("invalid API key 401"), "invalid_api_key", 401),
        (ConnectionError("unreachable"), "llm_network_error", 502),
        (ValueError("malformed response"), "llm_api_error", 502),
    ],
)
def test_error_handler_preserves_public_error_contract(
    error: Exception, code: str, status: int
) -> None:
    """Provider failures expose stable API codes, status and original causes."""
    with pytest.raises(LLMProviderError) as raised:
        LLMErrorHandlerMixin().handle_llm_error(error, "test-provider")
    assert raised.value.code == code
    assert raised.value.status_code == status
    assert raised.value.provider == "test-provider"
    assert raised.value.__cause__ is error


def test_error_handler_allows_only_remaining_transient_retries() -> None:
    """A transient error is retryable until the supplied retry budget is exhausted."""
    error = ConnectionError("temporary outage")
    handler = LLMErrorHandlerMixin()
    assert handler.handle_llm_error(error, "test-provider", max_retries=1) == (True, error)
    with pytest.raises(LLMProviderError) as raised:
        handler.handle_llm_error(error, "test-provider", max_retries=1, current_attempt=1)
    assert raised.value.code == "llm_network_error"


def test_retry_returns_recovered_result_with_exponential_backoff(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Transient outages use 1s/2s delays and return the successful operation result."""
    delays: list[float] = []
    monkeypatch.setattr("time.sleep", delays.append)
    attempts = 0

    def operation() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ConnectionError("temporary outage")
        return "recovered response"

    assert RetryMixin().execute_with_retry(operation) == "recovered response"
    assert delays == [1.0, 2.0]
    assert attempts == 3


@pytest.mark.parametrize(
    ("error", "expected_attempts"),
    [(ConnectionError("still offline"), 2), (ValueError("invalid request"), 1)],
)
def test_retry_stops_at_budget_or_nonretryable_error(
    monkeypatch: pytest.MonkeyPatch, error: Exception, expected_attempts: int
) -> None:
    """Exhausted retries and permanent failures propagate the original exception."""
    delays: list[float] = []
    monkeypatch.setattr("time.sleep", delays.append)
    attempts = 0

    def operation() -> str:
        nonlocal attempts
        attempts += 1
        raise error

    with pytest.raises(type(error)) as raised:
        RetryMixin().execute_with_retry(operation, max_retries=1, backoff_factor=0.25)
    assert raised.value is error
    assert attempts == expected_attempts
    assert delays == ([0.25] if expected_attempts == 2 else [])
