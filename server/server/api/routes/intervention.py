"""Intervention API Routes.

POST /api/v1/impetus/generate-intervention endpoint.
Handles request validation, idempotency, and delegates to service layer.

Constitutional Compliance:
- Article IV (SOLID): SRP - Endpoint handles HTTP only, delegates to InterventionService
- Article V (Documentation): Complete Google-style docstrings
"""

import os
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from server.application.services.intervention_service import InterventionService
from server.domain.models.intervention import InterventionRequest, InterventionResponse
from server.infrastructure.cache.idempotency_cache import IdempotencyCache
from server.infrastructure.llm.instructor_provider import InstructorLLMProvider

router = APIRouter(prefix="/api/v1/impetus", tags=["intervention"])

# Global instances (singleton pattern for P1)
# In production, use proper dependency injection framework
_idempotency_cache = IdempotencyCache(ttl=15)
_llm_provider = None
_intervention_service = None


def get_intervention_service() -> InterventionService:
    """Dependency injection for InterventionService.

    Lazy initialization with singleton pattern.

    Returns:
        InterventionService: Service instance with LLM provider.

    Raises:
        HTTPException: If OPENAI_API_KEY not configured.
    """
    global _llm_provider, _intervention_service

    if _intervention_service is None:
        # Get OpenAI API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "ConfigurationError",
                    "message": "OPENAI_API_KEY not configured in environment",
                },
            )

        # Initialize LLM provider
        _llm_provider = InstructorLLMProvider(
            api_key=api_key,
            model=os.getenv("OPENAI_MODEL", "gpt-4"),
            temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.9")),
        )

        # Initialize service with dependency injection (DIP)
        _intervention_service = InterventionService(llm_provider=_llm_provider)

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
def generate_intervention(
    request: InterventionRequest,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
    contract_version: Annotated[str, Header(alias="X-Contract-Version")],
    service: InterventionService = Depends(get_intervention_service),
) -> InterventionResponse:
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
    # Validate contract version
    if contract_version != "1.0.1":
        raise HTTPException(
            status_code=422,
            detail={
                "error": "ContractVersionMismatch",
                "message": f"Unsupported contract version: {contract_version}. Expected: 1.0.1",
            },
        )

    # Check idempotency cache
    cached_response = _idempotency_cache.get(idempotency_key)
    if cached_response is not None:
        # Return cached response (within 15s window)
        # Type assertion: we know this is InterventionResponse from our cache
        from typing import cast

        return cast(InterventionResponse, cached_response)

    try:
        # Delegate to service layer (SRP - endpoint handles HTTP only)
        response = service.generate_intervention(request)

        # Cache response for idempotency
        _idempotency_cache.set(idempotency_key, response)

        return response

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
