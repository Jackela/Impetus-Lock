import { useCallback, useRef, useState } from "react";
import { exportMarkdown, exportPdf } from "../services/exportService";

function wrapInHtml(content: string): string {
  const escaped = content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { margin: 0; color: #1e1e1e; background: #fff; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 16px/1.6 ui-monospace, Menlo, Consolas, monospace; }
</style>
</head>
<body><pre>${escaped}</pre></body>
</html>`;
}

/**
 * Downloads the current draft and reports a recoverable error for a failed attempt.
 *
 * @param content - Current Markdown draft
 * @param htmlContent - Optional pre-rendered content for PDF
 * @returns Download callback, progress state, and current error
 */
export function useDocumentExport(content: string, htmlContent?: string) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const download = useCallback(
    async (format: "Markdown" | "PDF", filename: string) => {
      if (running.current) return false;
      running.current = true;
      setIsExporting(true);
      setError(null);
      try {
        if (format === "PDF") {
          await exportPdf({ html: htmlContent || wrapInHtml(content), filename });
        } else {
          exportMarkdown(content, filename);
        }
        return true;
      } catch {
        setError(`Could not export ${format}. Retry the download.`);
        return false;
      } finally {
        running.current = false;
        setIsExporting(false);
      }
    },
    [content, htmlContent]
  );

  return { download, isExporting, error };
}
