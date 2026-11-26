"""Persistence models for WeChat challenge runs and author progress."""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, TIMESTAMP, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class WechatRunModel(Base):
    """Hold the current private draft and its immutable starting conditions."""

    __tablename__ = "wechat_runs"
    __table_args__ = (UniqueConstraint("subject", "start_request_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    subject: Mapped[str] = mapped_column(String(255), index=True)
    start_request_id: Mapped[str] = mapped_column(String(128))
    version: Mapped[int] = mapped_column(default=1)
    initial: Mapped[dict[str, Any]] = mapped_column(JSON)
    state: Mapped[dict[str, Any]] = mapped_column(JSON)
    work_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(UTC)
    )


class WechatRunReceiptModel(Base):
    """Register a completed, canceled, or temporarily reserved action without its text."""

    __tablename__ = "wechat_run_receipts"

    run_id: Mapped[str] = mapped_column(
        ForeignKey("wechat_runs.id", ondelete="CASCADE"), primary_key=True
    )
    request_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    outcome: Mapped[str] = mapped_column(
        String(12), default="committed", server_default="committed"
    )
    attempt: Mapped[str | None] = mapped_column(String(36))
    attempt_version: Mapped[int | None]
    expires_at: Mapped[int | None]


class WechatProgressModel(Base):
    """Track the author's durable discoveries from eligible completed challenges."""

    __tablename__ = "wechat_progress"

    subject: Mapped[str] = mapped_column(String(255), primary_key=True)
    completed: Mapped[int] = mapped_column(default=0)
    rewrite: Mapped[bool] = mapped_column(default=False)
    delete: Mapped[bool] = mapped_column(default=False)
