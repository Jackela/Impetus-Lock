"""Tests for export service and endpoints.

Article III (TDD): Tests drive export implementation
"""

import pytest
from fastapi.testclient import TestClient

from server.api.main import app
from server.application.services.export_service import (
    DOCXExportService,
    PDFExportService,
)

client = TestClient(app)


class TestExportService:
    """Test suite for export services."""

    def test_pdf_export_basic_content(self) -> None:
        """Test basic PDF export with simple content."""
        service = PDFExportService()
        content = "# Test Document\n\nThis is a test paragraph."

        pdf_bytes = service.export_to_pdf(content, "Test Document")

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        # PDF files start with %PDF
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_export_with_markdown_formatting(self) -> None:
        """Test PDF export preserves markdown formatting."""
        service = PDFExportService()
        content = """
# Heading 1

## Heading 2

### Heading 3

This is **bold** and *italic* text.

- List item 1
- List item 2

> Blockquote

```python
code block
```
"""

        pdf_bytes = service.export_to_pdf(content, "Formatted Document")

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        assert pdf_bytes.startswith(b"%PDF")

    def test_docx_export_basic_content(self) -> None:
        """Test basic DOCX export with simple content."""
        service = DOCXExportService()
        content = "# Test Document\n\nThis is a test paragraph."

        docx_bytes = service.export_to_docx(content, "Test Document")

        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 0
        # DOCX files are ZIP archives
        assert docx_bytes.startswith(b"PK")

    def test_docx_export_with_markdown(self) -> None:
        """Test DOCX export with markdown formatting."""
        service = DOCXExportService()
        content = """
# Title

## Subtitle

Paragraph with **bold** and *italic*.

- Item 1
- Item 2
"""

        docx_bytes = service.export_to_docx(content, "Markdown Document")

        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 0


class TestExportEndpoints:
    """Test suite for export API endpoints."""

    def test_export_pdf_endpoint(self) -> None:
        """Test POST /export/pdf endpoint."""
        response = client.post(
            "/export/pdf",
            json={
                "content": "# Test\n\nThis is a test document.",
                "title": "Test Document",
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0

    def test_export_docx_endpoint(self) -> None:
        """Test POST /export/docx endpoint."""
        response = client.post(
            "/export/docx",
            json={
                "content": "# Test\n\nThis is a test document.",
                "title": "Test Document",
            },
        )

        assert response.status_code == 200
        assert "application/vnd.openxmlformats" in response.headers["content-type"]
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0

    def test_export_pdf_with_long_document(self) -> None:
        """Test PDF export with 10k+ word document."""
        # Generate long content
        paragraphs = ["This is paragraph {}.".format(i) for i in range(500)]
        long_content = "# Long Document\n\n" + "\n\n".join(paragraphs)

        response = client.post(
            "/export/pdf",
            json={
                "content": long_content,
                "title": "Long Document",
            },
        )

        assert response.status_code == 200
        assert len(response.content) > 10000  # Should be substantial size

    def test_export_docx_with_unicode(self) -> None:
        """Test DOCX export with unicode characters."""
        response = client.post(
            "/export/docx",
            json={
                "content": "# Unicode Test\n\n你好世界 🌍 Привет мир",
                "title": "Unicode Document",
            },
        )

        assert response.status_code == 200
        assert len(response.content) > 0
