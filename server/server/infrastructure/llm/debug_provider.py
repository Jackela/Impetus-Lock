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
        snippet = context[max(0, cursor - 80) : cursor].strip() or "让故事更紧张。"

        # Use readable, non-debug phrasing so UI resembles real output
        if mode == "muse":
            content = f"{snippet}（继续深入这个抉择。）"
        else:
            content = f"{snippet} 试着写出意外的转折。"

        # Provide unique lock ids to avoid reusing the same debug lock
        issued = datetime.now(UTC)
        lock_id = f"lock_debug_{mode}_{int(issued.timestamp() * 1000)}"

        return InterventionResponse(
            action="provoke",
            content=content,
            lock_id=lock_id,
            anchor=AnchorPos(from_=cursor),
            action_id="act_debug",
            issued_at=issued,
            source=mode,
        )
