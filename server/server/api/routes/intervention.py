"""Intervention API Routes.

POST /impetus/generate-intervention endpoint.
Handles request validation, idempotency, and delegates to service layer.

Constitutional Compliance:
- Article IV (SOLID): SRP - Endpoint handles HTTP only, delegates to InterventionService
- Article V (Documentation): Complete Google-style docstrings
"""

import hashlib
import logging
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.dependencies import get_task_repository
from server.application.services.intervention_service import InterventionService
from server.domain.errors import LLMProviderError
from server.domain.llm_provider import LLMProvider
from server.domain.models.intervention import InterventionRequest, InterventionResponse
from server.domain.repositories.task_repository import TaskRepository
from server.infrastructure.cache.idempotency_cache import AsyncIdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderOverride, ProviderRegistry
from server.infrastructure.persistence.database import get_session_optional

router = APIRouter(prefix="/impetus", tags=["intervention"])
logger = logging.getLogger(__name__)

SERVER_CONTRACT_VERSION = "2.0.0"


def get_provider_registry(request: Request) -> ProviderRegistry:
    """Resolve provider registry from app state."""
    resource = getattr(request.app.state, "provider_registry", None)
    if resource is None:
        resource = ProviderRegistry()
        request.app.state.provider_registry = resource
    return resource


def get_idempotency_cache(request: Request) -> AsyncIdempotencyCache:
    """Resolve async idempotency cache from app state."""
    resource = getattr(request.app.state, "idempotency_cache", None)
    if resource is None:
        resource = AsyncIdempotencyCache(ttl=15)
        request.app.state.idempotency_cache = resource
    return resource


def get_default_provider(
    registry: ProviderRegistry = Depends(get_provider_registry),
) -> LLMProvider | None:
    """Resolve default provider allowing blank configuration (used for baseline service)."""

    return registry.get_provider(allow_blank=True)


def get_intervention_service(
    default_provider: LLMProvider | None = Depends(get_default_provider),
) -> InterventionService:
    """Dependency injection for InterventionService."""

    return InterventionService(llm_provider=default_provider)


