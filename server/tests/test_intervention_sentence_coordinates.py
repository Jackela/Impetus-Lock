"""Regress sentence anchors in the UTF-16 coordinate system used by ProseMirror."""

from unittest.mock import Mock

import pytest

from server.application.services.intervention_service import InterventionService
from server.domain.models.anchor import AnchorRange
from server.domain.models.intervention import ClientMeta, InterventionRequest, InterventionResponse
from server.domain.text_window import compute_last_sentence_anchor
from server.infrastructure.llm.base_provider import BasePromptLLMProvider, LLMInterventionDraft


def utf16_units(text: str) -> int:
    """Count native editor units without confusing astral characters with one position."""
    return len(text.encode("utf-16-le")) // 2


@pytest.mark.parametrize(
    ("context", "sentence"),
    [
        ("前一句已经结束。她捡起写着名字的纸船🛶。", "她捡起写着名字的纸船🛶。"),
        ("前一句已经结束。停。", "停。"),
        ("前一句已经结束。她却突然停下  ", "她却突然停下  "),
        ("第一段已经结束。\n她🧭还没决定往哪走", "她🧭还没决定往哪走"),
        ("前一句已经结束。“你真的要打开门吗？”", "“你真的要打开门吗？”"),
        ("前一句已经结束。她惊呼：怎么会这样？！", "她惊呼：怎么会这样？！"),
    ],
)
def test_rewrite_targets_exact_sentence_in_pm_units(context: str, sentence: str) -> None:
    """Service anchors select the actual cursor tail rather than adjacent writing."""
    # A paragraph text node begins at PM position 1. Astral symbols occupy two
    # positions; Python code-point length is not a document coordinate.
    cursor = 1 + utf16_units(context)
    provider = Mock()
    provider.generate_intervention.return_value = InterventionResponse(
        action="rewrite",
        content="她把纸船藏进衣袖。",
        lock_id="lock_coordinate",
        anchor=AnchorRange(from_=0, to=1),
        action_id="act_coordinate",
        source="muse",
    )
    service = InterventionService(llm_provider=provider)
    request = InterventionRequest(
        context=context,
        mode="muse",
        client_meta=ClientMeta(doc_version=3, selection_from=cursor, selection_to=cursor),
    )

    response = service.generate_intervention(request)

    assert response.anchor.type == "range"
    assert response.anchor.from_ == cursor - utf16_units(sentence)
    assert response.anchor.to == cursor
    encoded = context.encode("utf-16-le")
    selected = encoded[(response.anchor.from_ - 1) * 2 : (response.anchor.to - 1) * 2]
    assert selected.decode("utf-16-le") == sentence
    provider.generate_intervention.assert_called_once()


def test_bounded_anchor_does_not_cut_astral_symbol() -> None:
    """The maximum rewrite window must not split a UTF-16 surrogate pair."""
    assert compute_last_sentence_anchor(404, "🛶" * 201, max_length=399) == (6, 404)


def test_empty_context_keeps_existing_fallback() -> None:
    """Absent text retains the existing bounded empty-window fallback."""
    assert compute_last_sentence_anchor(5, "") == (0, 5)


def test_loki_delete_targets_context_tail_through_provider_and_service() -> None:
    """A real provider draft deletes the recent sentence, not a fixed 120-position span."""

    class OfflineDeleteProvider(BasePromptLLMProvider):
        def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
            assert "Delete" in system_prompt or "DELETE" in system_prompt
            assert "她把纸船" in user_message
            return LLMInterventionDraft(action="delete")

    context = "她已经在河边等了整整一夜，没有等到答应接她的人。" * 3 + "她把纸船🛶推回水里。"
    sentence = "她把纸船🛶推回水里。"
    cursor = 300 + utf16_units(context)
    service = InterventionService(llm_provider=OfflineDeleteProvider(model="offline"))
    response = service.generate_intervention(
        InterventionRequest(
            context=context,
            mode="loki",
            client_meta=ClientMeta(doc_version=8, selection_from=cursor, selection_to=cursor),
        )
    )
    assert response.action == "delete"
    assert response.content is None and response.lock_id is None
    assert response.anchor.type == "range"
    assert (response.anchor.from_, response.anchor.to) == (cursor - utf16_units(sentence), cursor)
