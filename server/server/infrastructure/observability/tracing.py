"""OTLP tracing helpers."""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

# Type declarations for optional opentelemetry imports
trace: Any | None = None
Status: Any | None = None
StatusCode: Any | None = None
_tracer: Any | None = None

try:
    from opentelemetry import trace as _trace_module  # noqa: F811, I001
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.trace import Status as _Status, StatusCode as _StatusCode  # noqa: F811, I001

    trace = _trace_module
    Status = _Status
    StatusCode = _StatusCode

    assert trace is not None  # narrow type after import

    OTLP_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    OTLP_HEADERS = os.getenv("OTEL_EXPORTER_OTLP_HEADERS")
    SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "impetus-lock")

    if OTLP_ENDPOINT:
        resource = Resource.create({"service.name": SERVICE_NAME})
        provider = TracerProvider(resource=resource)
        headers = None
        if OTLP_HEADERS:
            headers = dict(item.split("=") for item in OTLP_HEADERS.split(",") if "=" in item)
        exporter = OTLPSpanExporter(endpoint=OTLP_ENDPOINT, headers=headers)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        _tracer = trace.get_tracer(__name__)
    else:
        _tracer = None
except ImportError:  # pragma: no cover - optional dependency
    trace = None
    Status = None
    StatusCode = None
    OTLP_ENDPOINT = None
    OTLP_HEADERS = None
    SERVICE_NAME = "impetus-lock"
    _tracer = None


def is_tracing_enabled() -> bool:
    return _tracer is not None


@contextmanager
def start_llm_span(name: str, attributes: dict[str, Any] | None = None) -> Iterator[None]:
    if not _tracer or not trace:
        yield
        return

    span = _tracer.start_span(name, attributes=attributes)
    try:
        with trace.use_span(span, end_on_exit=True):
            yield
    except Exception as exc:  # pragma: no cover - span records automatically
        span.record_exception(exc)
        if Status is not None and StatusCode is not None:
            span.set_status(Status(StatusCode.ERROR))
        raise
