"""Exercise the WeChat story model at its provider HTTP boundary."""

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

from server.infrastructure.llm import story_writer


@pytest.fixture
def mock_completion(monkeypatch: pytest.MonkeyPatch) -> Callable[[httpx.MockTransport], None]:
    """Route requests through a test transport with local dummy configuration."""
    monkeypatch.setenv("WECHAT_STORY_BASE_URL", "https://story.example/compatible-mode/v1/")
    monkeypatch.setenv("WECHAT_STORY_MODEL", "chinese-fiction")
    monkeypatch.setenv("WECHAT_STORY_API_KEY", "test-story-token")
    async_client = httpx.AsyncClient

    def install(transport: httpx.MockTransport) -> None:
        def client(**kwargs: Any) -> httpx.AsyncClient:
            return async_client(transport=transport, **kwargs)

        monkeypatch.setattr(httpx, "AsyncClient", client)

    return install


def completion(content: dict[str, Any] | str, finish_reason: str = "stop") -> httpx.Response:
    """Build a provider completion containing the specified content."""
    return httpx.Response(
        200,
        json={
            "choices": [
                {
                    "finish_reason": finish_reason,
                    "message": {
                        "role": "assistant",
                        "content": json.dumps(content, ensure_ascii=False)
                        if isinstance(content, dict)
                        else content,
                    },
                }
            ]
        },
    )


