"""Exercise the challenge through its public state transitions."""

import json

import pytest

from server.domain.story_game import (
    State,
    StoryRuleError,
    apply_action,
    apply_deferred_generation,
    apply_retained_turn,
    apply_turn,
    create_state,
    progress_for,
)

FIRST = "把信封翻过来，找寄件地址"
FIRST_LOCK = "邮戳上的日期，却是明天。"
BURN = "把信烧掉"
KEEP = "把信留下"
BREAKFAST = "去买早饭"
PARK = "不查信了，陪她放风筝"


@pytest.mark.parametrize("mode", ["normal", "high"])
def test_opening_edit_then_shared_first_lock_and_keyboard_response(mode: str) -> None:
    """Only a new segment counts, and an off-topic answer still responds."""
    initial = create_state("letter", mode)
    assert initial["choices"][0] == FIRST
    edited = apply_action(initial, "edit", target="opening", text="搬家那天，我收到了一封信。")
    assert edited["turns"] == 0
    assert edited["opening"] == initial["opening"]
    assert edited["segments"][0]["text"] != initial["segments"][0]["text"]
    with pytest.raises(StoryRuleError):
        apply_turn(edited, "keyboard", "。？！\u3000", {})
    locked = apply_turn(
        edited,
        "choice",
        FIRST,
        {"paragraph": "我把信封转到窗前，老周在楼下修风筝。", "lock_sentence": FIRST_LOCK},
    )
    assert locked["turns"] == 1
    assert locked["responses"] == 0
    assert locked["segments"][-1]["text"] == FIRST_LOCK
    assert locked["segments"][-1]["locked"] is True
    assert BURN in locked["choices"] and KEEP in locked["choices"]
    assert json.loads(json.dumps(locked, ensure_ascii=False)) == locked
    with pytest.raises(StoryRuleError):
        apply_action(locked, "edit", target=locked["segments"][-1]["id"], text="邮戳模糊了。")
    authored = "  我把信塞回抽屉，一会儿还得接她放学。 "
    response = apply_turn(locked, "keyboard", authored, {"eligible": ["interpret"]})
    assert response["turns"] == 2
    assert response["responses"] == 1
    assert response["offers"] == ["interpret", "skip"]
    assert response["segments"][-1]["text"] == authored
    assert locked["responses"] == 0


def play_first_lock(mode: str) -> State:
    """Take the same first action in both modes."""
    return apply_turn(
        create_state("letter", mode),
        "choice",
        FIRST,
        {"paragraph": "我把信封转到窗前，老周在楼下修风筝。", "lock_sentence": FIRST_LOCK},
    )


@pytest.mark.parametrize("mode", ["normal", "high"])
def test_burn_and_keep_preserve_distinct_actions(mode: str) -> None:
    """Burning removes the original, while both decisions still permit another story line."""
    locked = play_first_lock(mode)
    result = {
        "paragraph": "女儿站在门口看我把信烧透，灰落进了铁盆。",
        "choices": [BREAKFAST, "拆开原信", "核对原信的邮戳"],
        "facts": ["女儿亲眼看见了烧信。"],
        "eligible": ["returning"],
    }
    burned = apply_turn(locked, "choice", BURN, result)
    kept = apply_turn(locked, "choice", KEEP, {"paragraph": "我把未拆的信收进抽屉。"})
    assert burned["letter_state"] == "burned"
    assert kept["letter_state"] == "kept"
    assert burned["responses"] == kept["responses"] == 1
    assert burned["choices"] == [BREAKFAST]
    assert "拆开原信" in kept["choices"] and "核对原信的邮戳" in kept["choices"]
    with pytest.raises(StoryRuleError):
        apply_turn(burned, "choice", "拆开原信", {"paragraph": "看见了信中的字。"})
    with pytest.raises(StoryRuleError):
        apply_turn(
            burned, "choice", BREAKFAST, {"paragraph": "拆开了信。", "letter_action": "read"}
        )


