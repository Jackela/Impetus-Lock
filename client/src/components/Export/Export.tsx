import { useState } from "react";
// eslint-disable-next-line no-restricted-imports
import { fetchTasks } from "../../services/api/taskClient";
// eslint-disable-next-line no-restricted-imports
import { fetchStats } from "../../services/api/statsClient";

export function Export() {
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<"json" | "markdown">("markdown");

  const exportData = async () => {
    setExporting(true);
    try {
      const [tasks, stats] = await Promise.all([fetchTasks(), fetchStats()]);

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
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <h3>Export Data</h3>
      <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "markdown")}>
        <option value="markdown">Markdown</option>
        <option value="json">JSON</option>
      </select>
      <button onClick={exportData} disabled={exporting}>
        {exporting ? "Exporting..." : "Export"}
      </button>
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
  tasks: Awaited<ReturnType<typeof fetchTasks>>["tasks"],
  stats: Awaited<ReturnType<typeof fetchStats>>
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
