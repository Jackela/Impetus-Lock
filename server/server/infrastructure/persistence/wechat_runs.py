"""Persist private WeChat writing runs and their versioned commands."""

from collections.abc import Awaitable, Callable
from copy import deepcopy
from time import time
from typing import Any
from uuid import UUID, uuid4, uuid5

from sqlalchemy import and_, delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from server.application.services.wechat_works import versioned_initial
from server.domain.errors import (
    AppError,
    ConflictError,
    LLMProviderError,
    NotFoundError,
    ValidationError,
)
from server.domain.story_game import (
    StoryRuleError,
    apply_action,
    apply_deferred_generation,
    apply_retained_turn,
    apply_turn,
    create_state,
    deferred_passage,
    progress_for,
)
from server.infrastructure.persistence import wechat_works
from server.models.wechat_runs import WechatProgressModel, WechatRunModel, WechatRunReceiptModel

Document = dict[str, Any]
GenerateTurn = Callable[[Document, str, str], Awaitable[Document]]
CorrectVoice = Callable[[str, str], Awaitable[str]]

_LEASE_SECONDS = 180
_PENDING_INPUT = "pending"
_PENDING_DEFERRED = "deferred"
_PUBLIC_STATE_FIELDS = (
    "theme",
    "mode",
    "opening",
    "rules",
    "segments",
    "choices",
    "offers",
    "abilities",
    "lock_uses",
    "turns",
    "responses",
    "status",
    "finishing",
    "waiting_response",
    "pending_intervention",
    "interpretation_options",
    "interpretation",
    "recoveries",
)


def _view(run: WechatRunModel) -> Document:
    return {
        **{key: run.state[key] for key in _PUBLIC_STATE_FIELDS if key in run.state},
        "id": run.id,
        "version": run.version,
        "work_id": run.work_id,
        "interpretations": run.state.get("interpretation_options", []),
        "generation_pending": (
            run.state["status"] == "active"
            and not run.state.get("finishing")
            and _needs_generation(run.state)
        ),
    }


async def _find_started(db: AsyncSession, subject: str, request_id: str) -> WechatRunModel | None:
    return await db.scalar(
        select(WechatRunModel).where(
            WechatRunModel.subject == subject, WechatRunModel.start_request_id == request_id
        )
    )


async def _owned(db: AsyncSession, subject: str, run_id: str) -> WechatRunModel:
    run = await db.scalar(
        select(WechatRunModel)
        .where(WechatRunModel.id == run_id, WechatRunModel.subject == subject)
        .execution_options(populate_existing=True)
    )
    if run is None:
        raise NotFoundError("找不到这一局。")
    return run


async def list_runs(db: AsyncSession, subject: str) -> list[Document]:
    """Return only the owner's challenges, newest first."""
    runs = await db.scalars(
        select(WechatRunModel)
        .where(WechatRunModel.subject == subject)
        .order_by(WechatRunModel.created_at.desc(), WechatRunModel.id)
    )
    return [_view(run) for run in runs]


async def get_run(db: AsyncSession, subject: str, run_id: str) -> Document:
    """Read the current version of an owned challenge."""
    return _view(await _owned(db, subject, run_id))


async def model_state(db: AsyncSession, subject: str, run_id: str, version: int) -> Document:
    """Read the current eligible narrative context for server-side generation only."""
    run = await _owned(db, subject, run_id)
    if run.version != version or run.state["status"] != "active" or run.state.get("finishing"):
        raise ConflictError("稿件状态已更新，请查看当前版本后再操作。")
    return deepcopy(run.state)


async def get_progress(db: AsyncSession, subject: str) -> Document:
    """Read the author's durable discoveries or the defaults for a new writer."""
    progress = await db.get(WechatProgressModel, subject, populate_existing=True)
    if progress is None:
        return progress_for(0)
    return progress_for(progress.completed, progress.rewrite, progress.delete)


