"""Deterministic debug provider used for tests and demos."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import InterventionResponse


class DebugLLMProvider(LLMProvider):
    """Simple provider that returns deterministic responses without external calls."""

    provider_name = "debug"

    def __init__(self, *, mode: Literal["provoke", "rewrite"] = "provoke") -> None:
        """Initialize the deterministic provider with its configured action mode."""
        self.mode = mode

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        """Generate a deterministic provoke response for the requested agent mode.

        Args:
            context: Writing context used to derive the intervention content.
            mode: Agent mode responsible for the intervention.
            doc_version: Optional client document version, retained for provider compatibility.
            selection_from: Optional selection start position.
            selection_to: Optional selection end position.

        Returns:
            A structured provoke response with a unique lock identifier.
        """
        cursor = selection_to or selection_from or len(context)
        snippet = context[max(0, cursor - 80) : cursor].strip() or "让故事更紧张。"

        # Use readable, non-debug phrasing so UI resembles real output
        if mode == "muse":
            content = f"{snippet}（继续深入这个抉择。）"
        else:
            content = f"{snippet} 试着写出意外的转折。"

        # Keep the readable prefix while ensuring uniqueness independent of the clock.
        issued = datetime.now(UTC)
        lock_id = f"lock_debug_{mode}_{uuid4().hex}"

        return InterventionResponse(
            action="provoke",
            content=content,
            lock_id=lock_id,
            anchor=AnchorPos(from_=cursor),
            action_id="act_debug",
            issued_at=issued,
            source=mode,
        )
