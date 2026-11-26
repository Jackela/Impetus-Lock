"""Apply the writing challenge's rules independently of its model and storage."""

from __future__ import annotations

from contextlib import suppress
from copy import deepcopy
from typing import Any, TypeGuard
from unicodedata import category

State = dict[str, Any]

OPENINGS = {
    "letter": "十年后，你收到一封自己寄出的信",
    "detective": "县衙还没升堂，案头已经摆好了一份结案书。",
}

INITIAL_CHOICES = {
    "letter": ["把信封翻过来，找寄件地址", "把信封递给女儿，问她认不认得这个笔迹"],
    "detective": ["请书吏当众念出来", "先把两名证人分开问话"],
}

BURN_LETTER = "把信烧掉"
KEEP_LETTER = "把信留下"
READ_LETTER = "拆开原信"
CHECK_LETTER = "核对原信的邮戳"
BREAKFAST = "去买早饭"
PARK = "不查信了，陪她放风筝"
LETTER_ACTIONS = {
    BURN_LETTER: "burn",
    KEEP_LETTER: "keep",
    READ_LETTER: "read",
    CHECK_LETTER: "check",
}
LETTER_TRANSITIONS = {"burn": "burned", "keep": "kept", "read": "read"}
ABILITIES = ("returning", "interpret")


class StoryRuleError(ValueError):
    """Report an action that the current story does not authorize."""

    def __init__(self, message: str, *, code: str = "invalid") -> None:
        """Keep the player-facing message and the rule failure category."""
        super().__init__(message)
        self.code = code


def _has_text(value: object) -> bool:
    return isinstance(value, str) and any(category(char)[0] in "LNS" for char in value)


def _required_text(value: object) -> str:
    if not isinstance(value, str) or not _has_text(value):
        raise StoryRuleError("请输入有实际内容的文字。")
    return value


def _strings(value: object) -> list[str]:
    if isinstance(value, list):
        return list(
            dict.fromkeys(item for item in value if isinstance(item, str) and _has_text(item))
        )
    return []


def _segment(segment_id: str, text: str, source: str, *, locked: bool = False) -> State:
    return {
        "id": segment_id,
        "text": text,
        "locked": locked,
        "source": source,
        "ai_generated": source in {"choice", "lock", "intervention"},
    }


def _append(
    state: State,
    text: str,
    source: str,
    *,
    locked: bool = False,
    segment_id: str | None = None,
) -> State:
    if segment_id is None:
        segment_id = f"s{state['next_segment']}"
        state["next_segment"] += 1
    elif (
        segment_id == "opening"
        or (segment_id.startswith("s") and segment_id[1:].isdigit())
        or any(segment["id"] == segment_id for segment in state["segments"])
    ):
        raise StoryRuleError("这一段的标识已被使用。")
    segment = _segment(segment_id, text, source, locked=locked)
    state["segments"].append(segment)
    return segment


def _find_segment(state: State, target: str | None) -> tuple[int, State]:
    for index, segment in enumerate(state["segments"]):
        if segment["id"] == target:
            return index, segment
    raise StoryRuleError("当前稿件中找不到这段文字。", code="target_missing")


def _rules_for(mode: str, rules: State | None) -> State:
    if mode != "custom":
        return {}
    if (
        rules is None
        or rules.get("trigger") not in ("manual", "response", "automatic")
        or rules.get("action") not in ("insert", "rewrite", "delete")
        or type(rules.get("lock")) is not bool
        or type(rules.get("recoverable")) is not bool
        or (rules["action"] == "delete" and rules["lock"])
    ):
        raise StoryRuleError("个人模式的触发、动作、锁定与恢复设置不相容。")
    return {key: rules[key] for key in ("trigger", "action", "lock", "recoverable")}