async def _initial_conditions(db: AsyncSession, subject: str, payload: Document) -> Document:
    if card_id := payload.get("card_id"):
        initial = await wechat_works.card_initial(db, card_id)
        version = initial["rules_version"]
        expected = versioned_initial({"theme": initial["theme"]})
        if (
            type(version) is not int
            or version != expected["rules_version"]
            or initial["challenge_id"] != expected["challenge_id"]
        ):
            raise AppError("STORY_CHALLENGE_UNAVAILABLE", "暂时无法开启这个版本的同题挑战。", 409)
        return initial

    theme, mode = payload["theme"], payload["mode"]
    progress = await get_progress(db, subject)
    if (theme == "detective" and not progress["detective"]) or (
        mode == "high" and not progress["high"]
    ):
        raise AppError("STORY_NOT_DISCOVERED", "完成首篇续写作品后可使用这个题材或模式。", 403)
    mode_id = payload.get("mode_id")
    if (mode == "custom") != bool(mode_id):
        raise ValidationError("请为个人模式选择已保存的规则。")
    rules = await wechat_works.mode_rules(db, subject, mode_id) if mode_id else {}
    return {"theme": theme, "mode": mode, "opening": None, "rules": rules}


async def start_run(db: AsyncSession, subject: str, payload: Document) -> Document:
    """Start a private challenge once and fix the authorized opening and rules."""
    request_id = payload["request_id"]
    try:
        async with db.begin():
            previous = await _find_started(db, subject, request_id)
            if previous is not None:
                return _view(previous)
            initial = await _initial_conditions(db, subject, payload)
            rules = initial["rules"]
            if initial["mode"] == "high" and payload.get("accept_high") is not True:
                raise AppError("STORY_HIGH_CONSENT_REQUIRED", "请先确认本局的高强度玩法。", 403)
            if (
                rules.get("action") == "delete"
                and rules.get("recoverable") is False
                and payload.get("accept_irreversible") is not True
            ):
                raise AppError("STORY_CONSENT_REQUIRED", "请先确认本局的不可恢复删除规则。", 403)
            state = create_state(initial["theme"], initial["mode"], initial["opening"], rules)
            initial = versioned_initial(
                {
                    "theme": state["theme"],
                    "mode": state["mode"],
                    "opening": state["opening"],
                    "rules": deepcopy(state["rules"]),
                }
            )
            if (opening := payload.get("opening")) is not None and opening != state["opening"]:
                state = apply_action(state, "edit", target=state["segments"][0]["id"], text=opening)
            run = WechatRunModel(
                subject=subject, start_request_id=request_id, initial=initial, state=state
            )
            db.add(run)
            await db.flush()
            return _view(run)
    except StoryRuleError as exc:
        raise ValidationError(str(exc)) from exc
    except (IntegrityError, NotFoundError):
        async with db.begin():
            previous = await _find_started(db, subject, request_id)
            if previous is not None:
                return _view(previous)
        raise


async def _receipt(db: AsyncSession, run_id: str, request_id: str) -> WechatRunReceiptModel | None:
    return await db.get(WechatRunReceiptModel, (run_id, request_id), populate_existing=True)


async def action_receipt(db: AsyncSession, subject: str, run_id: str, request_id: str) -> Document:
    """Return only the request outcome and current version for an owned run."""
    result = await db.execute(
        select(
            WechatRunModel.version, WechatRunReceiptModel.outcome, WechatRunReceiptModel.expires_at
        )
        .outerjoin(
            WechatRunReceiptModel,
            and_(
                WechatRunReceiptModel.run_id == WechatRunModel.id,
                WechatRunReceiptModel.request_id == request_id,
            ),
        )
        .where(WechatRunModel.id == run_id, WechatRunModel.subject == subject)
    )
    row = result.one_or_none()
    if row is None:
        raise NotFoundError("找不到这一局。")
    status = row.outcome or "unknown"
    if status in {_PENDING_INPUT, _PENDING_DEFERRED}:
        status = "pending" if row.expires_at is not None and row.expires_at > time() else "unknown"
    return {"status": status, "run_version": row.version}


