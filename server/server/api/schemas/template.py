"""Template API Schema definitions.

Pydantic models for Template API request/response validation.
"""

from pydantic import BaseModel, Field


class TemplateCreateRequest(BaseModel):
    """Request schema for creating a template."""

    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(default="", max_length=100000)


class TemplateResponse(BaseModel):
    """Response schema for template."""

    id: str
    name: str
    content: str
    user_id: str
    created_at: str
    updated_at: str


class TemplateListResponse(BaseModel):
    """Response schema for template list."""

    total: int
    limit: int
    offset: int
    templates: list[TemplateResponse]
