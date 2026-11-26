"""Persist WeChat manuscripts, published snapshots, and personal modes."""

from collections.abc import Awaitable, Callable
from copy import deepcopy
from secrets import token_urlsafe
from typing import Any
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from server.application.services.wechat_works import (
    deliverable_manuscript,
    describe_rules,
    versioned_initial,
)
from server.domain.errors import ConflictError, NotFoundError, ValidationError
from server.models.wechat_works import WechatCardModel, WechatModeModel, WechatWorkModel


def _work_payload(work: WechatWorkModel) -> dict[str, Any]:
    return {
        "id": work.id,
        "version": work.version,
        "title": work.title,
        "text": work.text,
        "ai_generated": work.ai_generated,
        **_challenge_payload(versioned_initial(work.initial)),
    }


def _challenge_payload(initial: dict[str, Any]) -> dict[str, Any]:
    rules = initial.get("rules") or {}
    return {
        "theme": initial["theme"],
        "mode": initial["mode"],
        "opening": initial["opening"],
        "challenge_id": initial["challenge_id"],
        "rules_version": initial["rules_version"],
        "requires_consent": rules.get("action") == "delete" and rules.get("recoverable") is False,
        "rules": describe_rules(initial),
    }


async def _owned_work(db: AsyncSession, subject: str, work_id: str) -> WechatWorkModel:
    work = await db.scalar(
        select(WechatWorkModel).where(
            WechatWorkModel.id == work_id, WechatWorkModel.subject == subject
        )
    )
    if work is None:
        raise NotFoundError("作品不存在。")
    return work


async def freeze_work(
    db: AsyncSession, subject: str, run_id: str, state: dict[str, Any], initial: dict[str, Any]
) -> str | None:
    """Save the deliverable manuscript within the caller's run transaction."""
    existing = await db.scalar(
        select(WechatWorkModel.id).where(
            WechatWorkModel.run_id == run_id, WechatWorkModel.subject == subject
        )
    )
    if existing is not None:
        return existing

    text, ai_generated = deliverable_manuscript(state)
    if not text:
        return None
    work = WechatWorkModel(
        id=uuid4().hex,
        run_id=run_id,
        subject=subject,
        text=text,
        ai_generated=ai_generated,
        initial=deepcopy(versioned_initial(initial)),
    )
    work_id = work.id
    db.add(work)
    await db.flush()
    return work_id


async def get_work(db: AsyncSession, subject: str, work_id: str) -> dict[str, Any]:
    """Load one private manuscript belonging to the current principal."""
    return _work_payload(await _owned_work(db, subject, work_id))


async def list_works(db: AsyncSession, subject: str) -> list[dict[str, Any]]:
    """List the current principal's private manuscripts, newest first."""
    works = await db.scalars(
        select(WechatWorkModel)
        .where(WechatWorkModel.subject == subject)
        .order_by(WechatWorkModel.created_at.desc(), WechatWorkModel.id)
    )
    return [_work_payload(work) for work in works]


