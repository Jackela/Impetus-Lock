import { useState } from "react";
import { useAccountExport, type AccountExportData } from "../../hooks/useAccountExport";

/**
 * Footer panel exporting tasks and stats as Markdown or JSON downloads.
 *
 * @returns The rendered export panel with format selector
 */
export function Export() {
  const { canExport, exporting, error, exportAccountData } = useAccountExport();
  const [format, setFormat] = useState<"json" | "markdown">("markdown");

  const exportData = async () => {
    await exportAccountData(({ tasks, stats }) => {
      if (format === "json") {
        const blob = new Blob([JSON.stringify({ tasks, stats }, null, 2)], {
          type: "application/json",
        });
        downloadBlob(blob, `impetus-export-${Date.now()}.json`);
      } else {
        const md = generateMarkdown(tasks.tasks, stats);
        const blob = new Blob([md], { type: "text/markdown" });
        downloadBlob(blob, `impetus-export-${Date.now()}.md`);
      }
    });
  };

  return (
    <div className="export-panel">
      <h3>Export Data</h3>
      <select
        aria-label="Export format"
        disabled={exporting || !canExport}
        value={format}
        onChange={(e) => setFormat(e.target.value as "json" | "markdown")}
      >
        <option value="markdown">Markdown</option>
        <option value="json">JSON</option>
      </select>
      <button onClick={exportData} disabled={exporting || !canExport}>
        {exporting ? "Exporting..." : "Export"}
      </button>
      {!canExport && (
        <p>Account data export is paused. Sign in or check your session to continue.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateMarkdown(
  tasks: AccountExportData["tasks"]["tasks"],
  stats: AccountExportData["stats"]
) {
  let md = "# Impetus Lock Export\n\n";
  md += "## Statistics\n\n";
  md += `- Total Tasks: ${stats.total_tasks}\n`;
  md += `- Muse Interventions: ${stats.total_muse_interventions}\n`;
  md += `- Loki Interventions: ${stats.total_loki_interventions}\n`;
  md += `- Locks Created: ${stats.total_locks_created}\n`;
  md += `- Writing Minutes: ${stats.writing_minutes}\n\n`;
  md += "## Tasks\n\n";
  for (const task of tasks) {
    md += `### ${task.title || "Untitled"}\n`;
    md += `${task.content}\n\n`;
    md += `- Created: ${task.created_at}\n`;
    md += `- Version: ${task.version}\n\n`;
  }
  return md;
}
