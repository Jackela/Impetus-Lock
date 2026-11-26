"""A private mapping from a WeChat application identity to an internal principal."""

from uuid import uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from server.infrastructure.persistence.models import Base


class WechatIdentity(Base):
    """Keep platform identifiers on the server and scope them to the issuing app."""

    __tablename__ = "wechat_identities"
    __table_args__ = (UniqueConstraint("app_id", "open_id", name="uq_wechat_identity"),)

    subject: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    app_id: Mapped[str] = mapped_column(String(128), nullable=False)
    open_id: Mapped[str] = mapped_column(String(128), nullable=False)
