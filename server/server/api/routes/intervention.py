"""Intervention API Routes.

POST /api/v1/impetus/generate-intervention endpoint.
Handles request validation, idempotency, and delegates to service layer.

Constitutional Compliance:
- Article IV (SOLID): SRP - Endpoint handles HTTP only, delegates to InterventionService
- Article V (Documentation): Complete Google-style docstrings
"""

import logging
from typing import Annotated, cast
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from server.application.services.intervention_service import InterventionService
from server.domain.errors import LLMProviderError
from server.domain.models.intervention import InterventionRequest, InterventionResponse
from server.infrastructure.cache.idempotency_cache import IdempotencyCache
from server.infrastructure.llm.provider_registry import ProviderOverride, ProviderRegistry
from server.api.dependencies import get_task_repository
from server.infrastructure.persistence.database import get_session_optional
from server.domain.repositories.task_repository import TaskRepository
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/impetus", tags=["intervention"])
logger = logging.getLogger(__name__)

# Global instances (singleton pattern for P1)
# In production, use proper dependency injection framework
_idempotency_cache = IdempotencyCache(ttl=15)
_provider_registry = ProviderRegistry()
_intervention_service = None
SERVER_CONTRACT_VERSION = "1.0.1"


def get_intervention_service() -> InterventionService:
    """Dependency injection for InterventionService.

    Lazy initialization with singleton pattern.

    Returns:
        InterventionService: Service instance with LLM provider.
    """
    global _intervention_service

    if _intervention_service is None:
        default_provider = _provider_registry.get_provider(allow_blank=True)
        _intervention_service = InterventionService(llm_provider=default_provider)

    return _intervention_service


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
    service: InterventionService = Depends(get_intervention_service),
) -> InterventionResponse | JSONResponse:
    """Generate AI intervention action based on context and mode.
    
    Implements idempotency via Idempotency-Key header (15s cache).
    Validates contract version for API compatibility.
    
    Args:
        request: Intervention request payload (context, mode, client_meta).
        idempotency_key: UUID v4 for deduplication (required header).
        contract_version: API contract version (must be "1.0.1").
        service: InterventionService instance (dependency injection).
    
    Returns:
        InterventionResponse: Generated intervention action.
    
    Raises:
        HTTPException 422: If contract_version mismatch or validation fails.
        HTTPException 500: If LLM provider fails.
    
    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/impetus/generate-intervention \
          -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
          -H "X-Contract-Version: 1.0.1" \
          -H "Content-Type: application/json" \
          -d '{
            "context": "他打开门，犹豫着要不要进去。",
            "mode": "muse",
            "client_meta": {"doc_version": 42, "selection_from": 1234, "selection_to": 1234}
          }'
        ```
    """
    # Validate contract version (accepts missing or older minor versions)
    if contract_version:
        client_major = contract_version.split(".")[0]
        server_major = SERVER_CONTRACT_VERSION.split(".")[0]
        if client_major != server_major:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "ContractVersionMismatch",
                    "message": (
                        f"Unsupported contract version: {contract_version}. "
                        f"Expected major: {server_major}"
                    ),
                    "server_version": SERVER_CONTRACT_VERSION,
                },
            )

    # Check idempotency cache
    cached_response = _idempotency_cache.get(idempotency_key)
    if cached_response is not None:
        # Return cached response (within 15s window)
        response.headers["X-Contract-Version"] = SERVER_CONTRACT_VERSION
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
        provider = _provider_registry.get_provider(
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
        _idempotency_cache.set(idempotency_key, intervention_response)

        response.headers["X-Contract-Version"] = SERVER_CONTRACT_VERSION

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
