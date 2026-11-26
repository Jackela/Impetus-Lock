"""Prepare player-requested previews from the authorized version of a story."""

from collections.abc import Awaitable, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any

from server.domain.errors import AuthorizationError, ConflictError, ValidationError
from server.domain.story_game import StoryRuleError, authorize_action

Draft = dict[str, Any]
Proposal = Callable[[Draft, str], Awaitable[str]]


async def preview_action(
    version: int,
    kind: str,
    target: str,
    style: str,
    *,
    transaction: Callable[[], AbstractAsyncContextManager[object]],
    read_state: Callable[[], Awaitable[Draft]],
    correct_voice: Callable[[str, str], Awaitable[str]],
    replace: Proposal,
    rewrite: Proposal,
    insert: Proposal,
) -> Draft:
    """Generate against an owned version and recheck it after the provider returns."""
    async with transaction():
        state = await read_state()
    text = await preview_text(
        state,
        kind,
        target,
        style,
        correct_voice=correct_voice,
        replace=replace,
        rewrite=rewrite,
        insert=insert,
    )
    async with transaction():
        await read_state()
    return {"version": version, "target": target, "text": text}


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
    try:
        _, segment = authorize_action(state, kind, target)
    except StoryRuleError as exc:
        if exc.code == "forbidden":
            raise AuthorizationError(str(exc)) from exc
        if exc.code in {"target_missing", "unavailable"}:
            raise ConflictError(str(exc)) from exc
        raise ValidationError(str(exc)) from exc

    if segment is None:
        raise ValidationError("无法预览这一操作。")
    if kind == "restyle":
        return await correct_voice(segment["original"], style)
    provider = {"replace": replace, "rewrite": rewrite, "insert": insert}.get(kind)
    if provider is None:
        raise ValidationError("无法预览这一操作。")
    return await provider(state, segment["text"])