def test_high_consequence_and_later_evolution_do_not_override_player_actions() -> None:
    """A high-intensity consequence happens once after the original decision."""
    burned = apply_turn(
        play_first_lock("high"),
        "choice",
        BURN,
        {
            "paragraph": "女儿看着我把未拆的信彻底烧透。",
            "choices": [BREAKFAST, PARK],
            "eligible": ["returning"],
        },
    )
    ability = apply_action(burned, "ability", ability="returning")
    assert ability["turns"] == burned["turns"]
    assert ability["segments"] == burned["segments"]
    assert ability["abilities"]["returning"] == {"level": 1, "enabled": True}
    consequence = "看见我袖口上的灰，女儿把本想递给我的纸收回了口袋。"
    next_lock = apply_turn(
        ability,
        "choice",
        BREAKFAST,
        {
            "paragraph": "我和女儿到了包子铺，遇见昨天补风筝的老周。",
            "lock_sentence": consequence,
            "consequence": consequence,
            "choices": [PARK, "请老周教她看风向"],
        },
    )
    assert next_lock["responses"] == 1
    assert next_lock["consequence"] == consequence
    assert next_lock["segments"][-1]["locked"]
    assert "请老周教她看风向" in next_lock["choices"]
    park = apply_turn(
        next_lock,
        "choice",
        PARK,
        {
            "paragraph": "我把线轴交给女儿，她一边往前跑，一边慢慢松线。",
            "eligible": ["returning"],
        },
    )
    assert park["responses"] == 2
    evolved = apply_action(park, "ability", ability="returning")
    assert evolved["abilities"]["returning"] == {"level": 2, "enabled": True}
    free = apply_turn(
        evolved,
        "keyboard",
        "我直接回家了。",
        {"paragraph": "女儿再次因为灰尘收起纸。", "consequence": "女儿再次因为灰尘收起纸。"},
    )
    assert free["segments"][-1]["text"] == "我直接回家了。"
    assert free["consequence"] == consequence
    assert free["letter_state"] == "burned"


def test_finish_stops_further_writing_and_only_settled_progress_unlocks_rules() -> None:
    """Only account settlement flags open advanced rules."""
    assert progress_for(4) == {
        "completed": 4,
        "detective": True,
        "high": True,
        "rewrite": False,
        "delete": False,
    }
    assert progress_for(2, achieved_rewrite=True)["rewrite"]
    opening_only = apply_action(create_state("detective", "normal"), "finish")
    assert opening_only["status"] == "finished"
    assert opening_only["turns"] == 0
    with pytest.raises(StoryRuleError):
        apply_turn(opening_only, "voice", "开堂了。", {})


def test_pending_first_lock_can_retry_and_voice_keeps_stable_identifier_and_original() -> None:
    """An unavailable model leaves the author's first passage available for a lock retry."""
    initial = create_state("detective", "normal")
    written = apply_turn(
        initial,
        "voice",
        "请书吏念出来。",
        {"segment_id": "voice_2147"},
        "请、请书吏念出来。",
    )
    assert written["segments"][-1] == {
        "id": "voice_2147",
        "text": "请书吏念出来。",
        "source": "voice",
        "locked": False,
        "original": "请、请书吏念出来。",
        "ai_generated": True,
    }
    assert written["pending_intervention"]
    interrupted = apply_action(written, "insert", text="纸上的落款是一个死去十年的人。")
    assert interrupted["segments"][-1]["locked"]
    assert interrupted["turns"] == 1
    with pytest.raises(StoryRuleError):
        apply_action(interrupted, "insert", text="同一干预不能再次入稿。")


def take_reward(state: State, ability: str, index: int) -> State:
    """Write a new challenge and respond before selecting the requested reward."""
    if not state["waiting_response"]:
        state = apply_turn(
            state, "keyboard", "我走到门口。", {"lock_sentence": f"门牌是{index}号。"}
        )
    responded = apply_turn(
        state, "keyboard", "我把钥匙放好。", {"eligible": ["returning", "interpret"]}
    )
    return apply_action(responded, "ability", ability=ability)


