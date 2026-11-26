"""HTTP endpoints for WeChat sessions, story runs and published text."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.routes.wechat_schemas import (
    Action,
    CardList,
    CardView,
    EditWork,
    LibraryView,
    Login,
    ModeView,
    NewMode,
    Preview,
    PreviewView,
    Publish,
    ReceiptView,
    RunView,
    SessionView,
    Start,
    WorkView,
)
from server.application.services.wechat_preview import preview_text
from server.infrastructure.llm import story_writer
from server.infrastructure.llm.story_writer import correct_voice, generate_turn
from server.infrastructure.persistence import wechat_runs, wechat_works
from server.infrastructure.persistence.database import get_session
from server.infrastructure.security.wechat_identity import (
    check_public_text,
    exchange_code,
    principal,
)

router = APIRouter(prefix="/api/wechat", tags=["wechat"])
Subject = Annotated[str, Depends(principal)]
Database = Annotated[AsyncSession, Depends(get_session)]
Document = dict[str, Any]


@router.post("/session", response_model=SessionView)
async def session(body: Login) -> Document:
    """Exchange a WeChat code for a mini-program session."""
    return await exchange_code(body.code)


@router.get("/library", response_model=LibraryView, response_model_exclude_none=True)
async def library(subject: Subject, db: Database) -> Document:
    """List the signed-in author's runs, works, saved modes and discoveries."""
    return {
        "runs": await wechat_runs.list_runs(db, subject),
        "works": await wechat_works.list_works(db, subject),
        "modes": await wechat_works.list_modes(db, subject),
        "progress": await wechat_runs.get_progress(db, subject),
    }


@router.post("/runs", response_model=RunView, response_model_exclude_none=True)
async def new_run(body: Start, subject: Subject, db: Database) -> Document:
    """Open a run with its own rules, ownership and request receipt."""
    return await wechat_runs.start_run(db, subject, body.model_dump(exclude_none=True))


@router.get("/runs/{run_id}", response_model=RunView, response_model_exclude_none=True)
async def run(run_id: str, subject: Subject, db: Database) -> Document:
    """Return the current run for its owner."""
    return await wechat_runs.get_run(db, subject, run_id)


@router.post("/runs/{run_id}/actions", response_model=RunView, response_model_exclude_none=True)
async def action(run_id: str, body: Action, subject: Subject, db: Database) -> Document:
    """Apply a command at the writer's expected version."""
    return await wechat_runs.act(
        db,
        subject,
        run_id,
        body.model_dump(exclude_none=True),
        generate_turn=generate_turn,
        correct_voice=correct_voice,
    )


@router.get("/runs/{run_id}/receipts/{request_id}", response_model=ReceiptView)
async def receipt(run_id: str, request_id: str, subject: Subject, db: Database) -> Document:
    """Reconcile an input or command without replaying it or returning deleted text."""
    return await wechat_runs.action_receipt(db, subject, run_id, request_id)


@router.post("/runs/{run_id}/preview", response_model=PreviewView)
async def preview(run_id: str, body: Preview, subject: Subject, db: Database) -> Document:
    """Preview an authorized change and discard candidates whose source version changed."""
    async with db.begin():
        state = await wechat_runs.model_state(db, subject, run_id, body.version)
    text = await preview_text(
        state,
        body.kind,
        body.target,
        body.style,
        correct_voice=correct_voice,
        replace=story_writer.propose_lock_replacement,
        rewrite=story_writer.propose_rewrite,
        insert=story_writer.propose_insert,
    )
    async with db.begin():
        await wechat_runs.model_state(db, subject, run_id, body.version)
    return {"version": body.version, "target": body.target, "text": text}


@router.get("/works/{work_id}", response_model=WorkView, response_model_exclude_none=True)
async def work(work_id: str, subject: Subject, db: Database) -> Document:
    """Read the author's independently editable private work."""
    return await wechat_works.get_work(db, subject, work_id)


@router.put("/works/{work_id}", response_model=WorkView, response_model_exclude_none=True)
@router.patch("/works/{work_id}", response_model=WorkView, response_model_exclude_none=True)
async def edit_work(work_id: str, body: EditWork, subject: Subject, db: Database) -> Document:
    """Update the title and text at the expected work version."""
    return await wechat_works.edit_work(db, subject, work_id, body.model_dump())


@router.get("/works/{work_id}/cards", response_model=CardList)
async def cards(work_id: str, subject: Subject, db: Database) -> Document:
    """List an author's published cards for this work."""
    return {"cards": await wechat_works.list_cards(db, subject, work_id)}


@router.post("/works/{work_id}/cards", response_model=CardView)
async def publish(work_id: str, body: Publish, subject: Subject, db: Database) -> Document:
    """Check the selected text before publishing its immutable snapshot."""
    return await wechat_works.publish_card(
        db, subject, work_id, body.model_dump(), check_public_text=check_public_text
    )


@router.get("/cards/{card_id}", response_model=CardView)
async def read_card(card_id: str, db: Database, response: Response) -> Document:
    """Read a live card through its public text-only projection."""
    response.headers["Cache-Control"] = "no-store"
    return await wechat_works.public_card(db, card_id)


@router.delete("/works/{work_id}/cards/{card_id}", status_code=204)
async def revoke(work_id: str, card_id: str, subject: Subject, db: Database) -> Response:
    """Revoke future reads and starts from the author's card."""
    await wechat_works.revoke_card(db, subject, work_id, card_id)
    return Response(status_code=204)


@router.post("/modes", response_model=ModeView, response_model_exclude_none=True)
async def new_mode(body: NewMode, subject: Subject, db: Database) -> Document:
    """Save a personal mode using the author's discovered rules."""
    async with db.begin():
        progress = await wechat_runs.get_progress(db, subject)
    return await wechat_works.create_mode(db, subject, body.model_dump(), progress)