@router.post(
    "/generate-intervention",
    response_model=InterventionResponse,
    status_code=200,
    responses={
        400: {"description": "Bad Request - Invalid anchor or out of bounds"},
        422: {"description": "Unprocessable Entity - Validation failed"},
        429: {"description": "Too Many Requests - Rate limit exceeded"},
        500: {"description": "Internal Server Error - LLM or backend failure"},
    },
)
async def generate_intervention(
    http_request: Request,
    response: Response,
    request: InterventionRequest,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
    contract_version: Annotated[str | None, Header(alias="X-Contract-Version")] = None,
    provider_header: Annotated[str | None, Header(alias="X-LLM-Provider")] = None,
    model_header: Annotated[str | None, Header(alias="X-LLM-Model")] = None,
    api_key_header: Annotated[str | None, Header(alias="X-LLM-Api-Key")] = None,
    task_id_header: Annotated[str | None, Header(alias="X-Task-Id")] = None,
    repository: TaskRepository = Depends(get_task_repository),
    session: AsyncSession | None = Depends(get_session_optional),
    provider_registry: ProviderRegistry = Depends(get_provider_registry),
    idempotency_cache: AsyncIdempotencyCache = Depends(get_idempotency_cache),
    service: InterventionService = Depends(get_intervention_service),
) -> InterventionResponse | JSONResponse:
    """Generate AI intervention action based on context and mode.
    
    Implements idempotency via Idempotency-Key header (15s cache).
    Validates contract version for API compatibility.
    
    Args:
        request: Intervention request payload (context, mode, client_meta).
        idempotency_key: UUID v4 for deduplication (required header).
        contract_version: API contract version (must be "2.0.0").
        service: InterventionService instance (dependency injection).
    
    Returns:
        InterventionResponse: Generated intervention action.
    
    Raises:
        HTTPException 422: If contract_version mismatch or validation fails.
        HTTPException 500: If LLM provider fails.
    
    Example:
        ```bash
        curl -X POST http://localhost:8000/impetus/generate-intervention \
          -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
          -H "X-Contract-Version: 2.0.0" \
          -H "Content-Type: application/json" \
          -d '{
            "context": "他打开门，犹豫着要不要进去。",
            "mode": "muse",
            "client_meta": {"doc_version": 42, "selection_from": 1234, "selection_to": 1234}
          }'
        ```
    """
    # Validate contract version (exact match, no fallback)
    if contract_version != SERVER_CONTRACT_VERSION:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "ContractVersionMismatch",
                "message": (
                    f"Unsupported contract version: {contract_version}. "
                    f"Expected: {SERVER_CONTRACT_VERSION}"
                ),
                "server_version": SERVER_CONTRACT_VERSION,
            },
        )

    # Check idempotency cache
    cached_response = await idempotency_cache.get(idempotency_key)
    if cached_response is not None:
        # Return cached response (within 15s window)
        response.headers["X-Contract-Version"] = SERVER_CONTRACT_VERSION
        _set_cooldown_header(response, getattr(cached_response, "source", None), idempotency_key)
        return cast(InterventionResponse, cached_response)

    overrides_provided = any(filter(None, [provider_header, model_header, api_key_header]))
    http_request.state.llm_override = overrides_provided
    http_request.state.llm_provider = None
    overrides = (
        ProviderOverride(
            provider=provider_header,
            model=model_header,
            api_key=api_key_header,
        )
        if overrides_provided
        else None
    )

    try:
        provider = provider_registry.get_provider(
            overrides=overrides,
            allow_blank=False,
        )
        if provider is None:
            raise LLMProviderError(
                code="llm_not_configured",
                message="LLM provider unavailable",
                status_code=503,
            )
        http_request.state.llm_provider = getattr(provider, "provider_name", None)
        logger.debug(
            "Resolved LLM provider",
            extra={
                "provider": getattr(provider, "provider_name", "unknown"),
                "override": overrides_provided,
            },
        )

        # Delegate to service layer (SRP - endpoint handles HTTP only)
        intervention_response = await service.generate_intervention_async(
            request,
            task_id=_safe_uuid(task_id_header),
            repository=repository,
            llm_override=provider,
        )

        # Cache response for idempotency
        await idempotency_cache.set(idempotency_key, intervention_response)

        response.headers["X-Contract-Version"] = SERVER_CONTRACT_VERSION
        _set_cooldown_header(response, intervention_response.source, idempotency_key)

        # Commit persistence when applicable
        if session is not None:
            try:
                await session.commit()
            except Exception:
                await session.rollback()
                raise

        return intervention_response

    except LLMProviderError as exc:
        logger.info(
            "LLM provider error",
            extra={"provider": exc.provider, "code": exc.code},
        )
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    except ValueError as e:
        # Validation error from service layer
        raise HTTPException(
            status_code=422,
            detail={
                "error": "ValidationError",
                "message": str(e),
            },
        ) from e

    except RuntimeError as e:
        # LLM provider failure
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "LLM service unavailable",
                "details": {"llm_error": str(e)},
            },
        ) from e


def _safe_uuid(value: str | None) -> UUID | None:
    """Parse UUID string safely, returning None on failure."""

    if value is None:
        return None
    try:
        return UUID(value)
    except ValueError:
        return None


def _set_cooldown_header(response: Response, mode: str | None, idempotency_key: str) -> None:
    """Set cooldown header for Loki mode (used by clients to throttle triggers).

    The value is deterministically derived from Idempotency-Key to keep cached
    responses stable while staying within the 30-120s window expected by the client.
    """

    if mode == "loki":
        cooldown = _compute_cooldown_seconds(idempotency_key)
        response.headers["X-Cooldown-Seconds"] = str(cooldown)


def _compute_cooldown_seconds(idempotency_key: str) -> int:
    """Derive a stable cooldown (30-120s) from the idempotency key."""

    digest = hashlib.md5(idempotency_key.encode("utf-8")).hexdigest()
    value = int(digest, 16) % 91  # 0-90
    return 30 + value  # 30-120 inclusive
