"""Test data factories for intervention domain models.

Provides factory classes for creating domain model instances
with sensible defaults for testing. Uses fluent builder patterns
for flexible test data construction.

Example:
    >>> meta = ClientMetaFactory.create()
    >>> request = InterventionRequestFactory.create(mode="muse")
    >>> response = InterventionResponseFactory.provoke().build()
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal, Self

from server.domain.models.anchor import AnchorPos, AnchorRange
from server.domain.models.intervention import ClientMeta, InterventionRequest, InterventionResponse


class ClientMetaFactory:
    """Factory for creating ClientMeta instances.

    Provides methods to create ClientMeta objects with
    configurable or default values.

    Attributes:
        DEFAULT_DOC_VERSION: Default document version.
        DEFAULT_SELECTION_FROM: Default selection start position.
        DEFAULT_SELECTION_TO: Default selection end position.

    Example:
        >>> # Create with defaults
        ... meta = ClientMetaFactory.create()

        >>> # Create with custom values
        ... meta = ClientMetaFactory.create(doc_version=100, selection_from=500)

        >>> # Use builder pattern
        ... meta = ClientMetaFactory.builder().with_doc_version(10).build()
    """

    DEFAULT_DOC_VERSION: int = 42
    DEFAULT_SELECTION_FROM: int = 1234
    DEFAULT_SELECTION_TO: int = 1234

    @classmethod
    def create(
        cls,
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> ClientMeta:
        """Create a ClientMeta instance.

        Args:
            doc_version: Document version counter (default: 42).
            selection_from: Selection start position (default: 1234).
            selection_to: Selection end position (default: 1234).

        Returns:
            A ClientMeta instance with specified or default values.
        """
        return ClientMeta(
            doc_version=doc_version if doc_version is not None else cls.DEFAULT_DOC_VERSION,
            selection_from=selection_from
            if selection_from is not None
            else cls.DEFAULT_SELECTION_FROM,
            selection_to=selection_to if selection_to is not None else cls.DEFAULT_SELECTION_TO,
        )

    @classmethod
    def builder(cls) -> ClientMetaBuilder:
        """Get a builder for constructing ClientMeta with method chaining.

        Returns:
            A ClientMetaBuilder instance.
        """
        return ClientMetaBuilder()

    @classmethod
    def at_cursor(cls, position: int, doc_version: int = 42) -> ClientMeta:
        """Create a ClientMeta for a cursor position (no selection).

        Args:
            position: The cursor position.
            doc_version: Document version (default: 42).

        Returns:
            A ClientMeta with selection_from == selection_to.
        """
        return cls.create(
            doc_version=doc_version,
            selection_from=position,
            selection_to=position,
        )

    @classmethod
    def with_selection(
        cls,
        from_pos: int,
        to_pos: int,
        doc_version: int = 42,
    ) -> ClientMeta:
        """Create a ClientMeta with a text selection range.

        Args:
            from_pos: Selection start position.
            to_pos: Selection end position.
            doc_version: Document version (default: 42).

        Returns:
            A ClientMeta with the specified selection range.
        """
        return cls.create(
            doc_version=doc_version,
            selection_from=from_pos,
            selection_to=to_pos,
        )


class ClientMetaBuilder:
    """Fluent builder for ClientMeta instances.

    Provides a chainable interface for constructing ClientMeta
    objects with custom values.

    Example:
        >>> meta = (
        ...     ClientMetaBuilder()
        ...     .with_doc_version(100)
        ...     .at_position(500)
        ...     .build()
        ... )
    """

    def __init__(self) -> None:
        """Initialize builder with default values."""
        self.doc_version: int = ClientMetaFactory.DEFAULT_DOC_VERSION
        self.selection_from: int = ClientMetaFactory.DEFAULT_SELECTION_FROM
        self.selection_to: int = ClientMetaFactory.DEFAULT_SELECTION_TO

    def with_doc_version(self, version: int) -> Self:
        """Set the document version.

        Args:
            version: The document version counter.

        Returns:
            Self for method chaining.
        """
        self.doc_version = version
        return self

    def at_position(self, position: int) -> Self:
        """Set both selection positions to the same value (cursor).

        Args:
            position: The cursor position.

        Returns:
            Self for method chaining.
        """
        self.selection_from = position
        self.selection_to = position
        return self

    def with_selection(self, from_pos: int, to_pos: int) -> Self:
        """Set a selection range.

        Args:
            from_pos: Selection start position.
            to_pos: Selection end position.

        Returns:
            Self for method chaining.
        """
        self.selection_from = from_pos
        self.selection_to = to_pos
        return self

    def increment_version(self) -> Self:
        """Increment the document version by 1.

        Returns:
            Self for method chaining.
        """
        self.doc_version += 1
        return self

    def build(self) -> ClientMeta:
        """Build the ClientMeta instance.

        Returns:
            A ClientMeta with the configured values.
        """
        return ClientMeta(
            doc_version=self.doc_version,
            selection_from=self.selection_from,
            selection_to=self.selection_to,
        )


class InterventionRequestFactory:
    """Factory for creating InterventionRequest instances.

    Provides methods to create intervention requests with
    various configurations for testing.

    Attributes:
        DEFAULT_CONTEXT: Default context text.
        DEFAULT_MODE: Default intervention mode.

    Example:
        >>> # Create with defaults
        ... request = InterventionRequestFactory.create()

        >>> # Create for Loki mode
        ... request = InterventionRequestFactory.loki_mode()

        >>> # Create with custom context
        ... request = InterventionRequestFactory.with_context("Custom text")
    """

    DEFAULT_CONTEXT: str = "他打开门，犹豫着要不要进去。"
    DEFAULT_MODE: Literal["muse", "loki"] = "muse"

    @classmethod
    def create(
        cls,
        context: str | None = None,
        mode: Literal["muse", "loki"] | None = None,
        client_meta: ClientMeta | None = None,
    ) -> InterventionRequest:
        """Create an InterventionRequest instance.

        Args:
            context: Writing context text (default: Chinese sample).
            mode: Intervention mode (default: "muse").
            client_meta: Client metadata (default: factory defaults).

        Returns:
            An InterventionRequest with specified or default values.
        """
        return InterventionRequest(
            context=context if context is not None else cls.DEFAULT_CONTEXT,
            mode=mode if mode is not None else cls.DEFAULT_MODE,
            client_meta=client_meta if client_meta is not None else ClientMetaFactory.create(),
        )

    @classmethod
    def builder(cls) -> InterventionRequestBuilder:
        """Get a builder for constructing InterventionRequest.

        Returns:
            An InterventionRequestBuilder instance.
        """
        return InterventionRequestBuilder()

    @classmethod
    def muse_mode(
        cls,
        context: str | None = None,
        client_meta: ClientMeta | None = None,
    ) -> InterventionRequest:
        """Create a Muse mode intervention request.

        Args:
            context: Writing context (default: sample text).
            client_meta: Client metadata (default: factory defaults).

        Returns:
            An InterventionRequest in Muse mode.
        """
        return cls.create(context=context, mode="muse", client_meta=client_meta)

    @classmethod
    def loki_mode(
        cls,
        context: str | None = None,
        client_meta: ClientMeta | None = None,
    ) -> InterventionRequest:
        """Create a Loki mode intervention request.

        Args:
            context: Writing context (default: sample text).
            client_meta: Client metadata (default: factory defaults).

        Returns:
            An InterventionRequest in Loki mode.
        """
        return cls.create(context=context, mode="loki", client_meta=client_meta)

    @classmethod
    def with_context(
        cls, context: str, mode: Literal["muse", "loki"] = "muse"
    ) -> InterventionRequest:
        """Create a request with custom context.

        Args:
            context: The writing context text.
            mode: Intervention mode (default: "muse").

        Returns:
            An InterventionRequest with the specified context.
        """
        return cls.create(context=context, mode=mode)

    @classmethod
    def short_context(cls, mode: Literal["muse", "loki"] = "muse") -> InterventionRequest:
        """Create a request with short context (under 50 chars).

        Useful for testing safety guards that prevent delete
        actions on short contexts.

        Args:
            mode: Intervention mode (default: "muse").

        Returns:
            An InterventionRequest with short context (30 chars).
        """
        return cls.create(context="Too short for delete action.", mode=mode)

    @classmethod
    def long_context(cls, mode: Literal["muse", "loki"] = "muse") -> InterventionRequest:
        """Create a request with long context (over 50 chars).

        Useful for testing delete actions which require
        sufficient context length.

        Args:
            mode: Intervention mode (default: "muse").

        Returns:
            An InterventionRequest with long context (100+ chars).
        """
        long_text = (
            "This is a sufficiently long context that has more than "
            "fifty characters in total for deletion. " * 2
        )
        return cls.create(context=long_text, mode=mode)


class InterventionRequestBuilder:
    """Fluent builder for InterventionRequest instances.

    Provides a chainable interface for constructing intervention
    requests with custom values.

    Example:
        >>> request = (
        ...     InterventionRequestBuilder()
        ...     .with_mode("loki")
        ...     .with_context("Custom context text here")
        ...     .with_doc_version(100)
        ...     .at_position(500)
        ...     .build()
        ... )
    """

    def __init__(self) -> None:
        """Initialize builder with default values."""
        self.context: str = InterventionRequestFactory.DEFAULT_CONTEXT
        self.mode: Literal["muse", "loki"] = InterventionRequestFactory.DEFAULT_MODE
        self.client_meta: ClientMeta = ClientMetaFactory.create()

    def with_mode(self, mode: Literal["muse", "loki"]) -> Self:
        """Set the intervention mode.

        Args:
            mode: "muse" or "loki" mode.

        Returns:
            Self for method chaining.
        """
        self.mode = mode
        return self

    def with_context(self, context: str) -> Self:
        """Set the writing context.

        Args:
            context: The context text.

        Returns:
            Self for method chaining.
        """
        self.context = context
        return self

    def with_client_meta(self, client_meta: ClientMeta) -> Self:
        """Set the client metadata.

        Args:
            client_meta: ClientMeta instance.

        Returns:
            Self for method chaining.
        """
        self.client_meta = client_meta
        return self

    def with_doc_version(self, version: int) -> Self:
        """Set the document version.

        Args:
            version: Document version counter.

        Returns:
            Self for method chaining.
        """
        self.client_meta = ClientMetaFactory.create(
            doc_version=version,
            selection_from=self.client_meta.selection_from,
            selection_to=self.client_meta.selection_to,
        )
        return self

    def at_position(self, position: int) -> Self:
        """Set the cursor position.

        Args:
            position: The cursor position (sets both from and to).

        Returns:
            Self for method chaining.
        """
        self.client_meta = ClientMetaFactory.at_cursor(
            position=position,
            doc_version=self.client_meta.doc_version,
        )
        return self

    def with_selection(self, from_pos: int, to_pos: int) -> Self:
        """Set a selection range.

        Args:
            from_pos: Selection start position.
            to_pos: Selection end position.

        Returns:
            Self for method chaining.
        """
        self.client_meta = ClientMetaFactory.with_selection(
            from_pos=from_pos,
            to_pos=to_pos,
            doc_version=self.client_meta.doc_version,
        )
        return self

    def muse_mode(self) -> Self:
        """Set mode to Muse.

        Returns:
            Self for method chaining.
        """
        self.mode = "muse"
        return self

    def loki_mode(self) -> Self:
        """Set mode to Loki.

        Returns:
            Self for method chaining.
        """
        self.mode = "loki"
        return self

    def build(self) -> InterventionRequest:
        """Build the InterventionRequest instance.

        Returns:
            An InterventionRequest with configured values.
        """
        return InterventionRequest(
            context=self.context,
            mode=self.mode,
            client_meta=self.client_meta,
        )


class InterventionResponseFactory:
    """Factory for creating InterventionResponse instances.

    Provides methods to create intervention responses for
    all action types with sensible defaults.

    Attributes:
        DEFAULT_CONTENT: Default content for provoke actions.
        DEFAULT_LOCK_ID: Default lock ID prefix.
        DEFAULT_ACTION_ID: Default action ID prefix.

    Example:
        >>> # Create provoke response
        ... response = InterventionResponseFactory.provoke()

        >>> # Create delete response
        ... response = InterventionResponseFactory.delete()

        >>> # Create with custom values
        ... response = InterventionResponseFactory.builder()
        ...                      .with_action("rewrite")
        ...                      .with_content("New text")
        ...                      .build()
    """

    DEFAULT_CONTENT: str = "他打开门，看到..."
    DEFAULT_LOCK_ID_PREFIX: str = "lock_"
    DEFAULT_ACTION_ID_PREFIX: str = "act_"

    @classmethod
    def create(
        cls,
        action: Literal["provoke", "delete", "rewrite"] = "provoke",
        content: str | None = None,
        lock_id: str | None = None,
        anchor: AnchorPos | AnchorRange | None = None,
        action_id: str | None = None,
        source: Literal["muse", "loki"] = "muse",
        issued_at: datetime | None = None,
    ) -> InterventionResponse:
        """Create an InterventionResponse instance.

        Args:
            action: The intervention action type.
            content: Content text (required for provoke/rewrite).
            lock_id: Lock identifier (required for provoke/rewrite).
            anchor: Target position anchor.
            action_id: Unique action identifier.
            source: Intervention source mode.
            issued_at: Timestamp.

        Returns:
            An InterventionResponse with specified or default values.
        """
        # Set defaults based on action type
        if action == "delete":
            content = None
            lock_id = None
            anchor = anchor or AnchorRange(from_=0, to=10)
        else:
            content = content if content is not None else cls.DEFAULT_CONTENT
            lock_id = (
                lock_id if lock_id is not None else f"{cls.DEFAULT_LOCK_ID_PREFIX}{uuid.uuid4()}"
            )
            anchor = anchor or AnchorPos(from_=0)

        return InterventionResponse(
            action=action,
            content=content,
            lock_id=lock_id,
            anchor=anchor,
            action_id=action_id
            if action_id is not None
            else f"{cls.DEFAULT_ACTION_ID_PREFIX}{uuid.uuid4()}",
            source=source,
            issued_at=issued_at if issued_at is not None else datetime.now(UTC),
        )

    @classmethod
    def builder(cls) -> InterventionResponseBuilder:
        """Get a builder for constructing InterventionResponse.

        Returns:
            An InterventionResponseBuilder instance.
        """
        return InterventionResponseBuilder()

    @classmethod
    def provoke(
        cls,
        content: str | None = None,
        source: Literal["muse", "loki"] = "muse",
        **kwargs: Any,
    ) -> InterventionResponse:
        """Create a provoke action response.

        Args:
            content: The provoke content (default: sample text).
            source: The source mode (default: "muse").
            **kwargs: Additional arguments passed to create().

        Returns:
            An InterventionResponse with provoke action.
        """
        return cls.create(
            action="provoke",
            content=content,
            source=source,
            **kwargs,
        )

    @classmethod
    def delete(
        cls,
        from_pos: int = 0,
        to_pos: int = 10,
        source: Literal["muse", "loki"] = "loki",
        **kwargs: Any,
    ) -> InterventionResponse:
        """Create a delete action response.

        Args:
            from_pos: Range start position (default: 0).
            to_pos: Range end position (default: 10).
            source: The source mode (default: "loki").
            **kwargs: Additional arguments passed to create().

        Returns:
            An InterventionResponse with delete action.
        """
        return cls.create(
            action="delete",
            anchor=AnchorRange(from_=from_pos, to=to_pos),
            source=source,
            **kwargs,
        )

    @classmethod
    def rewrite(
        cls,
        content: str,
        from_pos: int = 0,
        to_pos: int = 10,
        source: Literal["muse", "loki"] = "muse",
        **kwargs: Any,
    ) -> InterventionResponse:
        """Create a rewrite action response.

        Args:
            content: The replacement text.
            from_pos: Range start position (default: 0).
            to_pos: Range end position (default: 10).
            source: The source mode (default: "muse").
            **kwargs: Additional arguments passed to create().

        Returns:
            An InterventionResponse with rewrite action.
        """
        return cls.create(
            action="rewrite",
            content=content,
            anchor=AnchorRange(from_=from_pos, to=to_pos),
            source=source,
            **kwargs,
        )

    @classmethod
    def for_muse(
        cls, action: Literal["provoke", "delete", "rewrite"] = "provoke", **kwargs: Any
    ) -> InterventionResponse:
        """Create a response for Muse mode.

        Args:
            action: The action type (default: "provoke").
            **kwargs: Additional arguments passed to create().

        Returns:
            An InterventionResponse with source="muse".
        """
        return cls.create(action=action, source="muse", **kwargs)

    @classmethod
    def for_loki(
        cls, action: Literal["provoke", "delete", "rewrite"] = "provoke", **kwargs: Any
    ) -> InterventionResponse:
        """Create a response for Loki mode.

        Args:
            action: The action type (default: "provoke").
            **kwargs: Additional arguments passed to create().

        Returns:
            An InterventionResponse with source="loki".
        """
        return cls.create(action=action, source="loki", **kwargs)


class InterventionResponseBuilder:
    """Fluent builder for InterventionResponse instances.

    Provides a chainable interface for constructing intervention
    responses with custom values and validation.

    Example:
        >>> response = (
        ...     InterventionResponseBuilder()
        ...     .with_action("rewrite")
        ...     .with_content("新的内容")
        ...     .with_range(100, 120)
        ...     .for_muse()
        ...     .build()
        ... )
    """

    def __init__(self) -> None:
        """Initialize builder with default values."""
        self.action: Literal["provoke", "delete", "rewrite"] = "provoke"
        self.content: str | None = InterventionResponseFactory.DEFAULT_CONTENT
        self.lock_id: str | None = (
            f"{InterventionResponseFactory.DEFAULT_LOCK_ID_PREFIX}{uuid.uuid4()}"
        )
        self.anchor: AnchorPos | AnchorRange = AnchorPos(from_=0)
        self.action_id: str = (
            f"{InterventionResponseFactory.DEFAULT_ACTION_ID_PREFIX}{uuid.uuid4()}"
        )
        self.source: Literal["muse", "loki"] = "muse"
        self.issued_at: datetime = datetime.now(UTC)

    def with_action(self, action: Literal["provoke", "delete", "rewrite"]) -> Self:
        """Set the action type.

        Automatically adjusts related fields based on action type.

        Args:
            action: The intervention action.

        Returns:
            Self for method chaining.
        """
        self.action = action
        if action == "delete":
            self.content = None
            self.lock_id = None
            if isinstance(self.anchor, AnchorPos):
                self.anchor = AnchorRange(from_=0, to=10)
        return self

    def with_content(self, content: str | None) -> Self:
        """Set the content text.

        Args:
            content: The content (required for provoke/rewrite).

        Returns:
            Self for method chaining.
        """
        self.content = content
        return self

    def with_lock_id(self, lock_id: str | None) -> Self:
        """Set the lock identifier.

        Args:
            lock_id: The lock ID (required for provoke/rewrite).

        Returns:
            Self for method chaining.
        """
        self.lock_id = lock_id
        return self

    def with_anchor(self, anchor: AnchorPos | AnchorRange) -> Self:
        """Set the target anchor.

        Args:
            anchor: The position or range anchor.

        Returns:
            Self for method chaining.
        """
        self.anchor = anchor
        return self

    def with_pos(self, position: int) -> Self:
        """Set a position anchor.

        Args:
            position: The cursor position.

        Returns:
            Self for method chaining.
        """
        self.anchor = AnchorPos(from_=position)
        return self

    def with_range(self, from_pos: int, to_pos: int) -> Self:
        """Set a range anchor.

        Args:
            from_pos: Range start position.
            to_pos: Range end position.

        Returns:
            Self for method chaining.
        """
        self.anchor = AnchorRange(from_=from_pos, to=to_pos)
        return self

    def with_action_id(self, action_id: str) -> Self:
        """Set the action identifier.

        Args:
            action_id: The unique action ID.

        Returns:
            Self for method chaining.
        """
        self.action_id = action_id
        return self

    def for_muse(self) -> Self:
        """Set source to Muse mode.

        Returns:
            Self for method chaining.
        """
        self.source = "muse"
        return self

    def for_loki(self) -> Self:
        """Set source to Loki mode.

        Returns:
            Self for method chaining.
        """
        self.source = "loki"
        return self

    def with_timestamp(self, timestamp: datetime) -> Self:
        """Set the issued timestamp.

        Args:
            timestamp: The timestamp.

        Returns:
            Self for method chaining.
        """
        self.issued_at = timestamp
        return self

    def provoke(self) -> Self:
        """Set action to provoke with default settings.

        Returns:
            Self for method chaining.
        """
        self.action = "provoke"
        if self.content is None:
            self.content = InterventionResponseFactory.DEFAULT_CONTENT
        if self.lock_id is None:
            self.lock_id = f"{InterventionResponseFactory.DEFAULT_LOCK_ID_PREFIX}{uuid.uuid4()}"
        if isinstance(self.anchor, AnchorRange):
            self.anchor = AnchorPos(from_=self.anchor.from_)
        return self

    def delete(self, from_pos: int = 0, to_pos: int = 10) -> Self:
        """Set action to delete with a range anchor.

        Args:
            from_pos: Range start position (default: 0).
            to_pos: Range end position (default: 10).

        Returns:
            Self for method chaining.
        """
        self.action = "delete"
        self.content = None
        self.lock_id = None
        self.anchor = AnchorRange(from_=from_pos, to=to_pos)
        return self

    def rewrite(self, content: str, from_pos: int = 0, to_pos: int = 10) -> Self:
        """Set action to rewrite with content and range.

        Args:
            content: The replacement text.
            from_pos: Range start position (default: 0).
            to_pos: Range end position (default: 10).

        Returns:
            Self for method chaining.
        """
        self.action = "rewrite"
        self.content = content
        self.lock_id = f"{InterventionResponseFactory.DEFAULT_LOCK_ID_PREFIX}{uuid.uuid4()}"
        self.anchor = AnchorRange(from_=from_pos, to=to_pos)
        return self

    def build(self) -> InterventionResponse:
        """Build the InterventionResponse instance.

        Returns:
            A validated InterventionResponse with configured values.
        """
        return InterventionResponse(
            action=self.action,
            content=self.content,
            lock_id=self.lock_id,
            anchor=self.anchor,
            action_id=self.action_id,
            source=self.source,
            issued_at=self.issued_at,
        )


def create_intervention_pair(
    mode: Literal["muse", "loki"] = "muse",
    action: Literal["provoke", "delete", "rewrite"] = "provoke",
) -> tuple[InterventionRequest, InterventionResponse]:
    """Create a matching request-response pair.

    Convenience function to create both a request and response
    that are consistent with each other.

    Args:
        mode: The intervention mode (default: "muse").
        action: The response action (default: "provoke").

    Returns:
        Tuple of (InterventionRequest, InterventionResponse).

    Example:
        >>> request, response = create_intervention_pair("loki", "delete")
        ... assert request.mode == response.source
    """
    request = InterventionRequestFactory.create(mode=mode)
    response = InterventionResponseFactory.create(action=action, source=mode)
    return request, response
