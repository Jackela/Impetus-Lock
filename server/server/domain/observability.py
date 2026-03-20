"""Domain layer observability abstractions (Clean Architecture)."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, runtime_checkable


@runtime_checkable
class ObservabilityPort(Protocol):
    """Observability port for domain layer."""

    def record_llm_request(
        self, provider: str, model: str, success: bool, latency_ms: float, tokens_used: int
    ) -> None:
        """Record LLM request metrics."""
        ...

    def record_intervention(self, mode: str, action_type: str) -> None:
        """Record intervention metrics."""
        ...

    def get_metrics(self) -> dict:
        """Get current metrics."""
        ...


@dataclass
class LLMRequestMetrics:
    """LLM request metrics data."""

    provider: str
    model: str
    success: bool
    latency_ms: float
    tokens_used: int
    timestamp: datetime
