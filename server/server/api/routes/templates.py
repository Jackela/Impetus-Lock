"""Template management API routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from server.api.schemas.template import (
    TemplateCreateRequest,
    TemplateListResponse,
    TemplateResponse,
)
from server.auth import get_current_user
from server.infrastructure.persistence.database import get_session_optional
from server.models.template import Template
from server.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TemplateListResponse:
    """List all templates for current user."""
    from sqlalchemy import func, select

    if not session:
        return TemplateListResponse(total=0, limit=limit, offset=offset, templates=[])

    stmt = select(func.count(Template.id)).where(Template.user_id == current_user.id)
    total = (await session.execute(stmt)).scalar_one_or_none() or 0

    stmt = (
        select(Template)
        .where(Template.user_id == current_user.id)
        .order_by(Template.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await session.execute(stmt)
    templates = result.scalars().all()

    return TemplateListResponse(
        total=total,
        limit=limit,
        offset=offset,
        templates=[
            TemplateResponse(
                id=str(t.id),
                name=t.name,
                content=t.content,
                user_id=str(t.user_id),
                created_at=t.created_at.isoformat(),
                updated_at=t.updated_at.isoformat(),
            )
            for t in templates
        ],
    )


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    request: TemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TemplateResponse:
    """Create a new template."""
    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    template = Template(
        name=request.name,
        content=request.content,
        user_id=current_user.id,
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)

    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        content=template.content,
        user_id=str(template.user_id),
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> TemplateResponse:
    """Get template by ID."""
    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    from sqlalchemy import select

    stmt = select(Template).where(
        Template.id == template_id,
        Template.user_id == current_user.id,
    )
    result = await session.execute(stmt)
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateResponse(
        id=str(template.id),
        name=template.name,
        content=template.content,
        user_id=str(template.user_id),
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession | None = Depends(get_session_optional),
) -> None:
    """Delete template."""
    if not session:
        raise HTTPException(status_code=500, detail="Database not available")

    from sqlalchemy import delete

    stmt = delete(Template).where(
        Template.id == template_id,
        Template.user_id == current_user.id,
    )
    await session.execute(stmt)
    await session.commit()
