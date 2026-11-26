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
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor.parentElement === document.body) document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

function createExportFrame(): HTMLIFrameElement {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    left: "-9999px",
    top: "0",
    width: "800px",
    height: "0",
    border: "0",
  });
  return frame;
}

/**
 * Measures line boxes so page breaks do not split text across pages.
 *
 * @param target - DOM subtree to render
 * @param targetTop - Viewport position of the top of the subtree
 * @returns Line bounds relative to the subtree, ordered from bottom to top
 */
function measureTextLines(target: HTMLElement, targetTop: number) {
  const page = target.ownerDocument;
  const range = page.createRange();
  const walker = page.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  const lines: { top: number; bottom: number }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of range.getClientRects?.() ?? []) {
      lines.push({
        top: Math.floor(rect.top - targetTop),
        bottom: Math.ceil(rect.bottom - targetTop),
      });
    }
  }
  return lines.sort((first, second) => second.top - first.top);
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
  if (!element && !html) throw new Error("Either element or html must be provided");

  const frame = element ? null : createExportFrame();
  try {
    let target = element;
    if (frame && html) {
      document.body.append(frame);
      const page = frame.contentDocument;
      if (!page) throw new Error("Could not create the PDF document");
      const parsed = new DOMParser().parseFromString(html, "text/html");
      page.replaceChild(page.importNode(parsed.documentElement, true), page.documentElement);
      await page.fonts?.ready;
      target = page.documentElement;
    }
    if (!target) throw new Error("Could not create the PDF document");

    const { html2canvas, jsPDF } = await loadPdfDependencies();
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const bounds = target.getBoundingClientRect();
    const width = Math.ceil(Math.max(bounds.width, target.scrollWidth, 1));
    const height = Math.ceil(Math.max(bounds.height, target.scrollHeight, 1));
    const margin = 10;
    const pdfWidth = pdf.internal.pageSize.getWidth() - 2 * margin;
    const mmPerPixel = pdfWidth / width;
    const pageHeight = pdf.internal.pageSize.getHeight() - 2 * margin;
    const pixelsPerPage = Math.max(1, Math.floor(pageHeight / mmPerPixel));
    const lines = height > pixelsPerPage ? measureTextLines(target, bounds.top) : [];

    // Capture each printable region separately to bound canvas memory on long drafts.
    for (let offset = 0; offset < height;) {
      let end = Math.min(offset + pixelsPerPage, height);
      for (const line of lines) {
        if (line.top <= offset) break;
        if (line.top < end && end < line.bottom) end = line.top;
      }
      const canvas = await html2canvas(target, {
        y: offset,
        width,
        height: end - offset,
        scale: 2,
        useCORS: true,
      });
      if (offset > 0) pdf.addPage();
      pdf.addImage(canvas, "PNG", margin, margin, pdfWidth, (end - offset) * mmPerPixel);
      offset = end;
    }
    await pdf.save(`${filename}.pdf`, { returnPromise: true });
  } finally {
    frame?.remove();
  }
}