async def _at_version(
    db: AsyncSession, subject: str, run_id: str, payload: Document
) -> tuple[WechatRunModel, Document | None]:
    request_id = payload["request_id"]
    run = await _owned(db, subject, run_id)
    previous = await _prior_result(db, run, request_id)
    if previous is not None:
        return run, previous
    # A conditional write serializes contenders in both PostgreSQL and SQLite.
    # The version advances only when the winning command commits its new state.
    locked = await db.scalar(
        update(WechatRunModel)
        .where(
            WechatRunModel.id == run_id,
            WechatRunModel.subject == subject,
            WechatRunModel.version == payload["version"],
        )
        .values(version=WechatRunModel.version)
        .returning(WechatRunModel.id)
        .execution_options(synchronize_session=False)
    )
    run = await _owned(db, subject, run_id)
    previous = await _prior_result(db, run, request_id)
    if locked is None and previous is None:
        raise ConflictError("稿件有更新，请查看当前版本后再操作。")
    return run, previous


async def _record_completion(db: AsyncSession, subject: str, responses: int) -> None:
    query = (
        select(WechatProgressModel).where(WechatProgressModel.subject == subject).with_for_update()
    )
    progress = await db.scalar(query)
    if progress is None:
        try:
            async with db.begin_nested():
                db.add(WechatProgressModel(subject=subject, completed=1))
                await db.flush()
            return
        except IntegrityError:
            progress = (await db.scalars(query)).one()

    if progress.rewrite and responses >= 2:
        progress.delete = True
    elif progress.completed and responses >= 1:
        progress.rewrite = True
    progress.completed += 1


async def _prior_result(db: AsyncSession, run: WechatRunModel, request_id: str) -> Document | None:
    if run.state["status"] == "finished":
        return _view(run)
    receipt = await _receipt(db, run.id, request_id)
    if receipt is not None and receipt.outcome in {"committed", "canceled"}:
        await db.refresh(run)
        return _view(run)
    return None


def _check_pending(receipt: WechatRunReceiptModel | None) -> None:
    if receipt and receipt.expires_at is not None and receipt.expires_at > time():
        raise AppError("STORY_REQUEST_PENDING", "这次续写还在处理，请稍后重试。", 409)


def _seal_receipt(receipt: WechatRunReceiptModel, outcome: str) -> None:
    receipt.outcome = outcome
    receipt.attempt = None
    receipt.attempt_version = None
    receipt.expires_at = None


def _voice_original(state: Document, target: str | None) -> str:
    for segment in state["segments"]:
        if segment["id"] == target and not segment["locked"]:
            original = segment.get("original")
            if isinstance(original, str) and original:
                return original
    raise ValidationError("这一段没有可重新整理的口述原文。")


def _needs_generation(state: Document) -> bool:
    return bool(
        state.get("generation_pending")
        or state.get("pending_intervention")
        or (state["turns"] and not state["choices"])
    )


def _generation_retry(payload: Document) -> bool:
    return payload["kind"] == "intervene" and not payload.get("target") and not payload.get("text")


def _retained_turn(payload: Document) -> bool:
    return payload["kind"] == "turn" and payload.get("retain") is True


async def _reserve_generation(
    db: AsyncSession, subject: str, run_id: str, payload: Document, attempt: str
) -> tuple[Document, bool]:
    request_id = payload["request_id"]
    async with db.begin():
        run, previous = await _at_version(db, subject, run_id, payload)
        if previous is not None:
            return previous, False
        retained = _retained_turn(payload)
        if bool(run.state.get("finishing")) != retained:
            raise ConflictError("收笔暂停期间，请明确选择要保留的正文或返回继续写作。")
        if retained and run.state.get("retained_for_finish"):
            raise ConflictError("这次收笔已经保留了一段正文。")
        receipt = await _receipt(db, run_id, request_id)
        deferred = _generation_retry(payload)
        outcome = _PENDING_DEFERRED if deferred else _PENDING_INPUT
        if receipt is not None and receipt.outcome != outcome:
            raise ConflictError("这个请求标识已用于另一类操作。")
        if not (retained and receipt is not None and receipt.attempt_version != run.version):
            _check_pending(receipt)
        if (
            payload["kind"] == "turn"
            and payload.get("source") == "choice"
            and payload["text"] not in run.state["choices"]
        ):
            raise ValidationError("这个剧情选项已失效。")
        if deferred and not _needs_generation(run.state):
            raise ValidationError("当前没有待生成的剧情或锁句。")
        if receipt is None:
            receipt = WechatRunReceiptModel(run_id=run_id, request_id=request_id)
            db.add(receipt)
        receipt.outcome = outcome
        receipt.attempt = attempt
        receipt.attempt_version = run.version
        receipt.expires_at = int(time()) + _LEASE_SECONDS
        return deepcopy(run.state), True


