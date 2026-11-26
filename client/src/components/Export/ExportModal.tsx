import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDocumentExport } from "../../hooks/useDocumentExport";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./ExportModal.css";

/** Props controlling the export modal's visibility, content, and dismissal. */
export interface ExportModalProps {
  open: boolean;
  content: string;
  htmlContent?: string;
  onClose: () => void;
}

/**
 * Modal exporting the current document as Markdown or PDF.
 *
 * @param root0 - Component props
 * @param root0.open - Whether the modal is shown
 * @param root0.content - Markdown content to export
 * @param root0.htmlContent - Optional pre-rendered HTML content
 * @param root0.onClose - Callback to close the modal
 * @returns The rendered export modal
 */
export function ExportModal({ open, ...props }: ExportModalProps) {
  return open ? <ExportDialog {...props} /> : null;
}

function ExportDialog({ content, htmlContent, onClose }: Omit<ExportModalProps, "open">) {
  const [filename, setFilename] = useState("impetus-export");
  const [isExiting, setIsExiting] = useState(false);
  const { download, isExporting, error } = useDocumentExport(content, htmlContent);
  const isExitingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { ref: dialogRef } = useFocusTrap<HTMLDivElement>({ active: true });

  useLayoutEffect(() => {
    isExitingRef.current = false;
    return () => {
      isExitingRef.current = true;
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    };
  }, []);

  const close = useCallback(() => {
    if (!isExitingRef.current) {
      isExitingRef.current = true;
      setIsExiting(true);
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        onClose();
      }, 150);
    }
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (!isExporting) close();
  }, [close, isExporting]);

  const handleDownload = async (format: "Markdown" | "PDF") => {
    if (isExitingRef.current) return;
    const trimmed = filename.trim() || "impetus-export";
    if (await download(format, trimmed)) close();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  return (
    <div
      ref={dialogRef}
      className={`export-modal-overlay${isExiting ? " modal-exit" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
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
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isExporting}
              placeholder="impetus-export"
              data-testid="export-filename-input"
            />
            <span className="filename-hint">Suffix (.md / .pdf) added automatically</span>
          </div>
        </div>

        {error && <p role="alert">{error}</p>}

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
            onClick={() => void handleDownload("Markdown")}
            disabled={isExporting}
            data-testid="export-markdown"
          >
            Export Markdown
          </button>
          <button
            type="button"
            className="export-button pdf"
            onClick={() => void handleDownload("PDF")}
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