@pytest.mark.parametrize("mode", ["normal", "high"])
def test_explanation_and_one_high_intensity_lock_change(mode: str) -> None:
    """Both modes offer explanations, with a separate advanced high-intensity action."""
    locked = play_first_lock(mode)
    target = locked["segments"][-1]["id"]
    with pytest.raises(StoryRuleError):
        apply_action(locked, "unlock", target=target)
    burned = apply_turn(
        locked,
        "choice",
        BURN,
        {"paragraph": "女儿看着我把未拆的信烧了。", "eligible": ["interpret"]},
    )
    interpreting = apply_action(burned, "ability", ability="interpret")
    evolved = take_reward(interpreting, "interpret", 2)
    result = apply_turn(
        evolved,
        "voice",
        "我问女儿看见了什么。",
        {"interpretation_options": ["邮戳日期的数字看错了。"], "lock_sentence": "屋里暗了下来。"},
        "我问女儿看见了什么。",
    )
    chosen = apply_action(
        result, "ability", ability="interpret", interpretation="邮戳日期的数字看错了。"
    )
    assert chosen["interpretation"] == "邮戳日期的数字看错了。"
    assert chosen["segments"] == result["segments"]
    if mode == "normal":
        with pytest.raises(StoryRuleError):
            apply_action(chosen, "replace", target=target, text="我看错了邮戳。")
    else:
        with pytest.raises(StoryRuleError):
            apply_action(chosen, "replace", target=target, text="……")
        assert chosen["lock_uses"] == 1
        revised = apply_action(chosen, "replace", target=target, text="窗光太亮，我看错了邮戳。")
        assert revised["segments"][2]["locked"] is True
        assert revised["segments"][2]["text"] == "窗光太亮，我看错了邮戳。"
        assert revised["segments"][3] == burned["segments"][3]
        assert revised["letter_state"] == "burned"
        assert revised["lock_uses"] == 0
        with pytest.raises(StoryRuleError):
            apply_action(revised, "unlock", target=target)
        unlocked = apply_action(chosen, "unlock", target=target)
        assert unlocked["segments"][2]["locked"] is False
        assert unlocked["segments"][2]["text"] == FIRST_LOCK
        assert unlocked["lock_uses"] == 0


def test_full_abilities_can_toggle_without_resetting_spent_opportunity() -> None:
    """Later rewards change activation only, including after an advanced action."""
    state = play_first_lock("high")
    target = state["segments"][-1]["id"]
    for index, ability in enumerate(("interpret", "interpret", "returning", "returning")):
        state = take_reward(state, ability, index)
    spent = apply_action(state, "unlock", target=target)
    disabled = take_reward(spent, "toggle_interpret", 5)
    assert disabled["abilities"]["interpret"] == {"level": 2, "enabled": False}
    enabled = take_reward(disabled, "toggle_interpret", 6)
    assert enabled["abilities"]["interpret"] == {"level": 2, "enabled": True}
    assert enabled["lock_uses"] == 0


def test_recoverable_manual_rewrite_cannot_break_a_lock() -> None:
    """Restore an earlier version beside its locked replacement without touching either lock."""
    state = create_state(
        "detective",
        "custom",
        rules={"trigger": "manual", "action": "rewrite", "lock": True, "recoverable": True},
    )
    written = apply_turn(state, "voice", "我听见了唤人的声音。", {}, "我、我听见了唤人的声音。")
    target = written["segments"][-1]["id"]
    revised = apply_action(written, "intervene", target=target, text="证人在门口叫了我一声。")
    recovery = revised["recoveries"][0]
    assert revised["segments"][-1]["locked"]
    assert revised["turns"] == 1
    assert revised["waiting_response"]
    with pytest.raises(StoryRuleError):
        apply_action(revised, "edit", target=target, text="改掉这句。")
    restored = apply_action(revised, "restore", target=recovery["id"])
    texts = [segment["text"] for segment in restored["segments"]]
    assert texts[-2:] == ["证人在门口叫了我一声。", "我听见了唤人的声音。"]
    assert restored["segments"][-2]["locked"] and not restored["segments"][-1]["locked"]
    assert restored["responses"] == 0
    assert restored["turns"] == 1


def test_delete_surfaces_only_allowed_recovery_and_scrubs_source() -> None:
    """A deleted voice segment can only reappear through an authorized recovery entry."""
    for recoverable in (False, True):
        state = create_state(
            "detective",
            "custom",
            rules={
                "trigger": "manual",
                "action": "delete",
                "lock": False,
                "recoverable": recoverable,
            },
        )
        state = apply_turn(
            state,
            "voice",
            "暗号是梅花三枝。",
            {"facts": ["暗号是梅花三枝。"], "choices": ["说出暗号是梅花三枝。"]},
            "暗号、暗号是梅花三枝。",
        )
        target = state["segments"][-1]["id"]
        deleted = apply_action(state, "intervene", target=target)
        with pytest.raises(StoryRuleError):
            apply_action(deleted, "restore", target=target)
        if recoverable:
            restored = apply_action(deleted, "restore", target=deleted["recoveries"][0]["id"])
            assert restored["segments"][-1] == state["segments"][-1]
        else:
            assert deleted["recoveries"] == []
            assert "梅花三枝" not in json.dumps(deleted, ensure_ascii=False)


