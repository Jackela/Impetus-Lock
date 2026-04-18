import { useCallback, useEffect, useRef, useState } from "react";
// eslint-disable-next-line no-restricted-imports
import { exportMarkdown, exportPdf } from "../../services/exportService";
import "./ExportModal.css";

export interface ExportModalProps {
  open: boolean;
  content: string;
  htmlContent?: string;
  onClose: () => void;
}

function wrapInHtml(content: string): string {
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: system-ui, -apple-system, sans-serif; padding: 2rem; line-height: 1.6; color: #1e1e1e; background: #fff; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
</style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;
}

export function ExportModal({ open, content, htmlContent, onClose }: ExportModalProps) {
  const [filename, setFilename] = useState("impetus-export");
  const [isExiting, setIsExiting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const isExitingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setIsExiting(false);
      isExitingRef.current = false;
      setFilename("impetus-export");
      setIsExporting(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (!isExporting && !isExitingRef.current) {
      isExitingRef.current = true;
      setIsExiting(true);
      setTimeout(() => {
        setFilename("impetus-export");
        setIsExporting(false);
        onClose();
      }, 150);
    }
  }, [isExporting, onClose]);

  const handleExportMarkdown = useCallback(() => {
    const trimmed = filename.trim() || "impetus-export";
    exportMarkdown(content, trimmed);
    handleClose();
  }, [content, filename, handleClose]);

  const handleExportPdf = useCallback(async () => {
    const trimmed = filename.trim() || "impetus-export";
    const html = htmlContent || wrapInHtml(content);
    setIsExporting(true);
    try {
      await exportPdf({ html, filename: trimmed });
    } finally {
      setIsExporting(false);
      handleClose();
    }
  }, [content, htmlContent, filename, handleClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !isExitingRef.current) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={`export-modal-overlay${isExiting ? " modal-exit" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isExporting && !isExitingRef.current) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      data-testid="export-modal"
    >
      <div className="export-modal">
        <h2 id="export-modal-title">Export Document</h2>

        <div className="export-form">
          <div className="form-group">
            <label htmlFor="export-filename">Filename</label>
            <input
              id="export-filename"
              type="text"
              autoFocus
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isExporting}
              placeholder="impetus-export"
              data-testid="export-filename-input"
            />
            <span className="filename-hint">Suffix (.md / .pdf) added automatically</span>
          </div>
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={handleClose}
            disabled={isExporting}
            data-testid="export-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="export-button markdown"
            onClick={handleExportMarkdown}
            disabled={isExporting}
            data-testid="export-markdown"
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="export-button pdf"
            onClick={handleExportPdf}
            disabled={isExporting}
            data-testid="export-pdf"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