def create_state(
    theme: str,
    mode: str,
    opening: str | None = None,
    rules: State | None = None,
) -> State:
    """Start with the fixed title prompt and an editable opening segment."""
    if theme not in OPENINGS or mode not in {"normal", "high", "custom"}:
        raise StoryRuleError("题材或玩法无效。")
    original_opening = OPENINGS[theme] if opening is None else _required_text(opening)
    return {
        "opening": original_opening,
        "theme": theme,
        "mode": mode,
        "rules": _rules_for(mode, rules),
        "segments": [_segment("opening", original_opening, "opening")],
        "next_segment": 1,
        "choices": list(INITIAL_CHOICES[theme]),
        "offers": [],
        "abilities": {ability: {"level": 0, "enabled": False} for ability in ABILITIES},
        "lock_uses": 0,
        "turns": 0,
        "responses": 0,
        "status": "active",
        "finishing": False,
        "retained_for_finish": False,
        "waiting_response": False,
        "pending_intervention": False,
        "first_lock_seen": False,
        "pending_reward": False,
        "generation_pending": False,
        "interpretation_options": [],
        "interpretation": None,
        "letter_state": "unopened" if theme == "letter" else None,
        "letter_thread_closed": False,
        "letter_consequence_stopped": False,
        "consequence": None,
        "consequence_presented": False,
        "facts": [],
        "recoveries": [],
        "next_recovery": 1,
    }


def _check_active(state: State) -> None:
    if state["status"] != "active":
        raise StoryRuleError("这一局已停止续写。", code="unavailable")


def _check_writing(state: State) -> None:
    _check_active(state)
    if state.get("finishing"):
        raise StoryRuleError("正在收笔，先处理本轮输入或返回续写。", code="unavailable")


def _intervention_applied(state: State) -> None:
    state["waiting_response"] = True
    state["pending_intervention"] = False


def _lock(state: State, sentence: str) -> None:
    _append(state, sentence, "lock", locked=True)
    _intervention_applied(state)
    state["first_lock_seen"] = True
    if (
        state["letter_state"] == "unopened"
        and state["turns"] == 1
        and not state.get("letter_thread_closed")
    ):
        first_passage = state["segments"][1]
        if first_passage["source"] == "choice":
            state["choices"] = list(dict.fromkeys([BURN_LETTER, KEEP_LETTER, *state["choices"]]))


def _offer_abilities(state: State, generated: State) -> None:
    abilities = state["abilities"]
    if all(abilities[ability]["level"] == 2 for ability in ABILITIES):
        state["offers"] = ["toggle_returning", "toggle_interpret", "keep"]
        state["pending_reward"] = False
        return
    candidates = generated.get("eligible")
    state["pending_reward"] = not isinstance(candidates, list)
    state["generation_pending"] |= state["pending_reward"]
    eligible = _strings(candidates)
    offered = [
        ability
        for ability in ABILITIES
        if ability in eligible
        and abilities[ability]["level"] < 2
        and (abilities[ability]["level"] == 0 or state["responses"] >= 2)
    ]
    state["offers"] = [*offered, "skip"] if offered else []


def _add_passage(state: State, source: str, text: str, generated: State) -> State:
    segment_id = generated.get("segment_id")
    if segment_id is not None:
        segment_id = _required_text(segment_id)
    if source == "choice":
        if text not in state["choices"]:
            raise StoryRuleError("这个剧情选项已失效。")
        return _append(
            state, _required_text(generated.get("paragraph")), source, segment_id=segment_id
        )
    if source not in {"keyboard", "voice"}:
        raise StoryRuleError("这一段的输入方式无效。")
    paragraph = _required_text(text)
    continuation = generated.get("paragraph")
    if _has_text(continuation):
        paragraph = f"{paragraph}\n{continuation}"
    segment = _append(state, paragraph, source, segment_id=segment_id)
    segment["ai_generated"] = _has_text(continuation)
    return segment


def _record_passage(
    state: State, source: str, text: str, generated: State, original: str | None
) -> None:
    segment = _add_passage(state, source, text, generated)
    if source == "voice" and original is not None:
        segment["original"] = original
        segment["ai_generated"] |= original != text
    state["generation_passage"] = {
        "id": segment["id"],
        "author_length": len(text) if source != "choice" and segment["text"] != text else None,
    }
    state["turns"] += 1


def _deferred_segment(state: State) -> State | None:
    reference = state.get("generation_passage")
    segments: list[State] = state["segments"]
    for segment in reversed(segments):
        if segment["source"] not in {"choice", "keyboard", "voice"}:
            continue
        if reference is not None and segment["id"] == reference["id"]:
            return segment
        if "generation_passage" not in state:
            # Older drafts did not persist the author segment reference.
            return segment
    return None


def _authored_text(state: State, segment: State) -> str:
    reference = state.get("generation_passage")
    length = reference["author_length"] if reference is not None else None
    text: str = segment["text"]
    return text[:length]