async def test_first_choice_generates_from_the_edited_opening(
    mock_completion: Callable[[httpx.MockTransport], None],
) -> None:
    """Even the opening action uses the configured provider and current opening."""
    opening = "搬家那天，我收到一封自己寄出的信。"
    action = "把信封翻过来，找寄件地址"
    candidate = {
        "paragraph": "我把信封翻过来，沿背面的胶缝找了一圈，没有看见寄件地址。",
        "choices": ["把信烧掉", "把信留下"],
        "lock_sentence": "邮戳上的日期却是明天。",
        "facts": ["我尚未拆信。"],
        "consequence": None,
        "eligible": [],
    }

    def respond(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url == "https://story.example/compatible-mode/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-story-token"
        payload = json.loads(request.content)
        assert payload["model"] == "chinese-fiction"
        assert payload["response_format"] == {"type": "json_object"}
        messages = payload["messages"]
        assert [message["role"] for message in messages] == ["system", "user"]
        context = json.loads(messages[1]["content"])
        assert context["opening"] == opening
        assert context["source"] == "choice"
        assert context["text"] == action
        assert "十年后" not in messages[1]["content"]
        assert "recoveries" not in context
        return completion(candidate)

    mock_completion(httpx.MockTransport(respond))
    state = {
        "opening": "十年后，你收到一封自己寄出的信",
        "segments": [{"id": "opening", "text": opening, "source": "opening", "locked": False}],
        "theme": "letter",
        "mode": "normal",
        "turns": 0,
        "letter_state": "unopened",
        "recoveries": [{"segment": {"text": "不可恢复的原段"}}],
    }

    assert await story_writer.generate_turn(state, "choice", action) == candidate


@pytest.mark.parametrize(
    ("style", "instruction", "result"),
    [
        ("voice", "保留口吻", "我认识那只鸟……不，不可能。女儿说她也见过。"),
        ("polish", "轻度书面化", "我认得那只鸟……不，不可能。女儿说她也见过。"),
    ],
)
async def test_voice_correction_sends_only_the_current_transcript(
    mock_completion: Callable[[httpx.MockTransport], None],
    style: str,
    instruction: str,
    result: str,
) -> None:
    """Correction uses the selected treatment and submits no other draft data."""
    transcript = "我、我认识那只鸟……不，不可能。女儿说她也见过"

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        assert json.loads(messages[1]["content"]) == {"text": transcript, "style": style}
        assert instruction in messages[0]["content"]
        assert "有意重复" in messages[0]["content"]
        assert "人物关系" in messages[0]["content"]
        return completion({"text": result})

    mock_completion(httpx.MockTransport(respond))
    assert await story_writer.correct_voice(transcript, style) == result


async def test_verbatim_preserves_the_transcript_without_model_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The original transcription is returned without any model request."""
    monkeypatch.delenv("WECHAT_STORY_API_KEY", raising=False)
    transcript = " 我、我看到她……不，不是。\n别动。"
    assert await story_writer.correct_voice(transcript, "verbatim") == transcript


async def test_lock_replacement_only_proposes_a_fact_compatible_sentence(
    mock_completion: Callable[[httpx.MockTransport], None],
) -> None:
    """A lock preview cannot erase the consequences of an earlier decision."""
    original = "邮戳上的日期却是明天。"
    replacement = "窗玻璃反着光，我把模糊的邮戳看成了明天。"
    state = {
        "theme": "letter",
        "mode": "high",
        "letter_state": "burned",
        "facts": ["我把未拆的信烧掉了。"],
        "recoveries": [{"segment": {"text": "不可恢复的原段"}}],
    }

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert context["target"] == original
        assert context["letter_state"] == "burned"
        assert context["facts"] == ["我把未拆的信烧掉了。"]
        assert "recoveries" not in context
        assert "已发生" in messages[0]["content"]
        return completion({"text": replacement})

    mock_completion(httpx.MockTransport(respond))
    assert await story_writer.propose_lock_replacement(state, original) == replacement


async def test_custom_rewrite_proposes_only_the_target_passage(
    mock_completion: Callable[[httpx.MockTransport], None],
) -> None:
    """A custom rule candidate can rewrite a paragraph without returning actions."""
    original = "我慢慢把风筝递给女儿。她松开风筝线。"
    revised = "我把风筝递过去。女儿接过竹骨，挨着线轴松开了手。"

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        assert json.loads(messages[1]["content"])["target"] == original
        assert "未锁正文" in messages[0]["content"]
        return completion({"text": revised})

    mock_completion(httpx.MockTransport(respond))
    assert await story_writer.propose_rewrite({"theme": "letter", "mode": "custom"}, original) == (
        revised
    )


@pytest.mark.parametrize("repeats_anchor", [False, True])
async def test_custom_insert_proposes_new_text_after_the_anchor(
    mock_completion: Callable[[httpx.MockTransport], None], repeats_anchor: bool
) -> None:
    """The preview adds to the anchor without replacing or echoing it."""
    anchor = "我将油灯挪到了窗下。"
    new_line = "灯火映出窗棂上一道细得几乎看不见的刀痕。"
    state = {"theme": "detective", "mode": "custom", "facts": ["我还没推开窗。"]}

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert context["anchor"] == anchor
        assert context["facts"] == ["我还没推开窗。"]
        assert "接在锚点之后" in messages[0]["content"]
        return completion({"text": anchor + new_line if repeats_anchor else new_line})

    mock_completion(httpx.MockTransport(respond))
    if repeats_anchor:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.propose_insert(state, anchor)
    else:
        assert await story_writer.propose_insert(state, anchor) == new_line


@pytest.mark.parametrize(
    ("trigger", "responding", "pending", "expected"),
    [
        ("automatic", False, False, True),
        ("automatic", True, False, False),
        ("response", True, False, True),
        ("response", False, False, False),
        ("response", False, True, True),
        ("manual", False, True, False),
    ],
)
async def test_custom_rule_requests_only_an_eligible_current_candidate(
    mock_completion: Callable[[httpx.MockTransport], None],
    trigger: str,
    responding: bool,
    pending: bool,
    expected: bool,
) -> None:
    """A due rule allows only current unlocked targets and the configured action."""
    candidate = {
        "paragraph": "",
        "choices": ["去问书吏", "走出县衙"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
    }
    if expected:
        candidate["intervention"] = {
            "action": "rewrite",
            "target": "s1",
            "text": "我在灯下看见旧泥印。",
        }

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert "已删除秘稿" not in messages[1]["content"]
        if expected:
            assert context["intervention_request"] == {"action": "rewrite", "targets": ["s1"]}
            assert context["recent_segments"] == [
                {"id": "s1", "text": "灯下有一处旧泥印。", "locked": False},
                {"text": "昨夜无人值守。", "locked": True},
            ]
            assert "不补回已删除的文字" in messages[0]["content"]
        else:
            assert "intervention_request" not in context
            assert "输出 intervention" not in messages[0]["content"]
        return completion(candidate)

    mock_completion(httpx.MockTransport(respond))
    state = {
        "theme": "detective",
        "mode": "custom",
        "turns": 2,
        "rules": {"trigger": trigger, "action": "rewrite", "lock": False, "recoverable": False},
        "waiting_response": responding,
        "pending_intervention": pending,
        "segments": [
            {"id": "opening", "text": "县衙已经备好结案书。", "source": "opening", "locked": False},
            {"id": "s1", "text": "灯下有一处旧泥印。", "source": "keyboard", "locked": False},
            {"id": "s2", "text": "昨夜无人值守。", "source": "lock", "locked": True},
        ],
        "recoveries": [{"segment": {"id": "s9", "text": "已删除秘稿"}}],
    }
    assert await story_writer.generate_turn(state, "keyboard", "我推开一扇窗。") == candidate


@pytest.mark.parametrize(
    ("mode", "action", "target", "replacement"),
    [
        ("normal", "rewrite", "s1", "我从院里绕进县衙。"),
        ("custom", "rewrite", "opening", "我从院里绕进县衙。"),
        ("custom", "rewrite", "s2", "我从院里绕进县衙。"),
        ("custom", "rewrite", "s9", "我从院里绕进县衙。"),
        ("custom", "delete", "s1", None),
        ("custom", "rewrite", "s1", None),
        ("custom", "rewrite", "s1", "我走了进去。"),
    ],
)
async def test_custom_candidate_cannot_change_action_or_touch_other_targets(
    mock_completion: Callable[[httpx.MockTransport], None],
    mode: str,
    action: str,
    target: str,
    replacement: str | None,
) -> None:
    """A provider cannot invent an action, bypass a lock or reference deleted text."""
    candidate = {
        "paragraph": "",
        "choices": ["去问书吏", "走出县衙"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
        "intervention": {"action": action, "target": target, "text": replacement},
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    state = {
        "theme": "detective",
        "mode": mode,
        "rules": {"trigger": "automatic", "action": "rewrite", "lock": False, "recoverable": False},
        "turns": 2,
        "segments": [
            {"id": "s1", "text": "我走了进去。", "source": "keyboard", "locked": False},
            {"id": "s2", "text": "昨夜无人值守。", "source": "lock", "locked": True},
        ],
    }
    with pytest.raises(story_writer.StoryModelError, match="格式有误"):
        await story_writer.generate_turn(state, "keyboard", "我推开一扇窗。")


@pytest.mark.parametrize(
    ("action", "target", "text", "allowed"),
    [
        ("insert", None, "灯影照出了窗棂上的划痕。", True),
        ("delete", "s1", None, True),
        ("delete", "s1", "这行文字已删除。", False),
    ],
)
async def test_insert_and_delete_return_only_the_action_specific_fields(
    mock_completion: Callable[[httpx.MockTransport], None],
    action: str,
    target: str | None,
    text: str | None,
    allowed: bool,
) -> None:
    """The rules accept insertion with no anchor or deletion with no narrative text."""
    candidate = {
        "paragraph": "",
        "choices": ["去问书吏", "走出县衙"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
        "intervention": {"action": action, "target": target, "text": text},
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    state = {
        "theme": "detective",
        "mode": "custom",
        "rules": {"trigger": "automatic", "action": action, "lock": False, "recoverable": False},
        "turns": 0 if action == "insert" else 1,
        "segments": []
        if action == "insert"
        else [{"id": "s1", "source": "keyboard", "text": "我走了进去。", "locked": False}],
    }
    if allowed:
        assert await story_writer.generate_turn(state, "keyboard", "我推开一扇窗。") == candidate
    else:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.generate_turn(state, "keyboard", "我推开一扇窗。")


@pytest.mark.parametrize("source", ["keyboard", "voice"])
async def test_detective_free_write_keeps_the_players_paragraph_separate(
    mock_completion: Callable[[httpx.MockTransport], None], source: str
) -> None:
    """The second theme adapts to free writing with no repeated player passage."""
    player_text = "我请书吏先去院中等候，自己翻开了册子。"
    opening = "清明日，案头摆好了一份结案书。"
    secured_text = "昨日值夜的是陈书吏。"
    candidate = {
        "paragraph": "",
        "choices": ["查看结案书的落款", "到门外询问值夜人"],
        "lock_sentence": "落款上的辰时比死者被见到的时刻还早。",
        "facts": ["我亲手翻开了册子。"],
        "consequence": None,
        "eligible": ["returning", "interpret"],
        "interpretation_options": ["落款沿用了上一份呈文的时辰"],
        "letter_action": None,
    }

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert "古风探案" in messages[0]["content"]
        assert "结案书" in messages[0]["content"]
        assert "独立来源" in messages[0]["content"]
        assert context["theme"] == "detective"
        assert context["opening"] == opening
        assert context["source"] == source
        assert context["text"] == player_text
        assert context["recent_segments"] == [{"text": secured_text, "locked": True}]
        assert context["abilities"]["returning"] == {"level": 2, "enabled": True}
        assert context["interpretation"] == "结案书可能早已起草"
        assert "原始识别" not in messages[1]["content"]
        return completion(candidate)

    mock_completion(httpx.MockTransport(respond))
    state = {
        "theme": "detective",
        "mode": "normal",
        "segments": [
            {"id": "opening", "source": "opening", "text": opening, "locked": False},
            {
                "id": "lock",
                "source": "intervention",
                "text": secured_text,
                "locked": True,
                "original": "原始识别",
            },
        ],
        "abilities": {"returning": {"level": 2, "enabled": True}},
        "interpretation": "结案书可能早已起草",
    }
    assert await story_writer.generate_turn(state, source, player_text) == candidate


@pytest.mark.parametrize("extra_fields", [{}, {"lock_sentence": "窗下忽然响起一声咳嗽。"}])
async def test_finishing_choice_only_writes_the_confirmed_passage(
    mock_completion: Callable[[httpx.MockTransport], None], extra_fields: dict[str, str]
) -> None:
    """The finishing context does not solicit further choices or interventions."""
    action = "把线轴交给女儿"
    paragraph = "我把线轴交过去。她握紧了，风筝终于越过树梢。"

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert context["text"] == action
        assert context["letter_state"] == "burned"
        assert context["facts"] == ["那封信已经烧掉了。"]
        assert {"abilities", "rules", "intervention_request"}.isdisjoint(context)
        assert "唯一字段 paragraph" in messages[0]["content"]
        return completion({"paragraph": paragraph, **extra_fields})

    mock_completion(httpx.MockTransport(respond))
    state = {
        "theme": "letter",
        "mode": "custom",
        "finishing": True,
        "turns": 2,
        "abilities": {"returning": {"level": 2, "enabled": True}},
        "rules": {"trigger": "automatic", "action": "rewrite"},
        "pending_intervention": True,
        "letter_state": "burned",
        "facts": ["那封信已经烧掉了。"],
    }
    if extra_fields:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.generate_turn(state, "choice", action)
    else:
        assert await story_writer.generate_turn(state, "choice", action) == {
            "paragraph": paragraph,
            "choices": [],
        }


async def test_finishing_keyboard_text_needs_no_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """The caller owns the final author's passage, even without a configured model."""
    monkeypatch.delenv("WECHAT_STORY_API_KEY", raising=False)
    assert await story_writer.generate_turn(
        {"status": "finishing"}, "keyboard", "我把线轴交给女儿。"
    ) == {"paragraph": "", "choices": []}


@pytest.mark.parametrize(
    ("selected", "action", "paragraph", "evidence", "valid"),
    [
        ("把信烧掉", "burn", "我看着原信烧成了灰。", "原信烧成了灰", True),
        ("把信留下", "keep", "我正要把原信收进抽屉。", "把原信收进抽屉", False),
        ("把信留下", "keep", "我把原信放回抽屉。", "把原信放回抽屉", True),
        ("拆开原信", "read", "我拆开原信，摊平信纸。", "我拆开原信", True),
        ("核对原信的邮戳", "check", "我仔细核对了原信上的邮戳。", "核对了原信上的邮戳", True),
        ("把信烧掉", None, "我看着原信烧成了灰。", None, False),
        ("把信烧掉", "keep", "我把原信放回抽屉。", "把原信放回抽屉", False),
        ("把信烧掉", "burn", "我吹灭了火，把原信放回抽屉。", "我吹灭了火", False),
        ("把信烧掉", "burn", "我准备烧毁原信，女儿吹灭火。", "烧毁原信", False),
        ("把信烧掉", "burn", "我看着火光。", "原信烧成了灰", False),
    ],
)
async def test_fixed_letter_choice_requires_evidence_of_the_selected_action(
    mock_completion: Callable[[httpx.MockTransport], None],
    selected: str,
    action: str | None,
    paragraph: str,
    evidence: str | None,
    valid: bool,
) -> None:
    """A fixed choice must be marked and enacted in the actual prose."""
    candidate = {
        "paragraph": paragraph,
        "choices": ["去包子铺", "去公园"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
        "letter_action": action,
        "letter_action_evidence": evidence,
        "choice_context": [
            {"requires_original": False, "follows_letter": False},
            {"requires_original": False, "follows_letter": False},
        ],
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    state = {"theme": "letter", "mode": "normal", "letter_state": "unopened"}
    if valid:
        assert await story_writer.generate_turn(state, "choice", selected) == candidate
    else:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.generate_turn(state, "choice", selected)


@pytest.mark.parametrize(
    ("closed", "selected", "thread", "flags", "valid"),
    [
        (False, "去买早饭", None, None, False),
        (False, "去买早饭", None, {"requires_original": True, "follows_letter": True}, False),
        (False, "去买早饭", None, {"requires_original": False, "follows_letter": True}, True),
        (
            False,
            "不查信了，陪她放风筝",
            None,
            {"requires_original": False, "follows_letter": True},
            False,
        ),
        (True, "去买早饭", None, {"requires_original": False, "follows_letter": True}, False),
        (
            True,
            "再问起信从哪来",
            "revisit",
            {"requires_original": False, "follows_letter": True},
            True,
        ),
        (
            True,
            "再问起信从哪来",
            "revisit",
            {"requires_original": True, "follows_letter": True},
            False,
        ),
    ],
)
async def test_continuation_respects_lost_original_and_explicit_change_of_subject(
    mock_completion: Callable[[httpx.MockTransport], None],
    closed: bool,
    selected: str,
    thread: str | None,
    flags: dict[str, bool] | None,
    valid: bool,
) -> None:
    """Each choice declares whether it needs the original or follows the old thread."""
    candidate = {
        "paragraph": "我把手里的东西放下，抬头看向女儿。",
        "choices": ["问她写信的事", "给她买杯热豆浆"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
        "letter_thread": thread,
        "choice_context": [flags, {"requires_original": False, "follows_letter": False}]
        if flags is not None
        else None,
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    state = {
        "theme": "letter",
        "mode": "normal",
        "letter_state": "burned",
        "letter_thread_closed": closed,
    }
    if valid:
        assert await story_writer.generate_turn(state, "choice", selected) == candidate
    else:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.generate_turn(state, "choice", selected)


@pytest.mark.parametrize(
    ("mode", "letter_state", "settled", "presented", "responding", "stopped", "action", "allowed"),
    [
        ("high", "burned", None, False, False, False, "去买早饭", True),
        ("normal", "burned", None, False, False, False, "去买早饭", False),
        ("high", "kept", None, False, False, False, "去买早饭", False),
        ("high", "burned", "她把纸收回衣袋。", True, False, False, "去买早饭", False),
        ("high", "burned", None, True, False, False, "去买早饭", False),
        ("high", "burned", None, False, True, False, "去买早饭", False),
        ("high", "burned", None, False, False, True, "去买早饭", False),
        ("high", "burned", None, False, False, False, "不查信了，陪她放风筝", False),
    ],
)
async def test_consequence_is_only_a_candidate_for_the_first_unsettled_burn(
    mock_completion: Callable[[httpx.MockTransport], None],
    mode: str,
    letter_state: str,
    settled: str | None,
    presented: bool,
    responding: bool,
    stopped: bool,
    action: str,
    allowed: bool,
) -> None:
    """A consequence requires high mode, a burned letter and no settled consequence."""
    effect = "女儿看见我袖口的灰，刚要递出的纸被她收了回去。"
    candidate = {
        "paragraph": "我带她到包子铺，叫了两屉小笼包。",
        "choices": ["去公园放风筝", "问女儿想给我看什么"],
        "lock_sentence": effect,
        "facts": [],
        "consequence": effect,
        "eligible": [],
        "choice_context": [
            {"requires_original": False, "follows_letter": False},
            {"requires_original": False, "follows_letter": False},
        ],
    }

    def respond(request: httpx.Request) -> httpx.Response:
        messages = json.loads(request.content)["messages"]
        context = json.loads(messages[1]["content"])
        assert context["mode"] == mode
        assert context["letter_state"] == letter_state
        assert context["consequence"] == settled
        assert context["consequence_presented"] is presented
        assert context["letter_consequence_stopped"] is stopped
        assert context["waiting_response"] is responding
        assert "不要求解决所有悬念" in messages[0]["content"]
        return completion(candidate)

    mock_completion(httpx.MockTransport(respond))
    state = {
        "theme": "letter",
        "mode": mode,
        "letter_state": letter_state,
        "consequence": settled,
        "consequence_presented": presented,
        "waiting_response": responding,
        "letter_consequence_stopped": stopped,
    }
    if allowed:
        assert await story_writer.generate_turn(state, "choice", action) == candidate
    else:
        with pytest.raises(story_writer.StoryModelError, match="格式有误"):
            await story_writer.generate_turn(state, "choice", action)


@pytest.mark.parametrize(
    "changes",
    [
        {"paragraph": ""},
        {"paragraph": "# 开场"},
        {"choices": ["去放风筝", "去放风筝"]},
        {"lock_sentence": "他推开门。屋里没有人。"},
        {"lock_sentence": "我把窗推开了。"},
        {"eligible": ["unlock"]},
        {"lock_uses": 3},
    ],
)
async def test_invalid_candidate_fields_are_rejected(
    mock_completion: Callable[[httpx.MockTransport], None], changes: dict[str, Any]
) -> None:
    """A turn rejects unusable content and model-supplied permission fields."""
    candidate = {
        "paragraph": "我把窗推开了。",
        "choices": ["去放风筝", "去找包子铺"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
        **changes,
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    with pytest.raises(story_writer.StoryModelError) as error:
        await story_writer.generate_turn({"theme": "letter"}, "choice", "推开窗")
    assert error.value.code == "story_model_invalid_response"


async def test_free_write_does_not_accept_an_echoed_player_paragraph(
    mock_completion: Callable[[httpx.MockTransport], None],
) -> None:
    """The same words cannot be played back as a generated continuation."""
    player_text = "我把信原封不动地塞进了抽屉。"
    candidate = {
        "paragraph": player_text,
        "choices": ["等孩子放学", "收拾书桌"],
        "lock_sentence": None,
        "facts": [],
        "consequence": None,
        "eligible": [],
    }
    mock_completion(httpx.MockTransport(lambda _request: completion(candidate)))
    with pytest.raises(story_writer.StoryModelError, match="格式有误"):
        await story_writer.generate_turn({"theme": "letter"}, "keyboard", player_text)


async def test_missing_configuration_is_a_safe_service_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing configuration stops before traffic and identifies the cause safely."""
    monkeypatch.delenv("WECHAT_STORY_API_KEY", raising=False)

    with pytest.raises(story_writer.StoryModelError) as error:
        await story_writer.generate_turn({"theme": "letter"}, "choice", "拆信")
    assert error.value.code == "story_model_not_configured"
    assert error.value.status_code == 503


@pytest.mark.parametrize(
    ("status", "code", "safe_status"),
    [(401, "story_model_unavailable", 502), (429, "story_model_busy", 503)],
)
async def test_http_failure_omits_provider_body_and_credentials(
    mock_completion: Callable[[httpx.MockTransport], None],
    status: int,
    code: str,
    safe_status: int,
) -> None:
    """Upstream error text and credentials are excluded from client error details."""
    mock_completion(
        httpx.MockTransport(
            lambda _request: httpx.Response(status, text="provider-body-with-test-story-token")
        )
    )

    with pytest.raises(story_writer.StoryModelError) as error:
        await story_writer.generate_turn({"theme": "letter"}, "choice", "拆信")
    assert error.value.code == code
    assert error.value.status_code == safe_status
    assert "provider-body" not in str(error.value.to_dict())
    assert "test-story-token" not in str(error.value.to_dict())


async def test_timeout_returns_a_retryable_error(
    mock_completion: Callable[[httpx.MockTransport], None],
) -> None:
    """A stalled provider returns a timeout without handing back provider content."""

    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("provider transport details", request=request)

    mock_completion(httpx.MockTransport(timeout))

    with pytest.raises(story_writer.StoryModelError) as error:
        await story_writer.generate_turn({"theme": "letter"}, "choice", "拆信")
    assert error.value.code == "story_model_timeout"
    assert error.value.status_code == 504


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, text="这不是 JSON"),
        httpx.Response(200, json={"choices": []}),
        completion('```json\n{"text": "正文"}\n```'),
        completion({"text": "不完整的正文"}, finish_reason="length"),
    ],
)
async def test_incomplete_or_malformed_completions_are_rejected(
    mock_completion: Callable[[httpx.MockTransport], None], response: httpx.Response
) -> None:
    """The same transport boundary validates the envelope on correction requests."""
    mock_completion(httpx.MockTransport(lambda _request: response))

    with pytest.raises(story_writer.StoryModelError) as error:
        await story_writer.correct_voice("我刚到家。", "voice")
    assert error.value.code == "story_model_invalid_response"
