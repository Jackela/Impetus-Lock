"""OTLP tracing helpers."""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

trace: Any | None = None  # type: ignore[var-annotated]
Status: Any | None = None  # type: ignore[var-annotated]
StatusCode: Any | None = None  # type: ignore[var-annotated]
OTLP_ENDPOINT: str | None = None
OTLP_HEADERS: str | None = None
SERVICE_NAME: str = "impetus-lock"
_tracer: Any | None = None

try:
    from opentelemetry import trace as _trace  # type: ignore[no-redef]
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.trace import Status as _StatusImport  # type: ignore[no-redef]
    from opentelemetry.trace import StatusCode as _StatusCodeImport  # type: ignore[no-redef]

    trace = _trace  # type: ignore[no-redef]
    Status = _StatusImport  # type: ignore[no-redef]
    StatusCode = _StatusCodeImport  # type: ignore[no-redef]

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
except ImportError:  # pragma: no cover - optional dependency
    pass  # Variables remain None


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
