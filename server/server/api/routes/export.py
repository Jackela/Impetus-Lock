"""Export endpoints for document conversion.

Article III (TDD): Endpoints will be tested via pytest
Article V (Documentation): All endpoints documented
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from server.application.services.export_service import (
    PDFExportService,
    DOCXExportService,
)

router = APIRouter(prefix="/export", tags=["export"])


class ExportRequest(BaseModel):
    """Request model for document export.

    Attributes:
        content: Markdown content to export
        title: Document title (optional)
        format: Export format ('pdf' or 'docx')
    """

    content: str
    title: str = "Document"
    format: str = "pdf"


@router.post("/pdf")
async def export_to_pdf(request: ExportRequest) -> Response:
    """Export document to PDF format.

    Args:
        request: Export request with content and title

    Returns:
        PDF file as response

    Raises:
        HTTPException: If export fails or libraries missing
    """
    try:
        service = PDFExportService()
        pdf_bytes = service.export_to_pdf(request.content, request.title)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{request.title}.pdf"'
            },
        )
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="PDF export unavailable. Required libraries not installed.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF export failed: {str(e)}",
        ) from e


@router.post("/docx")
async def export_to_docx(request: ExportRequest) -> Response:
    """Export document to DOCX format.

    Args:
        request: Export request with content and title

    Returns:
        DOCX file as response

    Raises:
        HTTPException: If export fails or libraries missing
    """
    try:
        service = DOCXExportService()
        docx_bytes = service.export_to_docx(request.content, request.title)

        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{request.title}.docx"'
            },
        )
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="DOCX export unavailable. Required libraries not installed.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DOCX export failed: {str(e)}",
        ) from e