def deferred_passage(state: State) -> tuple[str, str] | None:
    """Read the latest committed writing turn, excluding any appended AI continuation."""
    segment = _deferred_segment(state)
    if segment is None:
        return None
    return segment["source"], _authored_text(state, segment)


def _mark_authored_edit(state: State, segment: State) -> None:
    reference = state.get("generation_passage")
    if reference is not None and segment["id"] == reference["id"]:
        reference["author_length"] = None


def _letter_direction(source: str, text: str, generated: State) -> str | None:
    if source == "choice" and text == PARK:
        return "leave"
    direction = generated.get("letter_thread")
    return direction if isinstance(direction, str) and direction in {"leave", "revisit"} else None


def _letter_effects(
    state: State, source: str, text: str, generated: State, *, deferred: bool = False
) -> State:
    if state["theme"] != "letter":
        return generated
    choice = source == "choice" and not deferred
    action = LETTER_ACTIONS.get(text) if choice else None
    proposed_action = generated.get("letter_action")
    fixed_actions = {*INITIAL_CHOICES["letter"], BREAKFAST, PARK}
    if choice and text in fixed_actions:
        if proposed_action is not None:
            raise StoryRuleError("生成的段落没有沿玩家所选的行动展开。")
    elif action is None and proposed_action in ("burn", "keep", "read", "check"):
        action = proposed_action
    elif action is not None and proposed_action is not None and action != proposed_action:
        raise StoryRuleError("生成的段落没有沿玩家所选的行动展开。")

    paragraph = generated.get("paragraph")
    evidence = generated.get("letter_action_evidence")
    evidence_text = paragraph if choice else text
    if (
        action is not None
        and (evidence is not None or not choice)
        and (
            not isinstance(evidence, str)
            or not _has_text(evidence)
            or not isinstance(evidence_text, str)
            or evidence not in evidence_text
        )
    ):
        if choice:
            raise StoryRuleError("生成的正文没有写出已选择的来信行动。")
        state["generation_pending"] = True
        return {"segment_id": generated.get("segment_id")}

    previously_burned = state["letter_state"] == "burned"
    if previously_burned and action is not None and not (deferred and action == "burn"):
        if choice:
            raise StoryRuleError("信已烧毁，已经无法再处理原件。")
        state["generation_pending"] = True
        return {"segment_id": generated.get("segment_id")}
    direction = _letter_direction(source, text, generated)
    if direction == "leave":
        state["letter_thread_closed"] = True
        state["letter_consequence_stopped"] = (
            state.get("letter_consequence_stopped", False) or previously_burned or action == "burn"
        )
    elif direction == "revisit":
        state["letter_thread_closed"] = False
    if action in LETTER_TRANSITIONS and (action != "keep" or state["letter_state"] != "read"):
        state["letter_state"] = LETTER_TRANSITIONS[action]

    consequence = generated.get("consequence")
    if isinstance(consequence, str) and _has_text(consequence):
        lock = generated.get("lock_sentence")
        in_paragraph = isinstance(paragraph, str) and consequence in paragraph
        in_lock = (
            not state["waiting_response"]
            and (not deferred or state["pending_intervention"])
            and _is_novel_sentence(lock, state)
            and consequence in lock
            and (choice or lock not in text)
        )
        open_thread = not state.get("letter_thread_closed") and not state.get(
            "letter_consequence_stopped"
        )
        if deferred and in_paragraph and consequence == state["consequence"]:
            return generated
        valid = (
            state["mode"] == "high"
            and previously_burned
            and not state["consequence_presented"]
            and ((deferred and in_paragraph) or (open_thread and (in_paragraph or in_lock)))
        )
        if not valid:
            if choice:
                raise StoryRuleError("本局不能再次主动写入这个后果。")
            state["generation_pending"] = True
            return {"segment_id": generated.get("segment_id"), "letter_thread": direction}
        state["consequence"] = consequence
        state["consequence_presented"] = True
    return generated


