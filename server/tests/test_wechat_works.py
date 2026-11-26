"""Verify the persistence boundaries for WeChat works and sharing."""

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.domain.errors import (
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ServiceUnavailableError,
    ValidationError,
)
from server.infrastructure.persistence import wechat_works
from server.infrastructure.persistence.models import Base
from server.models.wechat_works import WechatCardModel, WechatWorkModel

INITIAL = {"theme": "letter", "mode": "normal", "opening": "原始题句。", "rules": {}}


@pytest.fixture
async def sessions(tmp_path: Path) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Provide separate sessions against an isolated database."""
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'wechat.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False)
    await engine.dispose()


@pytest.mark.asyncio
async def test_freeze_work_is_private_and_only_keeps_deliverable_text(sessions):
    """Finishing twice preserves one work with the current manuscript."""
    state = {
        "segments": [
            {"source": "opening", "text": "改过的题句。", "original": "不公开的旧题。"},
            {"source": "choice", "text": "主角决定追出去。", "ai_generated": True},
            {"source": "intervention", "text": "锁句正文。", "locked": True, "ai_generated": True},
            {"source": "voice", "text": "", "original": "只在恢复记录中的内容。"},
        ],
    }
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(db, "author", "one-run", state, INITIAL)
        assert work_id
        assert await wechat_works.freeze_work(db, "author", "one-run", {}, INITIAL) == work_id

    async with sessions() as db:
        work = await wechat_works.get_work(db, "author", work_id)
        assert work["challenge_id"] == "letter/v1"
        assert work["rules_version"] == 1
        assert work["text"] == "改过的题句。\n\n主角决定追出去。\n\n锁句正文。"
        assert work["ai_generated"] is True
        assert len(await wechat_works.list_works(db, "author")) == 1
        with pytest.raises(NotFoundError):
            await wechat_works.get_work(db, "other", work_id)
        assert await wechat_works.list_works(db, "other") == []


@pytest.mark.asyncio
async def test_edit_work_cannot_overwrite_another_identity_or_a_newer_version(sessions):
    """Only the owner can save and only from the currently saved version."""
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(
            db,
            "author",
            "one-run",
            {"segments": [{"source": "keyboard", "text": "原稿。"}]},
            INITIAL,
        )
    async with sessions() as db:
        with pytest.raises(NotFoundError):
            await wechat_works.edit_work(
                db, "other", work_id, {"version": 0, "title": "", "text": "覆盖"}
            )
        edited = await wechat_works.edit_work(
            db, "author", work_id, {"version": 0, "title": "新标题", "text": "胜出的稿件。"}
        )
        assert edited["version"] == 1
        assert edited["ai_generated"] is False
    async with sessions() as db:
        with pytest.raises(ConflictError):
            await wechat_works.edit_work(
                db, "author", work_id, {"version": 0, "title": "", "text": "过期的稿件。"}
            )
        assert (await wechat_works.get_work(db, "author", work_id))["text"] == "胜出的稿件。"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("trigger", "trigger_label"),
    [("manual", "由作者手动触发"), ("response", "回应后触发"), ("automatic", "满足条件时自动触发")],
)
async def test_published_card_keeps_confirmed_version_and_fixed_initial_rules(
    sessions, trigger, trigger_label
):
    """Public readers get the confirmed text and friends start from the original opening."""
    initial = {
        "theme": "detective",
        "mode": "custom",
        "opening": "原始题句。",
        "challenge_id": "detective/v1",
        "rules_version": 1,
        "rules": {"trigger": trigger, "action": "delete", "lock": False, "recoverable": False},
    }
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(
            db,
            "author",
            "one-run",
            {
                "segments": [
                    {"text": "改过的题句。", "original": "删除的内容。", "ai_generated": True}
                ]
            },
            initial,
        )
    request = {"request_id": "card-request", "version": 0}
    reviewed = []
    async with sessions() as db:

        async def check_public_text(subject, text):
            assert not db.in_transaction()
            reviewed.append((subject, text))

        card = await wechat_works.publish_card(
            db, "author", work_id, request, check_public_text=check_public_text
        )
        assert reviewed == [("author", "改过的题句。\n\n原始题句。")]
        assert len(card["id"]) >= 24 and card["id"] != work_id
        await wechat_works.edit_work(
            db, "author", work_id, {"version": 0, "title": "", "text": "新内容。"}
        )
        assert (
            await wechat_works.publish_card(
                db, "author", work_id, request, check_public_text=check_public_text
            )
            == card
        )
        assert len(reviewed) == 1

    async with sessions() as db:
        assert await wechat_works.public_card(db, card["id"]) == {
            "id": card["id"],
            "title": "",
            "text": "改过的题句。",
            "theme": "detective",
            "mode": "custom",
            "challenge_id": "detective/v1",
            "rules_version": 1,
            "ai_generated": True,
            "requires_consent": True,
            "opening": "原始题句。",
            "rules": (
                f"{trigger_label}，可删除未锁正文。原文不可恢复。"
                "锁句继续受保护，个人模式权限仅限本局。"
            ),
        }
        assert await wechat_works.list_cards(db, "author", work_id) == [card]
        with pytest.raises(NotFoundError):
            await wechat_works.list_cards(db, "other", work_id)
    async with sessions.begin() as db:
        assert await wechat_works.card_initial(db, card["id"]) == initial


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("initial", "challenge_id", "rules_version", "rule_note"),
    [
        ({**INITIAL, "mode": "high"}, "letter/v1", 1, "高强度模式权限仅限本局。"),
        (
            {
                **INITIAL,
                "mode": "custom",
                "challenge_id": "letter/v4",
                "rules_version": 4,
                "rules": {"trigger": "new-trigger", "action": "new-action"},
            },
            "letter/v4",
            4,
            "该规则版本暂不能用于开局。",
        ),
    ],
    ids=["legacy-high", "unavailable-rules"],
)
async def test_existing_work_and_card_read_the_frozen_challenge(
    sessions, initial, challenge_id, rules_version, rule_note
):
    """Versioned readers preserve old snapshots without running their rules."""
    async with sessions.begin() as db:
        db.add(
            WechatWorkModel(
                id="private-work",
                run_id="original-run",
                subject="author",
                text="保存时的正文。",
                ai_generated=False,
                initial=initial,
            )
        )
        await db.flush()
        db.add(
            WechatCardModel(
                id="published-card",
                work_id="private-work",
                request_id="publication",
                work_version=0,
                title="原题",
                text="发布时的正文。",
                ai_generated=False,
                initial=initial,
            )
        )

    async with sessions.begin() as db:
        work = await wechat_works.get_work(db, "author", "private-work")
        card = await wechat_works.public_card(db, "published-card")
        for view in (work, card):
            assert view["challenge_id"] == challenge_id
            assert view["rules_version"] == rules_version
            assert view["opening"] == "原始题句。"
        assert card["text"] == "发布时的正文。"
        assert card["requires_consent"] is False
        assert rule_note in card["rules"]
        assert await wechat_works.card_initial(db, "published-card") == {
            **initial,
            "challenge_id": challenge_id,
            "rules_version": rules_version,
        }


@pytest.mark.asyncio
async def test_revoked_card_cannot_be_read_replayed_or_used_to_start_a_run(sessions):
    """An owner can withdraw a card without deleting or altering the private work."""
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(
            db, "author", "one-run", {"segments": [{"text": "分享的正文。"}]}, INITIAL
        )
    request = {"request_id": "card-request", "version": 0}

    async def allow(_subject, _text):
        return None

    async with sessions() as db:
        card = await wechat_works.publish_card(
            db, "author", work_id, request, check_public_text=allow
        )
        with pytest.raises(NotFoundError):
            await wechat_works.revoke_card(db, "other", work_id, card["id"])
        await wechat_works.revoke_card(db, "author", work_id, card["id"])
        await wechat_works.revoke_card(db, "author", work_id, card["id"])
        with pytest.raises(NotFoundError):
            await wechat_works.publish_card(db, "author", work_id, request, check_public_text=allow)
    async with sessions.begin() as db:
        with pytest.raises(NotFoundError):
            await wechat_works.card_initial(db, card["id"])
        with pytest.raises(NotFoundError):
            await wechat_works.public_card(db, card["id"])
        assert await wechat_works.list_cards(db, "author", work_id) == []
        assert (await wechat_works.get_work(db, "author", work_id))["text"] == "分享的正文。"


@pytest.mark.asyncio
async def test_review_failures_and_edits_during_review_do_not_publish(sessions):
    """Failed moderation or a changed version keeps public snapshots empty."""
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(
            db, "author", "one-run", {"segments": [{"text": "初稿。"}]}, INITIAL
        )
    request = {"request_id": "card-request", "version": 0}

    async def unavailable(_subject, _text):
        raise ServiceUnavailableError()

    async def change_during_review(subject, _text):
        async with sessions() as editor:
            await wechat_works.edit_work(
                editor, subject, work_id, {"version": 0, "title": "", "text": "改稿。"}
            )

    async with sessions() as db:
        with pytest.raises(NotFoundError):
            await wechat_works.publish_card(
                db, "other", work_id, request, check_public_text=unavailable
            )
        with pytest.raises(ServiceUnavailableError):
            await wechat_works.publish_card(
                db, "author", work_id, request, check_public_text=unavailable
            )
        with pytest.raises(ConflictError):
            await wechat_works.publish_card(
                db, "author", work_id, request, check_public_text=change_during_review
            )
        with pytest.raises(ConflictError):
            await wechat_works.publish_card(
                db, "author", work_id, request, check_public_text=unavailable
            )
        assert await wechat_works.list_cards(db, "author", work_id) == []
        assert (await wechat_works.get_work(db, "author", work_id))["text"] == "改稿。"


@pytest.mark.asyncio
async def test_concurrent_publishes_by_request_id_produce_one_card(sessions):
    """An in-flight retry finishes with the same card receipt."""
    async with sessions.begin() as db:
        work_id = await wechat_works.freeze_work(
            db, "author", "one-run", {"segments": [{"text": "分享的正文。"}]}, INITIAL
        )
    barrier = asyncio.Barrier(2)

    async def review(_subject, _text):
        await asyncio.wait_for(barrier.wait(), timeout=3)

    async def publish():
        async with sessions() as db:
            return await wechat_works.publish_card(
                db,
                "author",
                work_id,
                {"request_id": "same-request", "version": 0},
                check_public_text=review,
            )

    first, retry = await asyncio.gather(publish(), publish())
    assert first == retry
    async with sessions() as db:
        assert await wechat_works.list_cards(db, "author", work_id) == [first]


@pytest.mark.asyncio
@pytest.mark.parametrize("trigger", ["manual", "response", "automatic"])
async def test_personal_modes_only_use_discovered_rules_and_belong_to_the_writer(sessions, trigger):
    """A saved mode is private and can be reused with its authorized settings."""
    options = {
        "name": "留白 ",
        "trigger": trigger,
        "action": "delete",
        "lock": True,
        "recoverable": False,
    }
    async with sessions() as db:
        with pytest.raises(AuthorizationError):
            await wechat_works.create_mode(
                db, "author", options, {"rewrite": True, "delete": False}
            )
        with pytest.raises(AuthorizationError):
            await wechat_works.create_mode(db, "author", {**options, "action": "insert"}, {})
        with pytest.raises(ValidationError):
            await wechat_works.create_mode(
                db, "author", {**options, "name": "  "}, {"rewrite": True, "delete": True}
            )
        saved = await wechat_works.create_mode(
            db, "author", options, {"rewrite": True, "delete": True}
        )
    expected = {"trigger": trigger, "action": "delete", "lock": False, "recoverable": False}
    assert saved == {"id": saved["id"], "name": "留白", **expected}
    async with sessions() as db:
        assert await wechat_works.list_modes(db, "author") == [saved]
        assert await wechat_works.list_modes(db, "other") == []
        with pytest.raises(NotFoundError):
            await wechat_works.mode_rules(db, "other", saved["id"])
        rules = await wechat_works.mode_rules(db, "author", saved["id"])
        assert rules == expected
        rules["recoverable"] = True
        assert await wechat_works.mode_rules(db, "author", saved["id"]) == expected
