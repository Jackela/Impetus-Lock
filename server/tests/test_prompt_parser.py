"""Property-based tests validating provider draft parsing."""

from __future__ import annotations

from typing import Literal

import pytest
from hypothesis import given
from hypothesis import strategies as st

from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft


class FakeProvider(BasePromptLLMProvider):
    """Test double that returns a pre-seeded draft."""

    def __init__(self, draft: LLMInterventionDraft):
        super().__init__(model="fake")
        self._draft = draft

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        return self._draft


def _make_draft(
    action: Literal["provoke", "rewrite", "delete"],
    content: str | None,
) -> LLMInterventionDraft:
    return LLMInterventionDraft(action=action, content=content)


@given(
    action=st.sampled_from(["provoke", "rewrite", "delete"]),
    content=st.one_of(st.none(), st.text(min_size=1, max_size=120)),
)
def test_generate_intervention_enforces_content_requirements(
    action: Literal["provoke", "rewrite", "delete"],
    content: str | None,
) -> None:
    provider = FakeProvider(_make_draft(action, content))

    requires_content = action in {"provoke", "rewrite"}
    missing_content = content is None or not content.strip()

    if requires_content and missing_content:
        with pytest.raises(ValueError):
            provider.generate_intervention(
                context="最近写作停滞。",
                mode="muse",
                selection_from=10,
            )
    else:
        response = provider.generate_intervention(
            context="最近写作停滞。",
            mode="muse",
            selection_from=5,
            selection_to=8,
        )
        assert response.action == action
        if requires_content:
            assert response.content == content
            assert response.lock_id is not None
        else:
            assert response.content is None
            assert response.lock_id is None


def test_invalid_mode_raises_value_error() -> None:
    provider = FakeProvider(_make_draft("provoke", "content"))
    with pytest.raises(ValueError):
        provider.generate_intervention(context="", mode="invalid")  # type: ignore[arg-type]
