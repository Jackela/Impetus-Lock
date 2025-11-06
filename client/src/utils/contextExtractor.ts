/**
 * Context extraction utility for intervention API calls.
 *
 * Extracts last N sentences from editor content to provide
 * context for Muse/Loki interventions.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Native string methods, no NLP libraries
 * - Article V (Documentation): Complete JSDoc with examples
 *
 * Success Criteria:
 * - SC-004: Context extraction accuracy ≥99%
 *
 * @example
 * ```typescript
 * const text = '第一句话。第二句话。第三句话。第四句话。';
 * const context = extractLastSentences(text, 3);
 * // Returns: '第二句话。第三句话。第四句话。'
 * ```
 */

/**
 * Sentence delimiter regex pattern.
 * Matches Chinese and English sentence endings.
 */
const SENTENCE_DELIMITERS = /[。！？.!?]+/g;

/**
 * Extracts last N sentences from text.
 *
 * Handles edge cases:
 * - Document with <N sentences → returns all available sentences
 * - Empty document → returns empty string
 * - Cursor position → extracts from beginning to cursor
 * - No delimiters → treats entire text as single sentence
 *
 * @param text - Full document text
 * @param count - Number of sentences to extract (default: 3)
 * @param cursorPos - Optional cursor position (extracts up to cursor)
 * @returns Extracted sentences concatenated as string
 *
 * @example
 * ```typescript
 * // Extract last 3 sentences
 * extractLastSentences('第一句。第二句。第三句。第四句。', 3);
 * // Returns: '第二句。第三句。第四句。'
 *
 * // Extract with cursor position
 * extractLastSentences('第一句。第二句。第三句。', 3, 7);
 * // Returns: '第一句。' (up to cursor after first sentence)
 *
 * // Handle <N sentences
 * extractLastSentences('只有一句。', 3);
 * // Returns: '只有一句。'
 *
 * // Handle no delimiters
 * extractLastSentences('没有标点', 3);
 * // Returns: '没有标点'
 * ```
 */
export function extractLastSentences(text: string, count: number = 3, cursorPos?: number): string {
  // Handle edge cases
  if (count <= 0) {
    return "";
  }

  if (!text || text.trim() === "") {
    return "";
  }

  // Extract text up to cursor position if specified
  const targetText = cursorPos !== undefined ? text.substring(0, cursorPos) : text;

  if (targetText.trim() === "") {
    return "";
  }

  // Split by sentence delimiters while keeping delimiters
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  SENTENCE_DELIMITERS.lastIndex = 0;

  while ((match = SENTENCE_DELIMITERS.exec(targetText)) !== null) {
    const sentenceText = targetText.substring(lastIndex, match.index);
    const delimiter = match[0];

    // Combine sentence with its delimiter (handle consecutive delimiters)
    if (sentenceText.trim() || parts.length === 0) {
      const combined = sentenceText.trim() + delimiter;
      parts.push(combined);
    } else if (parts.length > 0) {
      // Consecutive delimiters: append to last sentence
      parts[parts.length - 1] += delimiter;
    }

    lastIndex = match.index + delimiter.length;
  }

  // Handle remaining text after last delimiter (incomplete sentence)
  const remaining = targetText.substring(lastIndex).trim();
  if (remaining) {
    // Only include incomplete sentence if we're at end of document (no cursor position)
    if (cursorPos === undefined) {
      parts.push(remaining);
    }
    // If cursor position specified, ignore incomplete sentence at cursor
  }

  // If no sentences found, return entire text
  if (parts.length === 0) {
    return targetText.trim();
  }

  // Extract last N sentences
  const startIndex = Math.max(0, parts.length - count);
  const extracted = parts.slice(startIndex);

  // Join sentences (preserve original spacing for English, no space for Chinese)
  const joined = extracted.join(" ");

  // Remove extra spaces but keep single space after English periods
  return joined
    .replace(/([。！？])\s+/g, "$1") // No space after Chinese delimiters
    .replace(/\s{2,}/g, " ") // Collapse multiple spaces
    .trim();
}
