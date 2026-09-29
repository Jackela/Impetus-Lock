/**
 * Read Markdown through the optional legacy E2E facade in the evaluated page.
 * This self-contained callback checks runtime support; it never installs a facade.
 * @returns Validated Markdown text.
 */
export function getLegacyMarkdown(): string {
  const editor: unknown = "__editor__" in window ? window.__editor__ : undefined;
  if (editor === undefined) {
    throw new Error("Legacy E2E requires window.__editor__; no editor facade is installed");
  }
  if (typeof editor !== "object" || editor === null) {
    throw new Error("Legacy E2E window.__editor__ must be an object");
  }
  if (!("getMarkdown" in editor) || typeof editor.getMarkdown !== "function") {
    throw new Error("Legacy E2E window.__editor__.getMarkdown must be a function");
  }
  const markdown: unknown = editor.getMarkdown.call(editor);
  if (typeof markdown !== "string") {
    throw new Error("Legacy E2E window.__editor__.getMarkdown must return a string");
  }
  return markdown;
}

/**
 * Set Markdown through the optional legacy E2E facade in the evaluated page.
 * @param markdown - Text supplied by the existing browser scenario.
 * @returns Nothing; the original scenario does not consume the setter result.
 */
export function setLegacyMarkdown(markdown: string): void {
  const editor: unknown = "__editor__" in window ? window.__editor__ : undefined;
  if (editor === undefined) {
    throw new Error("Legacy E2E requires window.__editor__; no editor facade is installed");
  }
  if (typeof editor !== "object" || editor === null) {
    throw new Error("Legacy E2E window.__editor__ must be an object");
  }
  if (!("setMarkdown" in editor) || typeof editor.setMarkdown !== "function") {
    throw new Error("Legacy E2E window.__editor__.setMarkdown must be a function");
  }
  editor.setMarkdown.call(editor, markdown);
}

/**
 * Request deletion through the optional legacy E2E facade in the evaluated page.
 * @param range - Original scenario's deletion range.
 * @param range.from - Start position from the existing scenario.
 * @param range.to - End position from the existing scenario.
 * @returns Nothing; the scenario verifies deletion through the subsequent Markdown read.
 */
export function deleteLegacyWithoutUndo(range: { from: number; to: number }): void {
  const editor: unknown = "__editor__" in window ? window.__editor__ : undefined;
  if (editor === undefined) {
    throw new Error("Legacy E2E requires window.__editor__; no editor facade is installed");
  }
  if (typeof editor !== "object" || editor === null) {
    throw new Error("Legacy E2E window.__editor__ must be an object");
  }
  if (!("deleteWithoutUndo" in editor) || typeof editor.deleteWithoutUndo !== "function") {
    throw new Error("Legacy E2E window.__editor__.deleteWithoutUndo must be a function");
  }
  editor.deleteWithoutUndo.call(editor, range);
}
