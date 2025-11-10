import type { EditorState } from "@milkdown/prose/state";

const SENTENCE_BOUNDARY = /[。！？!?.]/;
const MIN_SENTENCE_LENGTH = 10;

/**
 * Compute the sentence range immediately preceding the current cursor.
 *
 * Falls back to the last 10 characters when no boundary is found.
 */
export function getLastSentenceRange(state: EditorState): { from: number; to: number } {
  const docSize = state.doc.content.size;
  if (docSize === 0) {
    return { from: 0, to: 0 };
  }

  const cursorPos = state.selection.from;
  const safeCursor = Math.max(0, Math.min(cursorPos, docSize));

  const beforeText = state.doc.textBetween(0, safeCursor, "", "");
  if (beforeText.length === 0) {
    return { from: 0, to: safeCursor };
  }

  let start = beforeText.length;

  while (start > 0) {
    const char = beforeText.charAt(start - 1);
    if (SENTENCE_BOUNDARY.test(char) || char === "\n") {
      break;
    }
    start -= 1;
  }

  const sentenceLength = safeCursor - start;
  if (sentenceLength < MIN_SENTENCE_LENGTH) {
    start = Math.max(0, safeCursor - MIN_SENTENCE_LENGTH);
  }

  return {
    from: start,
    to: safeCursor,
  };
}
