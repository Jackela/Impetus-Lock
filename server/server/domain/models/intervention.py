"""Intervention request and response models (Pydantic).

    Matches OpenAPI contract specification (contracts/intervention.yaml v2.0.0).
Used for request validation and LLM-structured outputs via Instructor.

Constitutional Compliance:
- Article IV (SOLID): These models enable type-safe service layer (SRP)
- Article V (Documentation): Complete docstrings per Google style
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from server.domain.models.anchor import Anchor


class ClientMeta(BaseModel):
    """Client-provided metadata about document state.

    Attributes:
        doc_version: Document version counter (increments on each edit).
        selection_from: Cursor position or selection start (ProseMirror absolute position).
        selection_to: Selection end (same as from if no selection).

    Example:
        ```json
        {
            "doc_version": 42,
            "selection_from": 1234,
            "selection_to": 1234
        }
        ```
    """

    doc_version: int = Field(..., ge=0, description="Document version counter")
    selection_from: int = Field(..., ge=0, description="Cursor/selection start position")
    selection_to: int = Field(..., ge=0, description="Selection end position")


class InterventionRequest(BaseModel):
    """Request schema for POST /impetus/generate-intervention.

    Matches OpenAPI contract (intervention.yaml v2.0.0).

    Attributes:
        context: Writing context for LLM decision-making.
            - Muse mode: Last 3 sentences before cursor
            - Loki mode: Full document or last 10 sentences (whichever shorter)
        mode: Agent working mode ("muse" or "loki").
        client_meta: Document state metadata (version, selection).

    Example:
        ```python
        request = InterventionRequest(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            client_meta=ClientMeta(
                doc_version=42,
                selection_from=1234,
                selection_to=1234
            )
        )
        ```
    """

    context: str = Field(
        ..., min_length=1, max_length=2000, description="Writing context (last N sentences)"
    )
    mode: Literal["muse", "loki"] = Field(
        ..., description="Agent mode: muse (STUCK) or loki (random)"
    )
    client_meta: ClientMeta = Field(..., description="Client document state metadata")


class InterventionResponse(BaseModel):
    """Response schema for successful intervention generation.

    Returned by LLM via Instructor (strongly-typed structured output).
    Matches OpenAPI contract (intervention.yaml v2.0.0).

    Attributes:
        action: Intervention action type ("provoke", "delete", "rewrite").
        content: Markdown blockquote content (provoke) or inline replacement text (rewrite).
        lock_id: UUID for un-deletable lock (required for provoke/rewrite).
        anchor: Target position for injection/deletion.
        action_id: Unique action identifier (UUID v4).
        issued_at: Server timestamp when action was generated.

    Example (Provoke):
        ```json
        {
            "action": "provoke",
            "content": "门后传来低沉的呼吸声。",
            "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8a",
            "anchor": {"type": "pos", "from": 1234},
            "action_id": "act_550e8400-e29b-41d4-a716-446655440000",
            "source": "muse",
            "issued_at": "2024-01-15T10:30:00Z"
        }
        ```

    Example (Delete):
        ```json
        {
            "action": "delete",
            "anchor": {"type": "range", "from": 1289, "to": 1310},
            "action_id": "act_660e8400-e29b-41d4-a716-446655440001",
            "source": "loki",
            "issued_at": "2024-01-15T10:31:00Z"
        }
        ```

    Example (Rewrite):
        ```json
        {
            "action": "rewrite",
            "content": "他改为砸向那扇门",
            "lock_id": "lock_01j...",
            "anchor": {"type": "range", "from": 120, "to": 140},
            "action_id": "act_77...",
            "source": "muse",
            "issued_at": "2024-01-15T10:32:00Z"
        }
        ```
    """

    action: Literal["provoke", "delete", "rewrite"] = Field(
        ...,
        description=(
            "Intervention action: provoke (inject), delete (remove) or rewrite "
            "(surgical replace)"
        ),
    )
    content: str | None = Field(
        None,
        min_length=1,
        description="Intervention content (blockquote for provoke, inline text for rewrite)",
    )
    lock_id: str | None = Field(
        None,
        min_length=1,
        description="UUID for un-deletable lock (required for provoke/rewrite actions)",
    )
    anchor: Anchor = Field(..., description="Target position (pos/range/lock_id)")
    action_id: str = Field(..., min_length=1, description="Unique action identifier (UUID v4)")
    source: Literal["muse", "loki"] = Field(
        ...,
        description="Agent mode responsible for the action",
    )
    issued_at: datetime = Field(
        default_factory=datetime.utcnow, description="Server timestamp when action was generated"
    )

    @model_validator(mode="after")
    def _validate_payload(self) -> "InterventionResponse":
        """Ensure required fields exist for each action type."""

        if self.action in {"provoke", "rewrite"}:
            if not self.content or not self.content.strip():
                raise ValueError("content is required for provoke/rewrite actions")
            if not self.lock_id:
                raise ValueError("lock_id is required for provoke/rewrite actions")
        if self.action == "delete":
            self.content = None
            self.lock_id = None

        if self.action == "rewrite" and self.anchor.type != "range":
            raise ValueError("rewrite action requires range anchor")
        if self.action == "delete" and self.anchor.type != "range":
            raise ValueError("delete action requires range anchor")

        return self
