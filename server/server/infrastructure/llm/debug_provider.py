"""Deterministic debug provider used for tests and demos."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import InterventionResponse


class DebugLLMProvider(LLMProvider):
    """Simple provider that returns deterministic responses without external calls."""

    provider_name = "debug"

    def __init__(self, *, mode: Literal["provoke", "rewrite"] = "provoke") -> None:
        self.mode = mode

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        cursor = selection_to or selection_from or len(context)
        snippet = context[max(0, cursor - 40) : cursor] or "继续写下去。"

        content = f"[debug:{mode}] {snippet}" if snippet else "[debug] 写点新东西。"

        return InterventionResponse(
            action="provoke",
            content=content,
            lock_id="lock_debug",
            anchor=AnchorPos(from_=cursor),
            action_id="act_debug",
            issued_at=datetime.now(UTC),
            source=mode,
        )
