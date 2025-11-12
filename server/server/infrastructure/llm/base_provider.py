"""Shared JSON-prompted LLM provider helpers."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import InterventionResponse
from server.infrastructure.llm.prompts.loki_prompt import get_loki_prompts
from server.infrastructure.llm.prompts.muse_prompt import get_muse_prompts


class LLMInterventionDraft(BaseModel):
    """Minimal schema returned directly by the LLM before backend post-processing."""

    action: Literal["provoke", "delete", "rewrite"]
    content: str | None = None


class BasePromptLLMProvider(LLMProvider, ABC):
    """Base class implementing shared intervention -> response plumbing."""

    provider_name: str = "generic"

    def __init__(self, *, model: str, temperature: float = 0.9) -> None:
        self.model = model
        self.temperature = temperature

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        if not context:
            raise ValueError("Context cannot be empty")
        if mode not in {"muse", "loki"}:
            raise ValueError(f"Invalid mode: {mode}")

        if mode == "muse":
            system_prompt, user_message = get_muse_prompts(context)
        else:
            system_prompt, user_message = get_loki_prompts(context)

        draft = self._complete(system_prompt, user_message)

        cursor_pos = selection_to or selection_from or 0
        cursor_pos = max(0, cursor_pos)

        if draft.action == "provoke":
            anchor: AnchorPos | AnchorRange = AnchorPos(from_=cursor_pos)
        else:
            anchor = AnchorRange(from_=max(0, cursor_pos - 120), to=cursor_pos)

        lock_id = None
        content = draft.content

        if draft.action in {"provoke", "rewrite"}:
            if not content:
                raise ValueError("LLM returned mutate action without content")
            lock_id = f"lock_{uuid.uuid4()}"

        return InterventionResponse(
            action=draft.action,
            content=content if draft.action in {"provoke", "rewrite"} else None,
            lock_id=lock_id,
            anchor=anchor,
            action_id=f"act_{uuid.uuid4()}",
            source=mode,
        )

    @abstractmethod
    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        """Subclasses call their provider SDK and return a validated draft."""