def test_response_mode_waits_for_author_and_executes_only_its_configured_action() -> None:
    """A saved mode triggers on writing and cannot substitute an unauthorized action."""
    state = create_state(
        "detective",
        "custom",
        rules={"trigger": "response", "action": "insert", "lock": False, "recoverable": True},
    )
    with pytest.raises(StoryRuleError):
        apply_action(state, "intervene", text="还没有作者新段。")
    written = apply_turn(state, "keyboard", "衙役磨了半天的墨。", {"lock_sentence": "铜铃响了。"})
    assert written["segments"][-1]["text"] == "铜铃响了。"
    assert written["segments"][-1]["locked"] is False
    assert written["waiting_response"]
    reply = apply_turn(written, "keyboard", "我请众人安静。", {})
    assert reply["responses"] == 1
    assert reply["pending_intervention"]
    with pytest.raises(StoryRuleError):
        apply_action(reply, "delete", target=written["segments"][-1]["id"])


def test_deferred_generation_gives_at_most_one_reward_and_filters_burned_original() -> None:
    """A generation outage preserves a response without inventing a character or action."""
    burned = apply_turn(play_first_lock("high"), "choice", BURN, {"paragraph": "信烧成了灰。"})
    assert burned["responses"] == 1
    assert burned["offers"] == []
    resumed = apply_deferred_generation(
        burned,
        {
            "eligible": ["interpret"],
            "choices": ["拆开原信", BREAKFAST],
            "paragraph": "不能在恢复时新增这一段。",
            "lock_sentence": "回应轮不应突然加上下一句锁。",
        },
    )
    assert resumed["responses"] == 1
    assert resumed["segments"] == burned["segments"]
    assert resumed["offers"] == ["interpret", "skip"]
    assert resumed["choices"] == [BREAKFAST]
    with pytest.raises(StoryRuleError):
        apply_deferred_generation(resumed, {"eligible": ["returning"]})


def test_automatic_rule_rejects_unauthorized_action_and_opening_target() -> None:
    """Only the saved action on an eligible current passage can change a draft."""
    rules = {"trigger": "automatic", "action": "rewrite", "lock": False, "recoverable": True}
    state = create_state("detective", "custom", rules=rules)
    rules["action"] = "delete"
    text = "我看见朱红官印。"
    written = apply_turn(
        state,
        "keyboard",
        text,
        {
            "segment_id": "observed-seal",
            "intervention": {"target": "observed-seal", "text": "越权。"},
        },
    )
    rejected = apply_deferred_generation(
        written, {"intervention": {"action": "delete", "target": "observed-seal", "text": None}}
    )
    assert rejected["segments"][-1]["text"] == text
    assert rejected["recoveries"] == []
    assert rejected["pending_intervention"]
    with pytest.raises(StoryRuleError):
        apply_action(rejected, "rewrite", target="opening", text="这不是合法目标。")
    with pytest.raises(StoryRuleError):
        apply_action(rejected, "delete", target="observed-seal")
    revised = apply_deferred_generation(
        rejected,
        {"intervention": {"action": "rewrite", "target": "observed-seal", "text": "朱印尚未干。"}},
    )
    assert revised["segments"][-1]["text"] == "朱印尚未干。"
    assert revised["segments"][-1]["ai_generated"]
    assert revised["waiting_response"]
    restored = apply_action(revised, "restore", target=revised["recoveries"][0]["id"])
    assert restored["segments"][-1]["text"] == text
    assert not restored["segments"][-1]["ai_generated"]
    assert restored["turns"] == 1


def test_segment_identifier_is_stable_and_cannot_duplicate_a_current_segment() -> None:
    """A replayed segment must not silently count as a new narrative turn."""
    generated = {"segment_id": "existing-segment", "lock_sentence": "纸上有旧的官印。"}
    initial = create_state("detective", "normal")
    state = apply_turn(initial, "keyboard", "我把文书摊开。", generated)
    with pytest.raises(StoryRuleError):
        apply_turn(state, "keyboard", "我把文书摊开。", generated)
    assert state["turns"] == 1
    assert initial["segments"][0] == state["segments"][0]