def _next_choices(state: State, generated: State) -> list[str]:
    original = generated.get("choices")
    candidate_context = generated.get("choice_context")
    burned = state["letter_state"] == "burned"
    closed = state.get("letter_thread_closed", False)
    if (
        isinstance(original, list)
        and isinstance(candidate_context, list)
        and len(original) == len(candidate_context)
    ):
        original = [
            choice
            for choice, context in zip(original, candidate_context, strict=True)
            if not isinstance(context, dict)
            or not (
                (burned and context.get("requires_original"))
                or (closed and context.get("follows_letter"))
            )
        ]
    choices = _strings(original)
    if burned or closed:
        choices = [choice for choice in choices if choice not in LETTER_ACTIONS]
    if (
        state["theme"] == "letter"
        and state["mode"] != "custom"
        and not state.get("first_lock_seen")
    ):
        choices = [choice for choice in choices if choice not in {BURN_LETTER, KEEP_LETTER}]
    if not closed and state["letter_state"] in {"kept", "read"}:
        original_choices = [READ_LETTER, CHECK_LETTER]
        if state["letter_state"] == "read":
            original_choices = [CHECK_LETTER]
        return list(dict.fromkeys([*choices, *original_choices]))
    return choices


def apply_turn(
    state: State,
    source: str,
    text: str,
    generated: State,
    original: str | None = None,
) -> State:
    """Commit one authorized passage and apply its eligible narrative effects."""
    _check_writing(state)
    result = deepcopy(state)
    result["generation_pending"] = False
    result["pending_reward"] = False
    generated = _letter_effects(result, source, text, generated)
    _record_passage(result, source, text, generated, original)
    result["generation_passage"]["direction"] = _letter_direction(source, text, generated)
    result["choices"] = _next_choices(result, generated)
    result["facts"] = list(dict.fromkeys([*result["facts"], *_strings(generated.get("facts"))]))
    result["offers"] = []
    if result["abilities"]["interpret"] == {"level": 2, "enabled": True}:
        result["interpretation_options"] = _strings(generated.get("interpretation_options"))
    responded = _record_response(result)
    if responded:
        _offer_abilities(result, generated)
    if result["mode"] == "custom":
        _consider_custom_intervention(result, generated, responded=responded)
    elif not responded:
        sentence = generated.get("lock_sentence")
        if _is_novel_sentence(sentence, result):
            _lock(result, sentence)
        else:
            result["pending_intervention"] |= result["turns"] == 1 or result["generation_pending"]
    return result


def _record_response(state: State) -> bool:
    if not state["waiting_response"]:
        return False
    state["waiting_response"] = False
    state["responses"] += 1
    return True


def apply_retained_turn(
    state: State,
    source: str,
    text: str,
    generated: State,
    original: str | None = None,
) -> State:
    """Keep an explicitly retained final input without applying pending interventions."""
    _check_active(state)
    if not state.get("finishing") or state.get("retained_for_finish"):
        raise StoryRuleError("当前没有可保留的收笔输入。")
    result = deepcopy(state)
    passage: State = {
        key: generated[key]
        for key in ("segment_id", "letter_action", "letter_action_evidence", "letter_thread")
        if key in generated
    }
    if source == "choice":
        passage["paragraph"] = generated.get("paragraph")
    passage = _letter_effects(result, source, text, passage)
    _record_passage(result, source, text, passage, original)
    result["generation_passage"]["direction"] = _letter_direction(source, text, passage)
    responded = _record_response(result)
    result["pending_reward"] = responded
    result["retained_for_finish"] = True
    result["generation_pending"] = True
    result["choices"] = []
    result["offers"] = []
    result["interpretation_options"] = []
    if result["mode"] == "custom":
        result["pending_intervention"] |= _custom_triggered(result, responded=responded)
    elif not responded and result["turns"] == 1:
        result["pending_intervention"] = True
    return result


def _choose_ability(state: State, choice: str | None) -> None:
    if choice not in state["offers"]:
        raise StoryRuleError("这个能力选择当前不可用。")
    if choice in ABILITIES:
        ability = state["abilities"][choice]
        ability["level"] += 1
        ability["enabled"] = True
        if choice == "interpret" and ability["level"] == 2 and state["mode"] == "high":
            state["lock_uses"] = 1
    elif choice and choice.startswith("toggle_"):
        ability_name = choice.removeprefix("toggle_")
        ability = state["abilities"][ability_name]
        ability["enabled"] = not ability["enabled"]
        if ability_name == "interpret" and not ability["enabled"]:
            state["interpretation_options"] = []
    state["offers"] = []


def _choose_interpretation(state: State, interpretation: str | None) -> None:
    if state["abilities"]["interpret"] != {"level": 2, "enabled": True} or (
        interpretation not in state["interpretation_options"]
    ):
        raise StoryRuleError("这个解释当前不可用。")
    state["interpretation"] = interpretation
    state["interpretation_options"] = []


