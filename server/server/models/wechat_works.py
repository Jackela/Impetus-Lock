"""SQLAlchemy models for private WeChat works, shared cards, and saved modes."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class WechatWorkModel(Base):
    """Store one private, independently editable manuscript per finished run."""

    __tablename__ = "wechat_works"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(64), unique=True)
    subject: Mapped[str] = mapped_column(String(255), index=True)
    version: Mapped[int] = mapped_column(default=0)
    title: Mapped[str] = mapped_column(String(255), default="")
    text: Mapped[str] = mapped_column(Text)
    ai_generated: Mapped[bool] = mapped_column(Boolean)
    initial: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class WechatCardModel(Base):
    """Store a published manuscript snapshot and its publication receipt."""

    __tablename__ = "wechat_cards"
    __table_args__ = (UniqueConstraint("work_id", "request_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    work_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("wechat_works.id", ondelete="CASCADE")
    )
    request_id: Mapped[str] = mapped_column(String(128))
    work_version: Mapped[int]
    title: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)
    ai_generated: Mapped[bool] = mapped_column(Boolean)
    initial: Mapped[dict[str, Any]] = mapped_column(JSON)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class WechatModeModel(Base):
    """Store a player's named rules for future runs."""

    __tablename__ = "wechat_modes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    subject: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(80))
    rules: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
