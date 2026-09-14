/**
 * Keep persisted lock comments as literal text when Milkdown parses Markdown.
 * Otherwise its commonmark parser discards HTML comments and loses lock metadata.
 * @param markdown - Persisted Markdown with raw lock comments
 * @returns Markdown with lock comments escaped for parsing
 */
export function preserveLockMarkers(markdown: string): string {
  return markdown.replace(/<!--\s*lock:[^>]*?-->/g, "\\$&");
}

/**
 * Restore the persisted lock comment format after native Markdown serialization.
 * Only lock markers are unescaped; normal Markdown keeps its native escaping.
 * @param markdown - Native serialized Markdown
 * @returns Markdown with raw lock comments, including original IDs and sources
 */
export function restoreLockMarkers(markdown: string): string {
  return markdown.replace(/\\<!--\s*lock:[^>]*?-->/g, (marker) =>
    marker.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
  );
}