async def edit_work(
    db: AsyncSession, subject: str, work_id: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Save edits only when the private manuscript still has the expected version."""
    async with db.begin():
        work = await db.scalar(
            update(WechatWorkModel)
            .where(
                WechatWorkModel.id == work_id,
                WechatWorkModel.subject == subject,
                WechatWorkModel.version == payload["version"],
            )
            .values(
                title=payload["title"], text=payload["text"], version=WechatWorkModel.version + 1
            )
            .returning(WechatWorkModel)
        )
        if work is None:
            await _owned_work(db, subject, work_id)
            raise ConflictError("作品已更新，请重新打开后再保存。")
        return _work_payload(work)


def _card_payload(card: WechatCardModel) -> dict[str, Any]:
    initial = versioned_initial(card.initial)
    return {
        "id": card.id,
        "title": card.title,
        "text": card.text,
        "ai_generated": card.ai_generated,
        **_challenge_payload(initial),
    }


async def _published_receipt(
    db: AsyncSession, work_id: str, request_id: str, version: int
) -> dict[str, Any] | None:
    card = await db.scalar(
        select(WechatCardModel).where(
            WechatCardModel.work_id == work_id, WechatCardModel.request_id == request_id
        )
    )
    if card is None:
        return None
    if card.revoked:
        raise NotFoundError("作品卡已撤回。")
    if card.work_version != version:
        raise ConflictError("该发布请求已用于另一个作品版本。")
    return _card_payload(card)


async def publish_card(
    db: AsyncSession,
    subject: str,
    work_id: str,
    payload: dict[str, Any],
    *,
    check_public_text: Callable[[str, str], Awaitable[None]],
) -> dict[str, Any]:
    """Publish the reviewed manuscript version once per publication request."""
    request_id = payload["request_id"]
    version = payload["version"]
    async with db.begin():
        work = await _owned_work(db, subject, work_id)
        prior = await _published_receipt(db, work_id, request_id, version)
        if prior is not None:
            return prior
        if work.version != version:
            raise ConflictError("作品已更新，请重新预览后发布。")
        if not work.text.strip():
            raise ValidationError("请先保存要分享的正文。")
        card = WechatCardModel(
            id=token_urlsafe(24),
            work_id=work_id,
            request_id=request_id,
            work_version=version,
            title=work.title,
            text=work.text,
            ai_generated=work.ai_generated,
            initial=deepcopy(versioned_initial(work.initial)),
        )

    text_to_check = "\n\n".join(filter(None, (card.title, card.text, card.initial["opening"])))
    await check_public_text(subject, text_to_check)

    async with db.begin():
        # An update holds a write lock even on SQLite, where FOR UPDATE is ignored.
        saved_version = await db.scalar(
            update(WechatWorkModel)
            .where(WechatWorkModel.id == work_id, WechatWorkModel.subject == subject)
            .values(version=WechatWorkModel.version)
            .returning(WechatWorkModel.version)
        )
        if saved_version is None:
            raise NotFoundError("作品不存在。")
        prior = await _published_receipt(db, work_id, request_id, version)
        if prior is not None:
            return prior
        if saved_version != version:
            raise ConflictError("作品已更新，请重新预览后发布。")
        db.add(card)
        return _card_payload(card)


async def public_card(db: AsyncSession, card_id: str) -> dict[str, Any]:
    """Return only allowed public fields of a currently published card."""
    card = await db.scalar(
        select(WechatCardModel).where(
            WechatCardModel.id == card_id, WechatCardModel.revoked.is_(False)
        )
    )
    if card is None:
        raise NotFoundError("作品卡不可用。")
    return _card_payload(card)


async def list_cards(db: AsyncSession, subject: str, work_id: str) -> list[dict[str, Any]]:
    """List the active cards published by the author of this work."""
    await _owned_work(db, subject, work_id)
    cards = await db.scalars(
        select(WechatCardModel)
        .where(WechatCardModel.work_id == work_id, WechatCardModel.revoked.is_(False))
        .order_by(WechatCardModel.created_at.desc(), WechatCardModel.id)
    )
    return [_card_payload(card) for card in cards]


async def card_initial(db: AsyncSession, card_id: str) -> dict[str, Any]:
    """Lock an active card until creation of the independent run commits."""
    initial = await db.scalar(
        update(WechatCardModel)
        .where(WechatCardModel.id == card_id, WechatCardModel.revoked.is_(False))
        .values(revoked=WechatCardModel.revoked)
        .returning(WechatCardModel.initial)
    )
    if initial is None:
        raise NotFoundError("作品卡不可用，无法开启同题挑战。")
    return deepcopy(versioned_initial(initial))


async def revoke_card(db: AsyncSession, subject: str, work_id: str, card_id: str) -> None:
    """Withdraw a card owned by the principal while retaining its operation receipt."""
    owner_check = (
        select(WechatWorkModel.id)
        .where(WechatWorkModel.id == work_id, WechatWorkModel.subject == subject)
        .scalar_subquery()
    )
    async with db.begin():
        revoked_id = await db.scalar(
            update(WechatCardModel)
            .where(WechatCardModel.id == card_id, WechatCardModel.work_id == owner_check)
            .values(revoked=True)
            .returning(WechatCardModel.id)
        )
        if revoked_id is None:
            raise NotFoundError("作品卡不存在。")


def _mode_payload(mode: WechatModeModel) -> dict[str, Any]:
    return {**mode.rules, "id": mode.id, "name": mode.name}


async def list_modes(db: AsyncSession, subject: str) -> list[dict[str, Any]]:
    """List the player's saved modes, newest first."""
    modes = await db.scalars(
        select(WechatModeModel)
        .where(WechatModeModel.subject == subject)
        .order_by(WechatModeModel.created_at.desc(), WechatModeModel.id)
    )
    return [_mode_payload(mode) for mode in modes]


async def write_mode(
    db: AsyncSession,
    subject: str,
    name: str,
    rules: dict[str, Any],
    *,
    mode_id: str | None = None,
) -> dict[str, Any]:
    """Write a checked configuration in the application's transaction."""
    if mode_id is None:
        mode = WechatModeModel(id=uuid4().hex, subject=subject, name=name, rules=rules)
        db.add(mode)
        return _mode_payload(mode)
    saved = await db.scalar(
        update(WechatModeModel)
        .where(WechatModeModel.id == mode_id, WechatModeModel.subject == subject)
        .values(name=name, rules=rules)
        .returning(WechatModeModel)
    )
    if saved is None:
        raise NotFoundError("个人模式不存在。")
    return _mode_payload(saved)


async def mode_rules(db: AsyncSession, subject: str, mode_id: str) -> dict[str, Any]:
    """Resolve a private mode's rule set for the calling player's new run."""
    rules = await db.scalar(
        select(WechatModeModel.rules).where(
            WechatModeModel.id == mode_id, WechatModeModel.subject == subject
        )
    )
    if rules is None:
        raise NotFoundError("个人模式不存在。")
    return deepcopy(rules)
