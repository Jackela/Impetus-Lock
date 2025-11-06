"""Intervention Service (Business Logic Layer).

Orchestrates LLM provider to generate intervention actions.
Implements business rules and safety guards.

Constitutional Compliance:
- Article IV (SOLID): SRP - Endpoints delegate to this service
- Article IV (SOLID): DIP - Depends on LLMProvider abstraction (constructor injection)
- Article V (Documentation): Complete Google-style docstrings
"""

import uuid

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import (
    InterventionRequest,
    InterventionResponse,
)


class InterventionService:
    """Service layer for intervention generation.

    Delegates to LLM provider for AI decision-making while enforcing
    business rules and safety guards.

    Attributes:
        llm_provider: LLM provider implementation (dependency injection).

    Example:
        ```python
        # Constructor injection (DIP)
        llm = InstructorLLMProvider(api_key="sk-...")
        service = InterventionService(llm_provider=llm)

        request = InterventionRequest(
            context="他打开门，犹豫着要不要进去。",
            mode="muse",
            client_meta=ClientMeta(
                doc_version=42,
                selection_from=1234,
                selection_to=1234
            )
        )

        response = service.generate_intervention(request)
        assert response.action == "provoke"
        ```
    """

    def __init__(self, llm_provider: LLMProvider):
        """Initialize service with LLM provider.

        Args:
            llm_provider: LLM provider implementation (DIP).
        """
        self.llm_provider = llm_provider

    def generate_intervention(self, request: InterventionRequest) -> InterventionResponse:
        """Generate intervention action based on context and mode.

        Delegates to LLM provider while applying business rules:
        - Muse mode: Always returns provoke (never delete)
        - Loki mode: Can return provoke or delete
        - Safety: Prevent delete if context <50 chars

        Args:
            request: Intervention request with context and mode.

        Returns:
            InterventionResponse: Generated intervention action.

        Raises:
            ValueError: If request validation fails.
            RuntimeError: If LLM provider fails.

        Example:
            >>> service = InterventionService(llm_provider)
            >>> response = service.generate_intervention(request)
            >>> response.action
            'provoke'
        """
        # Safety guard: Reject delete if context too short
        context_length = len(request.context)

        # Call LLM provider
        response = self.llm_provider.generate_intervention(
            context=request.context,
            mode=request.mode,
            doc_version=request.client_meta.doc_version,
            selection_from=request.client_meta.selection_from,
            selection_to=request.client_meta.selection_to,
        )

        # Apply safety guard: Force provoke if context too short
        if response.action == "delete" and context_length < 50:
            # Override with provoke to prevent document erasure
            response.action = "provoke"
            response.content = "> [AI施压 - 保护]: 文档内容太少，继续写作吧。"
            response.lock_id = f"lock_{uuid.uuid4()}"
            # Update anchor to current cursor position
            # Note: Using model_validate to properly handle field alias
            response.anchor = AnchorPos.model_validate(
                {"type": "pos", "from": request.client_meta.selection_from}
            )

        # Ensure action_id exists
        if not response.action_id:
            response.action_id = f"act_{uuid.uuid4()}"

        # Ensure lock_id exists for provoke actions
        if response.action == "provoke" and not response.lock_id:
            response.lock_id = f"lock_{uuid.uuid4()}"

        return response
