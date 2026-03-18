"""Prometheus observability implementation."""

from __future__ import annotations

import logging
import os
from typing import Any

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

from server.domain.observability import ObservabilityPort, LLMRequestMetrics

logger = logging.getLogger("server.observability")

ENABLE_PROM_METRICS = os.getenv("ENABLE_PROMETHEUS_METRICS", "0").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

LLM_REQUEST_COUNTER: Counter | None = None
LLM_LATENCY_HIST: Histogram | None = None
INTERVENTION_COUNTER: Counter | None = None

if ENABLE_PROM_METRICS:
    LLM_REQUEST_COUNTER = Counter(
        "llm_requests_total",
        "Total number of LLM invocations",
        labelnames=("provider", "model", "success"),
    )
    LLM_LATENCY_HIST = Histogram(
        "llm_request_latency_seconds",
        "Latency of LLM invocations (seconds)",
        labelnames=("provider", "model"),
        buckets=(0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0),
    )
    INTERVENTION_COUNTER = Counter(
        "interventions_total",
        "Total number of interventions",
        labelnames=("mode", "action_type"),
    )


class PrometheusObservability(ObservabilityPort):
    """Prometheus-based observability implementation."""

    def record_llm_request(
        self, provider: str, model: str, success: bool, latency_ms: float, tokens_used: int
    ) -> None:
        """Record LLM request metrics."""
        if ENABLE_PROM_METRICS and LLM_REQUEST_COUNTER and LLM_LATENCY_HIST:
            LLM_REQUEST_COUNTER.labels(
                provider=provider, model=model, success=str(success).lower()
            ).inc()
            LLM_LATENCY_HIST.labels(provider=provider, model=model).observe(latency_ms / 1000)

    def record_intervention(self, mode: str, action_type: str) -> None:
        """Record intervention metrics."""
        if ENABLE_PROM_METRICS and INTERVENTION_COUNTER:
            INTERVENTION_COUNTER.labels(mode=mode, action_type=action_type).inc()

    def get_metrics(self) -> dict:
        """Get current metrics in Prometheus format."""
        return {"metrics": generate_latest(), "content_type": CONTENT_TYPE_LATEST}


def log_llm_call(
    *,
    provider_name: str,
    model: str | None,
    mode: str,
    duration_ms: float,
    success: bool,
    error_code: str | None = None,
) -> None:
    """Emit a structured log entry describing an LLM invocation."""

    extra: dict[str, Any] = {
        "event": "llm_call",
        "provider": provider_name,
        "model": model,
        "mode": mode,
        "duration_ms": round(duration_ms, 2),
        "success": success,
    }
    if error_code:
        extra["error_code"] = error_code

    if success:
        logger.info("llm_call", extra=extra)
    else:
        logger.warning("llm_call_failed", extra=extra)

    if ENABLE_PROM_METRICS and LLM_REQUEST_COUNTER and LLM_LATENCY_HIST:
        LLM_REQUEST_COUNTER.labels(
            provider=provider_name,
            model=model or "unknown",
            success=str(success).lower(),
        ).inc()
        LLM_LATENCY_HIST.labels(provider=provider_name, model=model or "unknown").observe(
            duration_ms / 1000
        )


def prometheus_latest() -> tuple[bytes, str]:
    """Expose current metrics payload and content-type."""

    return generate_latest(), CONTENT_TYPE_LATEST
