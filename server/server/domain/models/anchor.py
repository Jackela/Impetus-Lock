"""Anchor types for positioning intervention actions in document.

Anchors define where to inject (provoke) or delete content in the editor.
Supports three positioning strategies: pos (single point), range (start-end),
and lock_id (reference to existing locked block).

Constitutional Compliance:
- Article V (Documentation): Comprehensive docstrings for all types
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AnchorPos(BaseModel):
    """Single-point anchor using ProseMirror position.

    Used for provoke actions when injecting at a specific cursor position.

    Attributes:
        type: Always "pos" to identify this anchor variant.
        from_: ProseMirror document position (0-based).

    Example:
        ```json
        {
            "type": "pos",
            "from": 1234
        }
        ```
    """

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["pos"] = "pos"
    from_: int = Field(..., alias="from", ge=0, description="ProseMirror position (0-based)")


class AnchorRange(BaseModel):
    """Range anchor using start and end positions.

    Used for delete actions when removing a specific text range.

    Attributes:
        type: Always "range" to identify this anchor variant.
        from_: Start position (inclusive).
        to: End position (exclusive).

    Example:
        ```json
        {
            "type": "range",
            "from": 1289,
            "to": 1310
        }
        ```
    """

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["range"] = "range"
    from_: int = Field(..., alias="from", ge=0, description="Start position (inclusive)")
    to: int = Field(..., gt=0, description="End position (exclusive, must be > from)")


class AnchorLockId(BaseModel):
    """Reference anchor using existing lock ID.

    Used to position relative to or reference an existing locked block.

    Attributes:
        type: Always "lock_id" to identify this anchor variant.
        ref_lock_id: UUID of the referenced locked block.

    Example:
        ```json
        {
            "type": "lock_id",
            "ref_lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8a"
        }
        ```
    """

    type: Literal["lock_id"] = "lock_id"
    ref_lock_id: str = Field(..., min_length=1, description="UUID of referenced lock")


# Union type for all anchor variants
Anchor = AnchorPos | AnchorRange | AnchorLockId