async def _settle_generation(
    db: AsyncSession,
    subject: str,
    run_id: str,
    payload: Document,
    attempt: str,
    generated: Document,
    text: str,
    original: str | None,
    generation_pending: bool,
) -> Document:
    request_id = payload["request_id"]
    async with db.begin():
        run, previous = await _at_version(db, subject, run_id, payload)
        if previous is not None:
            return previous
        receipt = await _receipt(db, run_id, request_id)
        if receipt is None or receipt.attempt != attempt:
            raise ConflictError("这次续写已失效，请查看当前稿件。")
        if _retained_turn(payload):
            run.state = apply_retained_turn(run.state, payload["source"], text, generated, original)
        elif payload["kind"] == "turn":
            run.state = apply_turn(
                {**run.state, "generation_pending": generation_pending},
                payload["source"],
                text,
                generated,
                original,
            )
        else:
            run.state = apply_deferred_generation(
                {**run.state, "generation_pending": _needs_generation(run.state)}, generated
            )
        run.version += 1
        _seal_receipt(receipt, "committed")
        return _view(run)


async def _generate_passage(
    state: Document,
    source: str,
    text: str,
    generate_turn: GenerateTurn,
) -> tuple[Document, bool]:
    try:
        return await generate_turn(state, source, text), False
    except LLMProviderError:
        if source == "choice":
            raise
        return {}, True


async def _generate_and_commit(
    db: AsyncSession,
    subject: str,
    run_id: str,
    payload: Document,
    generate_turn: GenerateTurn,
    correct_voice: CorrectVoice,
) -> Document:
    attempt = str(uuid4())
    state, reserved = await _reserve_generation(db, subject, run_id, payload, attempt)
    if not reserved:
        return state

    try:
        generated: Document = {}
        pending = False
        if payload["kind"] == "turn":
            source = payload["source"]
            text = payload["text"]
            original = text if source == "voice" else None
            style = payload.get("style", "voice")
            if original is not None and style != "verbatim":
                text = await correct_voice(original, style)
            if _retained_turn(payload):
                if source == "choice":
                    candidate = await generate_turn(state, source, text)
                    generated = {"paragraph": candidate.get("paragraph")}
            else:
                generated, pending = await _generate_passage(state, source, text, generate_turn)
            generated = {**generated, "segment_id": str(uuid5(UUID(run_id), payload["request_id"]))}
        else:
            original = None
            text = ""
            source, passage = deferred_passage(state) or ("", "")
            generated = await generate_turn({**state, "deferred_generation": True}, source, passage)
        return await _settle_generation(
            db,
            subject,
            run_id,
            payload,
            attempt,
            generated,
            text,
            original,
            pending,
        )
    except BaseException:
        condition = (
            WechatRunReceiptModel.run_id == run_id,
            WechatRunReceiptModel.request_id == payload["request_id"],
            WechatRunReceiptModel.attempt == attempt,
        )
        async with db.begin():
            if _generation_retry(payload):
                await db.execute(delete(WechatRunReceiptModel).where(*condition))
            else:
                # Preserve the author's unresolved input ID, while allowing a safe retry.
                await db.execute(
                    update(WechatRunReceiptModel)
                    .where(*condition)
                    .values(attempt=None, expires_at=None)
                )
        raise