def authorize_action(
    state: State, kind: str, target: str | None = None
) -> tuple[int | None, State | None]:
    """Check the current target and rule without mutating state or validating candidate text."""
    _check_writing(state)
    if kind in {"edit", "restyle", "unlock", "replace"}:
        index, segment = _find_segment(state, target)
        if kind in {"unlock", "replace"}:
            if (
                state["mode"] != "high"
                or state["abilities"]["interpret"] != {"level": 2, "enabled": True}
                or state["lock_uses"] != 1
            ):
                raise StoryRuleError("当前没有可用的专用改锁机会。", code="forbidden")
            if not segment["locked"]:
                raise StoryRuleError("目标已解锁，无法发动专用改锁。", code="forbidden")
        else:
            if segment["locked"]:
                raise StoryRuleError("这一句已锁定。", code="forbidden")
            if kind == "restyle" and (
                segment["source"] != "voice" or not _has_text(segment.get("original"))
            ):
                raise StoryRuleError("这一段没有可重新整理的口述原文。")
        return index, segment

    if kind not in {"intervene", "insert", "rewrite", "delete"}:
        raise StoryRuleError("这一操作当前不可用。")
    if state["mode"] != "custom":
        if kind not in {"intervene", "insert"} or not state["pending_intervention"]:
            raise StoryRuleError("当前没有可重试的锁句。", code="forbidden")
        if target is not None:
            raise StoryRuleError("当前没有可重试的锁句。", code="unavailable")
        return None, None

    rules = state["rules"]
    if kind not in {"intervene", rules["action"]}:
        raise StoryRuleError("本局规则未授权这次操作。", code="forbidden")
    if (
        not state["turns"]
        or state["waiting_response"]
        or (rules["trigger"] != "manual" and not state["pending_intervention"])
    ):
        raise StoryRuleError("当前尚未满足个人模式的干预条件。", code="unavailable")
    if rules["action"] == "insert" and target is None:
        return None, None
    index, segment = _find_segment(state, target)
    if segment["locked"]:
        raise StoryRuleError("这个目标不能用于个人模式干预。", code="forbidden")
    if segment["source"] == "opening":
        raise StoryRuleError("这个目标不能用于个人模式干预。", code="unavailable")
    return index, segment


def _change_lock(state: State, kind: str, target: str | None, text: str | None) -> None:
    _, segment = authorize_action(state, kind, target)
    assert segment is not None
    if kind == "unlock":
        segment["locked"] = False
    else:
        replacement = _required_text(text)
        if segment["text"] == replacement:
            raise StoryRuleError("请提供与原句不同的替换文字。")
        segment["text"] = replacement
        segment["ai_generated"] = True
        segment.pop("original", None)
    state["lock_uses"] = 0


def _record_recovery(state: State, index: int, segment: State, replacement: str | None) -> None:
    segments = state["segments"]
    state["recoveries"].append(
        {
            "id": f"recovery{state['next_recovery']}",
            "target": segment["id"],
            "segment": deepcopy(segment),
            "index": index,
            "previous_id": segments[index - 1]["id"] if index else None,
            "following_id": segments[index + 1]["id"] if index + 1 < len(segments) else None,
            "replacement": replacement,
        }
    )
    state["next_recovery"] += 1


def _forget_removed(state: State, target: str) -> None:
    # The model's derived entries can contain material from any previous passage.
    state["facts"] = []
    state["choices"] = []
    state["interpretation_options"] = []
    state["interpretation"] = None
    state["consequence"] = None
    state["generation_pending"] = True
    state["recoveries"] = [entry for entry in state["recoveries"] if entry["target"] != target]
    reference = state.get("generation_passage")
    if reference is not None and reference["id"] == target:
        state["generation_passage"] = None


def _is_novel_sentence(value: object, state: State) -> TypeGuard[str]:
    return (
        isinstance(value, str)
        and _has_text(value)
        and all(value not in segment["text"] for segment in state["segments"])
    )


