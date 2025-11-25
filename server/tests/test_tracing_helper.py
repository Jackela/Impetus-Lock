from __future__ import annotations

from types import TracebackType
from typing import Literal

import pytest
from _pytest.monkeypatch import MonkeyPatch

from server.infrastructure.observability import tracing


class DummyStatus:
    def __init__(self, code: str):
        self.code = code


class DummyStatusCode:
    ERROR = "error"


class FakeSpan:
    def __init__(self) -> None:
        self.record_exception_called = False
        self.set_status_value: DummyStatus | None = None

    def record_exception(self, _exc: BaseException | None = None) -> None:
        self.record_exception_called = True

    def set_status(self, status: DummyStatus) -> None:  # pragma: no cover - simple setter
        self.set_status_value = status


class FakeTracer:
    def __init__(self, span: FakeSpan) -> None:
        self.span = span

    def start_span(self, *_args: object, **_kwargs: object) -> FakeSpan:
        return self.span


class FakeTrace:
    @staticmethod
    def use_span(span: FakeSpan, end_on_exit: bool = True) -> object:  # noqa: ARG002 - API compatibility
        class _Ctx:
            def __enter__(self) -> FakeSpan:
                return span

            def __exit__(
                self,
                exc_type: type[BaseException] | None,
                exc: BaseException | None,
                tb: TracebackType | None,
            ) -> Literal[False]:
                return False  # propagate exceptions

        return _Ctx()


@pytest.fixture(autouse=True)
def reset_tracer(monkeypatch: MonkeyPatch) -> FakeSpan:
    span = FakeSpan()
    monkeypatch.setattr(tracing, "_tracer", FakeTracer(span))
    monkeypatch.setattr(tracing, "trace", FakeTrace())
    monkeypatch.setattr(tracing, "Status", DummyStatus)
    monkeypatch.setattr(tracing, "StatusCode", DummyStatusCode)
    return span


def test_start_llm_span_sets_error_status_on_exception(reset_tracer: FakeSpan) -> None:
    span = reset_tracer

    with pytest.raises(RuntimeError), tracing.start_llm_span("llm.call"):
        raise RuntimeError("boom")

    assert span.record_exception_called is True
    assert isinstance(span.set_status_value, DummyStatus)
    assert span.set_status_value.code == DummyStatusCode.ERROR