def test_begin_finish_pauses_interventions_and_only_retains_confirmed_input() -> None:
    """Retaining an in-flight response keeps its own text without adding any interventions."""
    locked = play_first_lock("high")
    paused = apply_action(locked, "begin_finish")
    assert paused["finishing"]
    assert paused["status"] == "active"
    generated = {
        "paragraph": "这一段是未确认的 AI 续写。",
        "lock_sentence": "这个干预必须丢弃。",
        "eligible": ["returning"],
        "segment_id": "retained-voice",
    }
    with pytest.raises(StoryRuleError):
        apply_turn(paused, "voice", "这是我原先说的话。", generated)
    with pytest.raises(StoryRuleError):
        apply_action(paused, "edit", target="opening", text="这句没被作者保留。")
    with pytest.raises(StoryRuleError):
        apply_deferred_generation(paused, generated)
    spoken = "这是我原先说的话。"
    retained = apply_retained_turn(paused, "voice", spoken, generated, spoken)
    assert retained["segments"][:-1] == locked["segments"]
    assert retained["segments"][-1]["text"] == spoken
    assert retained["segments"][-1]["id"] == "retained-voice"
    assert retained["turns"] == 2
    assert retained["responses"] == 0
    assert retained["offers"] == []
    assert retained["finishing"]
    finished = apply_action(retained, "finish")
    assert finished["status"] == "finished" and not finished["finishing"]
    with pytest.raises(StoryRuleError):
        apply_retained_turn(finished, "voice", spoken, generated, spoken)


def test_retained_first_choice_can_resume_but_discards_inflight_lock() -> None:
    """Continuing after abandoning finish allows the first lock to be newly generated."""
    empty = create_state("letter", "normal")
    generated = {"paragraph": "我把信封转向窗户。", "lock_sentence": FIRST_LOCK}
    with pytest.raises(StoryRuleError):
        apply_retained_turn(empty, "choice", FIRST, generated)
    paused = apply_action(empty, "begin_finish")
    retained = apply_retained_turn(paused, "choice", FIRST, generated)
    assert all(not segment["locked"] for segment in retained["segments"])
    assert retained["segments"][-1]["text"] == generated["paragraph"]
    assert retained["segments"][-1]["ai_generated"]
    resumed = apply_action(retained, "resume")
    assert not resumed["finishing"]
    new_lock = apply_deferred_generation(resumed, {"lock_sentence": FIRST_LOCK})
    assert new_lock["waiting_response"]
    assert new_lock["segments"][-1]["text"] == FIRST_LOCK
    assert BURN in new_lock["choices"]


def test_burn_or_keep_wait_for_first_lock_and_burn_evidence_must_match_passage() -> None:
    """The lost-letter state starts only after the first locked choice actually lands."""
    initial = create_state("letter", "normal")
    provisional = apply_turn(
        initial,
        "choice",
        FIRST,
        {"paragraph": "我把信封翻过来。", "choices": [BURN, KEEP]},
    )
    assert provisional["choices"] == []
    assert provisional["pending_intervention"]
    locked = apply_deferred_generation(provisional, {"lock_sentence": FIRST_LOCK})
    with pytest.raises(StoryRuleError):
        apply_turn(
            locked,
            "choice",
            BURN,
            {
                "paragraph": "我想起柜子里还有一盒火柴。",
                "letter_action": "burn",
                "letter_action_evidence": "我已把信烧成了灰。",
            },
        )
    assert locked["letter_state"] == "unopened"


def test_leaving_letter_thread_blocks_push_even_if_author_revisits() -> None:
    """The old mystery may continue at the author's request, without the forced consequence."""
    burned = apply_turn(
        play_first_lock("high"),
        "choice",
        BURN,
        {"paragraph": "我把信烧成了灰。", "choices": [PARK]},
    )
    detour = apply_turn(
        burned,
        "choice",
        PARK,
        {
            "paragraph": "我和女儿去了公园。",
            "choices": ["拆开原件看落款", "问她为什么刚才收起纸", "沿湖走一圈"],
            "choice_context": [
                {"requires_original": True, "follows_letter": True},
                {"requires_original": False, "follows_letter": True},
                {"requires_original": False, "follows_letter": False},
            ],
        },
    )
    assert detour["letter_thread_closed"]
    assert detour["letter_consequence_stopped"]
    assert detour["choices"] == ["沿湖走一圈"]
    revisited = apply_turn(
        detour,
        "keyboard",
        "我问她为什么刚才收起了纸。",
        {
            "letter_thread": "revisit",
            "paragraph": "女儿因为信被烧掉，不愿把纸给我。",
            "consequence": "女儿因为信被烧掉，不愿把纸给我。",
        },
    )
    assert revisited["segments"][-1]["text"] == "我问她为什么刚才收起了纸。"
    assert revisited["letter_state"] == "burned"
    assert not revisited["letter_thread_closed"]
    assert revisited["consequence"] is None
