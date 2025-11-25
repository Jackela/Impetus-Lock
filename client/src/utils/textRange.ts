import type { EditorState } from "@milkdown/prose/state";

const SENTENCE_BOUNDARY = /[。！？!?.]/;
const MIN_SENTENCE_LENGTH = 10;
const MAX_SENTENCE_LOOKBACK = 480;

function sliceSentences(text: string): string[] {
  if (!text) {
    return [];
  }

  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (SENTENCE_BOUNDARY.test(char) || char === "\n") {
      const fragment = text.slice(start, i + 1);
      if (fragment.trim()) {
        sentences.push(fragment);
      }
      start = i + 1;
    }
  }

  if (start < text.length) {
    const fragment = text.slice(start);
    if (fragment.trim()) {
      sentences.push(fragment);
    }
  }

  return sentences;
}

function computeStartOffset(text: string): number {
  if (!text) {
    return 0;
  }

  const fragments = sliceSentences(text);
  if (fragments.length === 0) {
    return Math.max(0, text.length - MIN_SENTENCE_LENGTH);
  }

  const lastFragment = fragments[fragments.length - 1];
  const rawOffset = text.length - lastFragment.length;

  let offset = rawOffset;
  while (offset < text.length && /\s/.test(text[offset])) {
    offset += 1;
  }

  return offset;
}

function offsetToDocPos(state: EditorState, offset: number, limitPos: number): number {
  let remaining = offset;
  let resolved = limitPos;

  state.doc.nodesBetween(0, limitPos, (node, pos) => {
    if (!node.isText) {
      return true;
    }

    const text = node.text ?? "";
    if (remaining <= text.length) {
      resolved = pos + remaining;
      return false;
    }

    remaining -= text.length;
    return true;
  });

  return resolved;
}

/**
 * Compute the sentence range immediately preceding the current cursor.
 *
 * Uses document positions (not plain string lengths) so the returned range
 * can be passed directly to ProseMirror transactions.
 */
export function getLastSentenceRange(state: EditorState): { from: number; to: number } {
  const docSize = state.doc.content.size;
  if (docSize === 0) {
    return { from: 0, to: 0 };
  }

  const cursorPos = Math.max(0, Math.min(state.selection.from, docSize));
  const fullText = state.doc.textBetween(0, cursorPos, "", "");
  const windowStart = Math.max(0, fullText.length - MAX_SENTENCE_LOOKBACK);
  const windowText = fullText.slice(windowStart);

  const localOffset = computeStartOffset(windowText);
  const startOffset = windowStart + localOffset;
  const fromPos = offsetToDocPos(state, startOffset, cursorPos);
  const toPos = offsetToDocPos(state, fullText.length, cursorPos);

  if (toPos - fromPos < MIN_SENTENCE_LENGTH) {
    return {
      from: Math.max(0, cursorPos - MIN_SENTENCE_LENGTH),
      to: cursorPos,
    };
  }

  return {
    from: fromPos,
    to: toPos,
  };
}
