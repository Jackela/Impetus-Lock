"""LLM Provider Protocol (DIP Abstraction per Article IV)

This protocol defines the abstraction for LLM interactions, enabling dependency
inversion. Concrete implementations (OpenAI, Anthropic, local LLM) can be swapped
without changing service layer code.

Constitutional Compliance:
- Article IV (SOLID): DIP - Services depend on this abstraction, not concrete LLM clients
- Article V (Documentation): Google-style docstrings for all public interfaces
"""

from typing import Literal, Protocol

from server.domain.models.intervention import InterventionResponse


class LLMProvider(Protocol):
    """Protocol for LLM providers that generate structured intervention responses.

    This abstraction allows swapping between different LLM providers (OpenAI,
    Anthropic, local models) without modifying business logic in the service layer.

    Example Usage:
        ```python
        class InterventionService:
            def __init__(self, llm: LLMProvider):
                self.llm = llm  # Constructor injection (DIP)
        ```
    """

    def generate_intervention(
        self,
        context: str,
        mode: Literal["muse", "loki"],
        doc_version: int | None = None,
        selection_from: int | None = None,
        selection_to: int | None = None,
    ) -> InterventionResponse:
        """Generate a structured intervention response based on context and mode.

        Args:
            context: The writing context (e.g., last 3 sentences before cursor).
            mode: Agent mode, either "muse" (STUCK detection) or "loki" (random chaos).
            doc_version: Optional document version number for optimistic locking.
            selection_from: Optional cursor/selection start position.
            selection_to: Optional cursor/selection end position.

        Returns:
            InterventionResponse: Structured response containing action, content,
                lock_id (for provoke), anchor (for delete), and action_id.

        Raises:
            ValueError: If mode is invalid or context is empty.
            RuntimeError: If LLM API call fails.

        Example:
            >>> provider = InstructorLLMProvider(api_key="sk-...")
            >>> response = provider.generate_intervention(
            ...     context="他打开门，犹豫着要不要进去。",
            ...     mode="muse"
            ... )
            >>> response.action
            'provoke'
            >>> response.content
            '> [AI施压 - Muse]: 门后传来低沉的呼吸声。'
        """
        ...
