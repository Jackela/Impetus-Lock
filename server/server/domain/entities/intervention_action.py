"""Intervention action domain entity.

Represents a single AI intervention (provoke or delete action).
Used for audit logging and intervention history.

Constitutional Compliance:
- Article I (Simplicity): Uses Python dataclass (framework-native)
- Article IV (SOLID): No dependencies on infrastructure or API layers
- Article V (Documentation): Complete Google-style docstrings
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4


@dataclass
class InterventionAction:
    """Intervention action domain entity.

    Represents a single AI intervention action in the system's history.
    Provides audit trail for all provoke and delete actions.

    Attributes:
        id: Unique action entity identifier (UUID v4).
        task_id: Reference to parent task (UUID).
        action_type: Type of intervention ("provoke" or "delete").
        action_id: Client-facing action identifier (e.g., "act_xxxxx").
        lock_id: Lock identifier for provoke actions (None for delete).
        content: Intervention content for provoke actions (None for delete).
        anchor: Position information (dict matching Anchor model).
        mode: Agent mode when action was generated ("muse" or "loki").
        context: User context at intervention time (last N sentences).
        issued_at: Server timestamp when action was generated (UTC).
        created_at: Database insertion timestamp (UTC).

    Example (Provoke):
        ```python
        action = InterventionAction.create(
            task_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            action_type="provoke",
            action_id="act_test_001",
            lock_id="lock_test_001",
            content="> [AI施压 - Muse]: 他打开门，看到...",
            anchor={"type": "pos", "from": 1234},
            mode="muse",
            context="他打开门，犹豫着要不要进去。",
            issued_at=datetime.now(UTC),
        )
        ```

    Example (Delete):
        ```python
        action = InterventionAction.create(
            task_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
            action_type="delete",
            action_id="act_test_002",
            anchor={"type": "range", "from": 1289, "to": 1310},
            mode="loki",
            context="他打开门，犹豫着要不要进去。突然，门后传来脚步声。",
            issued_at=datetime.now(UTC),
        )
        ```
    """

    id: UUID
    task_id: UUID
    action_type: Literal["provoke", "delete"]
    action_id: str
    lock_id: str | None
    content: str | None
    anchor: dict[str, Any]  # Matches Anchor model structure (type, from, to, lock_id)
    mode: Literal["muse", "loki"]
    context: str
    issued_at: datetime
    created_at: datetime

    @classmethod
    def create(
        cls,
        task_id: UUID,
        action_type: Literal["provoke", "delete"],
        action_id: str,
        anchor: dict[str, Any],
        mode: Literal["muse", "loki"],
        context: str,
        issued_at: datetime,
        lock_id: str | None = None,
        content: str | None = None,
    ) -> "InterventionAction":
        """Create new intervention action with generated entity ID.

        Args:
            task_id: Parent task UUID.
            action_type: "provoke" or "delete".
            action_id: Client-facing action ID (e.g., "act_xxxxx").
            anchor: Position information (dict).
            mode: Agent mode ("muse" or "loki").
            context: User context at intervention time.
            issued_at: Server timestamp when action was generated.
            lock_id: Lock ID (required for provoke, None for delete).
            content: Intervention content (required for provoke, None for delete).

        Returns:
            InterventionAction: New action instance.

        Raises:
            ValueError: If provoke action missing lock_id or content.

        Example:
            ```python
            action = InterventionAction.create(
                task_id=uuid4(),
                action_type="provoke",
                action_id="act_001",
                lock_id="lock_001",
                content="> Content",
                anchor={"type": "pos", "from": 123},
                mode="muse",
                context="User context",
                issued_at=datetime.now(UTC),
            )
            assert action.id is not None
            ```
        """
        # Validate provoke action requirements
        if action_type == "provoke" and (not lock_id or not content):
            raise ValueError("Provoke actions require lock_id and content")

        return cls(
            id=uuid4(),
            task_id=task_id,
            action_type=action_type,
            action_id=action_id,
            lock_id=lock_id,
            content=content,
            anchor=anchor,
            mode=mode,
            context=context,
            issued_at=issued_at,
            created_at=datetime.now(UTC),
        )
