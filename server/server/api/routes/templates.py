"""Template management API routes.

HTTP adapter for template CRUD. Authentication, request validation,
response schemas and HTTP exception mapping stay here; persistence and
ownership semantics are delegated to the injected user-scoped
TemplateService.

Constitutional Compliance:
- Article IV (SOLID - SRP): Endpoints are HTTP adapters over TemplateService
- Article IV (SOLID - DIP): Depends on the service abstraction
- Article V (Documentation): Complete API documentation
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from server.api.dependencies import get_template_service
from server.api.schemas.template import (
    TemplateCreateRequest,
    TemplateListResponse,
    TemplateResponse,
)
from server.application.services.template_service import (
    TemplateNotFoundError,
    TemplateService,
)
from server.auth import get_current_user
from server.domain.entities.template import Template
from server.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])


def _to_response(template: Template) -> TemplateResponse:
    """Serialize a template domain entity to the API response schema.

    Args:
        template: Template domain entity.

    Returns:
        TemplateResponse: API response model.
    """
    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        content=template.content,
        user_id=str(template.user_id),
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    service: TemplateService | None = Depends(get_template_service),
) -> TemplateListResponse:
    """List all templates for current user.

    Args:
        limit: Maximum number of templates to return (1-100).
        offset: Number of templates to skip.
        current_user: Authenticated user (injected via auth).
        service: User-scoped template service (None when DB unavailable).

    Returns:
        TemplateListResponse: Paginated template list, or the empty response
        when no database session is available.
    """
    if service is None:
        return TemplateListResponse(total=0, limit=limit, offset=offset, templates=[])

    templates, total = await service.list_templates(
        user_id=current_user.id, limit=limit, offset=offset
    )

    return TemplateListResponse(
        total=total,
        limit=limit,
        offset=offset,
        templates=[_to_response(t) for t in templates],
    )


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    request: TemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    service: TemplateService | None = Depends(get_template_service),
) -> TemplateResponse:
    """Create a new template.

    Args:
        request: Template creation request.
        current_user: Authenticated user (injected via auth).
        service: User-scoped template service (None when DB unavailable).

    Returns:
        TemplateResponse: Created template.

    Raises:
        HTTPException: 500 if no database session is available.
    """
    if service is None:
        raise HTTPException(status_code=500, detail="Database not available")

    template = await service.create_template(
        user_id=current_user.id, name=request.name, content=request.content
    )

    return _to_response(template)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TemplateService | None = Depends(get_template_service),
) -> TemplateResponse:
    """Get template by ID.

    Args:
        template_id: Template UUID.
        current_user: Authenticated user (injected via auth).
        service: User-scoped template service (None when DB unavailable).

    Returns:
        TemplateResponse: Template details.

    Raises:
        HTTPException: 404 if template not found or not owned by user.
        HTTPException: 500 if no database session is available.
    """
    if service is None:
        raise HTTPException(status_code=500, detail="Database not available")

    try:
        template = await service.get_template(user_id=current_user.id, template_id=template_id)
    except TemplateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return _to_response(template)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TemplateService | None = Depends(get_template_service),
) -> None:
    """Delete template (no-op for missing or foreign templates).

    Args:
        template_id: Template UUID.
        current_user: Authenticated user (injected via auth).
        service: User-scoped template service (None when DB unavailable).

    Raises:
        HTTPException: 500 if no database session is available.
    """
    if service is None:
        raise HTTPException(status_code=500, detail="Database not available")

    await service.delete_template(user_id=current_user.id, template_id=template_id)
