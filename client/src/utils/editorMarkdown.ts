import type { remarkCtx } from "@milkdown/core";
import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import { extractLockAttributes } from "./prosemirror-helpers";

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

/**
 * Validate persisted locks against the actual Milkdown document before recovery.
 * @param markdown - Original persisted Markdown, retained by the caller on failure
 * @param lockIds - Persisted lock metadata, which may omit legacy markers
 * @param remarkParser - Parser identifying literal code ranges
 * @param parseDocument - Milkdown parser producing the document used for lock enforcement
 * @returns Complete lock IDs recovered from non-code markers
 * @throws When a declared or persisted lock has no protected document position
 */
export function validateRecoveredLocks(
  markdown: string,
  lockIds: string[],
  remarkParser: MarkdownParser,
  parseDocument: (markdown: string) => ProseMirrorNode | null | undefined
): string[] {
  const ids = new Set<string>();
  const originalMarkers = new Map<string, number>();
  transformOutsideCode(markdown, remarkParser, (text) => {
    const withoutMarkers = text.replace(
      /<!--\s*lock:([^\s<>]+)(?:\s+source:(muse|loki))?\s*-->/gi,
      (_marker, id: string) => {
        ids.add(id);
        originalMarkers.set(id, (originalMarkers.get(id) ?? 0) + 1);
        return "";
      }
    );
    if (/<!--\s*lock\b/i.test(withoutMarkers)) {
      throw new Error("Draft recovery failed: a lock marker is damaged.");
    }
    return text;
  });
  const document = parseDocument(preserveLockMarkers(markdown, remarkParser));
  if (!document) throw new Error("Draft recovery failed: Markdown could not be parsed.");
  const protectedIds = new Set<string>();
  const parsedMarkers = new Map<string, number>();
  document.descendants((node) => {
    if (node.type.name === "code_block") return false;
    if (node.isText && node.marks.some((mark) => mark.type.name === "inlineCode")) return;
    if (!node.isText && !node.isTextblock) return;
    let prose = "";
    if (node.isText) {
      prose = node.textContent;
    } else {
      node.descendants((child) => {
        if (child.isText) {
          prose += child.marks.some((mark) => mark.type.name === "inlineCode")
            ? "\n"
            : child.textContent;
        }
      });
    }
    const metadata = extractLockAttributes(node);
    const proseIds = [
      ...prose.matchAll(/<!--\s*lock:([^\s>]+)(?:\s+source:([^\s>]+))?\s*-->/gi),
    ].map((match) => match[1]!);
    if (node.isTextblock) {
      for (const id of proseIds) parsedMarkers.set(id, (parsedMarkers.get(id) ?? 0) + 1);
    }
    if (metadata && ids.has(metadata.lockId)) {
      if (proseIds.includes(metadata.lockId)) protectedIds.add(metadata.lockId);
    }
  });
  for (const id of new Set([...ids, ...lockIds])) {
    if (
      !ids.has(id) ||
      !protectedIds.has(id) ||
      originalMarkers.get(id) !== parsedMarkers.get(id)
    ) {
      throw new Error(`Draft recovery failed: lock ${id} has no protected document position.`);
    }
  }
  return [...ids];
}
