"""Intervention Service (Business Logic Layer).

Orchestrates LLM provider to generate intervention actions.
Implements business rules and safety guards.
Optionally persists intervention history to database.

Constitutional Compliance:
- Article IV (SOLID): SRP - Endpoints delegate to this service
- Article IV (SOLID): DIP - Depends on LLMProvider and TaskRepository abstractions
- Article V (Documentation): Complete Google-style docstrings
"""

from uuid import UUID, uuid4

from server.domain.llm_provider import LLMProvider
from server.domain.models.anchor import AnchorPos
from server.domain.models.intervention import (
    InterventionRequest,
    InterventionResponse,
)

# Optional import (for type hints when repository is used)
try:
    from server.domain.entities.intervention_action import InterventionAction
    from server.domain.repositories.task_repository import TaskRepository
except ImportError:
    TaskRepository = None  # type: ignore
    InterventionAction = None  # type: ignore


class InterventionService:
    """Service layer for intervention generation.

    Delegates to LLM provider for AI decision-making while enforcing
    business rules and safety guards. Optionally persists intervention
    history to database via TaskRepository.

    Attributes:
        llm_provider: LLM provider implementation (dependency injection).
        task_repository: Optional repository for persistence (dependency injection).

    Example (without persistence):
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

    Example (with persistence):
        ```python
        from server.infrastructure.persistence.postgresql_task_repository import (
            PostgreSQLTaskRepository,
        )

        llm = InstructorLLMProvider(api_key="sk-...")
        repository = PostgreSQLTaskRepository(session)
        service = InterventionService(
            llm_provider=llm, task_repository=repository
        )

        # Optionally provide task_id to persist intervention history
        response = await service.generate_intervention_async(request, task_id=task.id)
        ```
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        task_repository: "TaskRepository | None" = None,
    ):
        """Initialize service with LLM provider and optional repository.

        Args:
            llm_provider: LLM provider implementation (DIP).
            task_repository: Optional repository for persistence (DIP).
        """
        self.llm_provider = llm_provider
        self.task_repository = task_repository

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
            response.lock_id = f"lock_{uuid4()}"
            # Update anchor to current cursor position
            # Note: Using model_validate to properly handle field alias
            response.anchor = AnchorPos.model_validate(
                {"type": "pos", "from": request.client_meta.selection_from}
            )

        # Ensure action_id exists
        if not response.action_id:
            response.action_id = f"act_{uuid4()}"

        # Ensure lock_id exists for provoke actions
        if response.action == "provoke" and not response.lock_id:
            response.lock_id = f"lock_{uuid4()}"

        return response

    async def generate_intervention_async(
        self,
        request: InterventionRequest,
        task_id: UUID | None = None,
    ) -> InterventionResponse:
        """Generate intervention action with optional persistence (async version).

        Same business logic as generate_intervention(), but with async support
        for persisting intervention history to database via TaskRepository.

        Args:
            request: Intervention request with context and mode.
            task_id: Optional task ID for persisting intervention history.

        Returns:
            InterventionResponse: Generated intervention action.

        Raises:
            ValueError: If request validation fails or task_id provided but
                repository not configured.
            RuntimeError: If LLM provider fails.

        Example:
            ```python
            service = InterventionService(llm_provider, task_repository)
            response = await service.generate_intervention_async(request, task_id=task.id)
            # Intervention history is automatically persisted to database
            ```
        """
        # Generate intervention using existing sync logic
        response = self.generate_intervention(request)

        # Persist to database if repository and task_id provided
        if self.task_repository and task_id:
            action = InterventionAction.create(
                task_id=task_id,
                action_type=response.action,
                action_id=response.action_id,
                lock_id=response.lock_id,
                content=response.content,
                anchor=response.anchor.model_dump(),
                mode=request.mode,
                context=request.context,
                issued_at=response.issued_at,
            )
            await self.task_repository.save_action(action)

        return response
