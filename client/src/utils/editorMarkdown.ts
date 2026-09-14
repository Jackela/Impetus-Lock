import type { remarkCtx } from "@milkdown/core";

type MarkdownParser = Pick<typeof remarkCtx._defaultValue, "parse">;
type SyntaxNode = {
  type: string;
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: SyntaxNode[];
};

function transformOutsideCode(
  markdown: string,
  parser: MarkdownParser,
  transform: (text: string) => string
): string {
  let result = "";
  let cursor = 0;
  const visit = (node: SyntaxNode) => {
    if (node.type === "code" || node.type === "inlineCode") {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) {
        result += transform(markdown.slice(cursor, start)) + markdown.slice(start, end);
        cursor = end;
      }
      return;
    }
    node.children?.forEach(visit);
  };
  visit(parser.parse(markdown));
  return result + transform(markdown.slice(cursor));
}

/**
 * Keep persisted lock comments as literal text when Milkdown parses Markdown.
 * Otherwise its commonmark parser discards HTML comments and loses lock metadata.
 * @param markdown - Persisted Markdown with raw lock comments
 * @param parser - Milkdown Markdown parser used to identify literal code ranges
 * @returns Markdown with lock comments escaped for parsing
 */
export function preserveLockMarkers(markdown: string, parser: MarkdownParser): string {
  return transformOutsideCode(markdown, parser, (text) =>
    text.replace(/<!--\s*lock:[^>]*?-->/g, "\\$&")
  );
}

/**
 * Restore the persisted lock comment format after native Markdown serialization.
 * Only lock markers are unescaped; normal Markdown keeps its native escaping.
 * @param markdown - Native serialized Markdown
 * @param parser - Milkdown Markdown parser used to identify literal code ranges
 * @returns Markdown with raw lock comments, including original IDs and sources
 */
export function restoreLockMarkers(markdown: string, parser: MarkdownParser): string {
  return transformOutsideCode(markdown, parser, (text) =>
    text.replace(/\\<!--\s*lock:[^>]*?-->/g, (marker) =>
      marker.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, "$1")
    )
  );
}