def _apply_intervention(state: State, kind: str, target: str | None, text: object) -> None:
    index, segment = authorize_action(state, kind, target)
    if state["mode"] != "custom":
        sentence = _required_text(text)
        if not _is_novel_sentence(sentence, state):
            raise StoryRuleError("锁句必须是新增的文字。")
        _lock(state, sentence)
        return

    rules = state["rules"]
    action = rules["action"]
    replacement = _required_text(text) if action != "delete" else None
    if action == "insert" and not _is_novel_sentence(replacement, state):
        raise StoryRuleError("插入内容必须是新增文字。")
    if action == "insert" and target is None:
        _append(state, _required_text(replacement), "intervention", locked=rules["lock"])
    else:
        assert index is not None and segment is not None
        if action == "insert":
            inserted = _append(
                state, _required_text(replacement), "intervention", locked=rules["lock"]
            )
            state["segments"].pop()
            state["segments"].insert(index + 1, inserted)
        else:
            if replacement == segment["text"]:
                raise StoryRuleError("请提供与原文不同的改写文字。")
            if rules["recoverable"]:
                _record_recovery(state, index, segment, replacement)
            else:
                _forget_removed(state, segment["id"])
            if action == "delete":
                state["segments"].pop(index)
            else:
                state["segments"][index] = _segment(
                    segment["id"], _required_text(replacement), "intervention", locked=rules["lock"]
                )
    _intervention_applied(state)


def _custom_triggered(state: State, *, responded: bool) -> bool:
    trigger = state["rules"]["trigger"]
    return (trigger == "response" and (responded or state["turns"] == 1)) or (
        trigger == "automatic" and not responded
    )


def _consider_custom_intervention(state: State, generated: State, *, responded: bool) -> None:
    rules = state["rules"]
    if rules["trigger"] == "manual":
        return
    if _custom_triggered(state, responded=responded):
        state["pending_intervention"] = True
    if not state["pending_intervention"]:
        return
    candidate = generated.get("intervention")
    if candidate is None and rules["action"] == "insert" and generated.get("lock_sentence"):
        candidate = {"action": "insert", "target": None, "text": generated["lock_sentence"]}
    if (
        isinstance(candidate, dict)
        and candidate.get("action") == rules["action"]
        and (rules["action"] != "delete" or candidate.get("text") is None)
    ):
        # A failed candidate leaves the author's new passage available.
        with suppress(StoryRuleError):
            _apply_intervention(
                state, candidate["action"], candidate.get("target"), candidate.get("text")
            )


def _deferred_narrative(state: State, generated: State) -> State:
    segment = _deferred_segment(state)
    if segment is None:
        # With no surviving author segment, use the candidates only to resume writing.
        if generated.get("consequence") is not None:
            return {key: value for key, value in generated.items() if key != "lock_sentence"}
        return generated
    source = segment["source"]
    authored = _authored_text(state, segment)
    reference = state.get("generation_passage")
    candidate = {**generated, "paragraph": segment["text"]}
    if reference is not None and reference.get("direction") is not None:
        candidate["letter_thread"] = reference["direction"]
    candidate = _letter_effects(state, source, authored, candidate, deferred=True)
    direction = _letter_direction(source, authored, candidate)
    if reference is not None and direction is not None:
        reference["direction"] = direction
    facts = (fact for fact in _strings(candidate.get("facts")) if fact in segment["text"])
    state["facts"] = list(dict.fromkeys([*state["facts"], *facts]))
    return candidate


def _deferred_choices(state: State, generated: State) -> list[str]:
    if state["letter_state"] == "burned" or state.get("letter_thread_closed"):
        choices = generated.get("choices")
        context = generated.get("choice_context")
        if (
            not isinstance(choices, list)
            or not isinstance(context, list)
            or len(choices) != len(context)
            or any(
                not isinstance(entry, dict)
                or not isinstance(entry.get("requires_original"), bool)
                or not isinstance(entry.get("follows_letter"), bool)
                for entry in context
            )
        ):
            generated = {
                "choices": [choice for choice in _strings(choices) if choice in {BREAKFAST, PARK}]
            }
    return _next_choices(state, generated)