async def _cancel_target(db: AsyncSession, run_id: str, target: str) -> None:
    receipt = await _receipt(db, run_id, target)
    if receipt is None:
        db.add(WechatRunReceiptModel(run_id=run_id, request_id=target, outcome="canceled"))
    elif receipt.outcome in {_PENDING_INPUT, _PENDING_DEFERRED}:
        _seal_receipt(receipt, "canceled")


async def _check_finish_inputs(db: AsyncSession, run_id: str) -> None:
    pending_ids = await db.scalars(
        select(WechatRunReceiptModel.request_id)
        .where(
            WechatRunReceiptModel.run_id == run_id,
            WechatRunReceiptModel.outcome == _PENDING_INPUT,
        )
        .order_by(WechatRunReceiptModel.request_id)
    )
    if request_ids := list(pending_ids):
        raise AppError(
            "STORY_FINISH_INPUT_PENDING",
            "还有输入待核对。请暂停收笔并保留或放弃这些输入。",
            409,
            {"request_ids": request_ids},
        )


def _apply_writer_action(state: Document, payload: Document) -> Document:
    kind = payload["kind"]
    target = payload.get("target")
    text = payload.get("text")
    style = payload.get("style")
    if kind == "restyle":
        if not style:
            raise ValidationError("请先选择口述整理样式并确认预览。")
        kind = "edit"
    if kind == "ability" and payload.get("interpretation") is not None:
        if payload.get("ability") != "interpret":
            raise ValidationError("请明确选择要使用的新解释。")
        kind = "interpretation"
    if kind == "intervene" and state["mode"] != "custom":
        raise ValidationError("此局规则未启用手动干预。")
    if kind == "edit" and style:
        original = _voice_original(state, target)
        if style == "verbatim" and text != original:
            raise ValidationError("逐字恢复需要使用本段识别原文。")
        kind = "restyle"
    return apply_action(
        state,
        kind,
        target=target,
        text=text,
        ability=payload.get("ability"),
        interpretation=payload.get("interpretation"),
    )


async def _commit_action(
    db: AsyncSession, subject: str, run_id: str, payload: Document
) -> Document:
    request_id, kind = payload["request_id"], payload["kind"]
    async with db.begin():
        run, previous = await _at_version(db, subject, run_id, payload)
        if previous is not None:
            return previous
        if await _receipt(db, run_id, request_id) is not None:
            raise ConflictError("这个请求标识已用于另一类操作。")
        if run.state.get("finishing") and kind not in {
            "finish",
            "cancel",
            "resume",
            "begin_finish",
        }:
            raise ConflictError("请先完成收笔或返回继续写作。")
        if kind == "cancel":
            target = payload.get("target")
            if not target or target == request_id:
                raise ValidationError("请指定要放弃的输入或干预。")
            await _cancel_target(db, run_id, target)
        elif kind == "finish":
            await _check_finish_inputs(db, run_id)
            run.state = apply_action(run.state, "finish")
            run.work_id = await wechat_works.freeze_work(
                db, subject, run_id, run.state, run.initial
            )
            if run.state["turns"] > 0:
                await _record_completion(db, subject, run.state["responses"])
            await db.execute(
                update(WechatRunReceiptModel)
                .where(
                    WechatRunReceiptModel.run_id == run_id,
                    WechatRunReceiptModel.outcome == _PENDING_DEFERRED,
                )
                .values(outcome="canceled", attempt=None, attempt_version=None, expires_at=None)
            )
        else:
            run.state = _apply_writer_action(run.state, payload)
        run.version += 1
        db.add(WechatRunReceiptModel(run_id=run_id, request_id=request_id, outcome="committed"))
        return _view(run)


async def act(
    db: AsyncSession,
    subject: str,
    run_id: str,
    payload: Document,
    *,
    generate_turn: GenerateTurn,
    correct_voice: CorrectVoice,
) -> Document:
    """Apply a versioned writer action and persist its outcome at most once."""
    try:
        if payload["kind"] == "turn" or _generation_retry(payload):
            return await _generate_and_commit(
                db, subject, run_id, payload, generate_turn, correct_voice
            )
        return await _commit_action(db, subject, run_id, payload)
    except StoryRuleError as exc:
        raise ValidationError(str(exc)) from exc
