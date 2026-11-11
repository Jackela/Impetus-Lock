/**
 * Export Service
 *
 * Handles Markdown and PDF export of document content.
 *
 * The PDF stack (jsPDF + html2canvas, several hundred kB) is imported on the
 * first PDF export so it never lands in the initial bundle.
 *
 * @module services/exportService
 */

/**
 * Loads the PDF rendering dependencies on demand.
 *
 * @returns The html2canvas function and jsPDF constructor
 */
async function loadPdfDependencies(): Promise<{
  html2canvas: typeof import("html2canvas").default;
  jsPDF: typeof import("jspdf").default;
}> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  return { html2canvas, jsPDF };
}

/**
 * Export content as a Markdown file download.
 *
 * @param content - Markdown content to export
 * @param filename - Name of the downloaded file (without extension)
 */
export function exportMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export HTML content as a PDF download using html2canvas + jsPDF.
 *
 * @param options - Export configuration
 * @param options.element - Optional DOM element to capture
 * @param options.html - Optional HTML string to render and capture
 * @param options.filename - Name of the downloaded file (without extension)
 */
export async function exportPdf(options: {
  element?: HTMLElement;
  html?: string;
  filename: string;
}): Promise<void> {
  const { element, html, filename } = options;

  let target = element;

  if (!target && html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "800px";
    document.body.appendChild(container);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    target = container;
  }

  if (!target) {
    throw new Error("Either element or html must be provided");
  }

  const { html2canvas, jsPDF } = await loadPdfDependencies();

  const canvas = await html2canvas(target, {
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxWidth = pageWidth - margin * 2;

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(maxWidth / imgWidth, pageHeight / imgHeight);
  const pdfWidth = imgWidth * ratio;
  const pdfHeight = imgHeight * ratio;

  const x = margin + (maxWidth - pdfWidth) / 2;
  const y = margin;

  pdf.addImage(imgData, "PNG", x, y, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);

  if (html && target.parentNode) {
    document.body.removeChild(target);
  }
}
