"""Prepare player-requested previews from the authorized version of a story."""

from collections.abc import Awaitable, Callable
from typing import Any

from server.domain.errors import AuthorizationError, ConflictError, ValidationError

Draft = dict[str, Any]
Proposal = Callable[[Draft, str], Awaitable[str]]


async def preview_text(
    state: Draft,
    kind: str,
    target: str,
    style: str,
    *,
    correct_voice: Callable[[str, str], Awaitable[str]],
    replace: Proposal,
    rewrite: Proposal,
    insert: Proposal,
) -> str:
    """Generate a candidate only for an eligible target; leave the run untouched."""
    segment = next((part for part in state["segments"] if part["id"] == target), None)
    if segment is None:
        raise ConflictError("这段文字已不存在，请查看当前稿件。")
    if kind == "replace":
        ability = state["abilities"]["interpret"]
        if not (
            state["mode"] == "high"
            and ability["enabled"]
            and ability["level"] == 2
            and state["lock_uses"] > 0
            and segment["locked"]
        ):
            raise AuthorizationError("当前局不能替换这条锁句。")
        return await replace(state, segment["text"])
    if segment["locked"]:
        raise AuthorizationError("这段文字已锁定。")
    if kind == "restyle":
        original = segment.get("original")
        if segment["source"] != "voice" or not original:
            raise ValidationError("这一段没有可整理的口述原文。")
        return await correct_voice(original, style)
    rules = state["rules"]
    if state["mode"] != "custom" or rules.get("trigger") != "manual" or rules.get("action") != kind:
        raise AuthorizationError("本局规则未授权这次手动操作。")
    if not state["turns"] or state["waiting_response"] or segment["source"] == "opening":
        raise ConflictError("当前回合或选中的段落无法进行这项干预。")
    if kind == "rewrite":
        return await rewrite(state, segment["text"])
    if kind == "insert":
        return await insert(state, segment["text"])
    raise ValidationError("无法预览这一操作。")
