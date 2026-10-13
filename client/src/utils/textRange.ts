import type { EditorState } from "@milkdown/prose/state";

const SENTENCE_ENDINGS = /[。！？!?.]+[”’」』"']*|\n/g;
const MAX_SENTENCE_LOOKBACK = 480;

function computeStartOffset(text: string): number {
  let start = 0;
  let lastSentenceStart = 0;
  for (const match of text.matchAll(SENTENCE_ENDINGS)) {
    const end = match.index + match[0].length;
    if (text.slice(start, end).trim()) lastSentenceStart = start;
    start = end;
  }
  if (text.slice(start).trim()) lastSentenceStart = start;
  while (lastSentenceStart < text.length && /\s/.test(text.charAt(lastSentenceStart))) {
    lastSentenceStart += 1;
  }
  return lastSentenceStart;
}

function offsetToDocPos(
  state: EditorState,
  offset: number,
  startPos: number,
  limitPos: number
): number {
  let remaining = offset;
  let resolved = limitPos;
  let found = false;
  state.doc.nodesBetween(startPos, limitPos, (node, pos) => {
    if (found) return false;
    if (!node.isLeaf) return true;
    const text = node.isText ? (node.text ?? "") : "\n";
    if (remaining <= text.length) {
      resolved = pos + remaining;
      found = true;
      return false;
    }
    remaining -= text.length;
    return true;
  });
  return resolved;
}

/**
 * Compute the sentence immediately preceding the selection end.
 *
 * Resolves offsets inside the current textblock so formatting and earlier
 * paragraphs cannot shift the range or cause unrelated writing to be replaced.
 *
 * @param state - ProseMirror editor state containing the selection
 * @returns The exact document range of the last available sentence
 */
export function getLastSentenceRange(state: EditorState): { from: number; to: number } {
  const cursorPos = state.selection.to;
  const cursor = state.doc.resolve(cursorPos);
  if (!cursor.parent.isTextblock) return { from: cursorPos, to: cursorPos };
  const parentStart = cursor.start();
  const fullText = cursor.parent.textBetween(0, cursor.parentOffset, "", "\n");
  let windowStart = Math.max(0, fullText.length - MAX_SENTENCE_LOOKBACK);
  if (windowStart > 0 && /[\uDC00-\uDFFF]/.test(fullText.charAt(windowStart))) windowStart += 1;
  const startOffset = windowStart + computeStartOffset(fullText.slice(windowStart));
  return {
    from: offsetToDocPos(state, startOffset, parentStart, cursorPos),
    to: cursorPos,
  };
}