def apply_deferred_generation(state: State, generated: State) -> State:
    """Resume pending options or an intervention without rewriting the author's last turn."""
    _check_writing(state)
    if not (
        state.get("generation_pending")
        or state["pending_intervention"]
        or (state["turns"] and not state["choices"])
    ):
        raise StoryRuleError("当前没有待生成的剧情或锁句。")
    result = deepcopy(state)
    result["generation_pending"] = False
    generated = _deferred_narrative(result, generated)
    choices = _deferred_choices(result, generated)
    if state["letter_state"] == result["letter_state"] and state.get(
        "letter_thread_closed"
    ) == result.get("letter_thread_closed"):
        choices.extend(_next_choices(result, {"choices": state["choices"]}))
    result["choices"] = list(dict.fromkeys(choices))
    if result["abilities"]["interpret"] == {"level": 2, "enabled": True}:
        result["interpretation_options"] = _strings(generated.get("interpretation_options"))
    if result["pending_reward"]:
        _offer_abilities(result, generated)
    if result["pending_intervention"]:
        if result["mode"] == "custom":
            _consider_custom_intervention(result, generated, responded=False)
        elif not result["waiting_response"]:
            sentence = generated.get("lock_sentence")
            if _is_novel_sentence(sentence, result):
                _lock(result, sentence)
    return result


def _restore(state: State, target: str | None) -> None:
    segments = state["segments"]
    for recovery in state["recoveries"]:
        if recovery["id"] != target:
            continue
        original = recovery["segment"]
        locations = {segment["id"]: index for index, segment in enumerate(segments)}
        if recovery["replacement"] is None:
            following_index = locations.get(recovery["following_id"])
            preceding_index = locations.get(recovery["previous_id"])
            if preceding_index is not None:
                segments.insert(preceding_index + 1, original)
            elif following_index is not None:
                segments.insert(following_index, original)
            else:
                segments.insert(recovery["index"], original)
        else:
            index, segment = _find_segment(state, recovery["target"])
            if segment["text"] != recovery["replacement"] or segment["source"] != "intervention":
                raise StoryRuleError("目标已有后续修改，无法原位恢复。")
            if segment["locked"]:
                restored = _append(state, original["text"], original["source"])
                segments.pop()
                segments.insert(index + 1, {**original, "id": restored["id"]})
            else:
                segments[index] = original
        state["recoveries"].remove(recovery)
        return

    _, segment = _find_segment(state, target)
    if segment["locked"] or "original" not in segment:
        raise StoryRuleError("这一段当前不能恢复原文。")
    segment["text"] = segment["original"]
    segment["ai_generated"] = False
    _mark_authored_edit(state, segment)


def apply_action(
    state: State,
    kind: str,
    *,
    target: str | None = None,
    text: str | None = None,
    ability: str | None = None,
    interpretation: str | None = None,
) -> State:
    """Apply an explicit player action without counting it as a writing turn."""
    _check_active(state)
    result = deepcopy(state)
    if kind == "finish":
        result["status"] = "finished"
        result["finishing"] = False
        result["retained_for_finish"] = False
        result["pending_intervention"] = False
        result["generation_pending"] = False
        result["pending_reward"] = False
        result["waiting_response"] = False
        result["offers"] = []
        result["interpretation_options"] = []
        return result
    if kind == "resume":
        if not state.get("finishing"):
            raise StoryRuleError("本局尚未暂停收笔。")
        result["finishing"] = False
        result["retained_for_finish"] = False
        return result
    _check_writing(state)
    if kind in {"edit", "restyle"}:
        _, segment = authorize_action(result, kind, target)
        assert segment is not None
        segment["text"] = _required_text(text)
        _mark_authored_edit(result, segment)
        if kind == "restyle":
            segment["ai_generated"] = segment["text"] != segment["original"]
    elif kind in {"ability", "skip", "toggle"}:
        choice = ability
        if kind == "skip":
            choice = "keep" if "keep" in result["offers"] else "skip"
        if kind == "toggle" and ability in ABILITIES:
            choice = f"toggle_{ability}"
        if choice == "interpret" and interpretation is not None:
            _choose_interpretation(result, interpretation)
        else:
            _choose_ability(result, choice)
    elif kind == "interpretation":
        _choose_interpretation(result, interpretation)
    elif kind in {"unlock", "replace"}:
        _change_lock(result, kind, target, text)
    elif kind in {"intervene", "rewrite", "insert", "delete"}:
        _apply_intervention(result, kind, target, text)
    elif kind == "restore":
        _restore(result, target)
    elif kind == "begin_finish":
        result["finishing"] = True
    else:
        raise StoryRuleError("这一操作当前不可用。")
    return result


def progress_for(
    completed: int,
    achieved_rewrite: bool = False,
    achieved_delete: bool = False,
) -> State:
    """Translate settled writing milestones into account discoveries."""
    return {
        "completed": completed,
        "detective": completed > 0,
        "high": completed > 0,
        "rewrite": achieved_rewrite,
        "delete": achieved_delete,
    }
