"""Minimal JSON logging helpers for the FastAPI backend."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any


class JsonFormatter(logging.Formatter):
    """Serialize log records as structured JSON.

    Only whitelisted attributes from the LogRecord are emitted alongside any
    ``extra`` fields set via ``logger.info(..., extra={...})``.
    """

    DEFAULT_FIELDS = {
        "timestamp",
        "level",
        "logger",
        "message",
    }

    def __init__(self, *, default_fields: set[str] | None = None) -> None:
        super().__init__()
        self._base_fields = default_fields or self.DEFAULT_FIELDS

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003 (formatter API)
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include user-supplied extras while avoiding private attrs
        for key, value in record.__dict__.items():
            if key in payload or key.startswith("_"):
                continue
            if key in {"args", "msg", "exc_info", "exc_text", "stack_info"}:
                continue
            payload[key] = value

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, default=str, ensure_ascii=False)


def setup_json_logging(level: str = "INFO") -> None:
    """Configure root logger with the JSON formatter if not already set."""

    root = logging.getLogger()
    if any(isinstance(handler.formatter, JsonFormatter) for handler in root.handlers):
        root.setLevel(level)
        return

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.handlers = [handler]
    root.setLevel(level)
