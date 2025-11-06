/**
 * Unit tests for context extraction utility.
 *
 * Extracts last N sentences from editor content for intervention context.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Critical utility function tests (RED phase)
 * - Article V (Documentation): Complete JSDoc for all test cases
 *
 * Success Criteria:
 * - SC-004: Context extraction accuracy ≥99%
 */

import { describe, it, expect } from "vitest";
import { extractLastSentences } from "../../src/utils/contextExtractor";

describe("contextExtractor", () => {
  describe("extractLastSentences", () => {
    it("should extract last 3 sentences from document", () => {
      const text = "第一句话。第二句话。第三句话。第四句话。第五句话。";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("第三句话。第四句话。第五句话。");
    });

    it("should handle document with exactly 3 sentences", () => {
      const text = "第一句话。第二句话。第三句话。";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("第一句话。第二句话。第三句话。");
    });

    it("should handle document with <3 sentences (return all)", () => {
      const text = "第一句话。第二句话。";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("第一句话。第二句话。");
    });

    it("should handle single sentence", () => {
      const text = "只有一句话。";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("只有一句话。");
    });

    it("should handle empty document", () => {
      const text = "";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("");
    });

    it("should handle document with no sentence delimiters", () => {
      const text = "这是一段没有标点的文本";
      const result = extractLastSentences(text, 3);

      // Should return entire text (treat as single sentence)
      expect(result).toBe("这是一段没有标点的文本");
    });

    it("should handle English sentences with period", () => {
      const text = "First sentence. Second sentence. Third sentence. Fourth sentence.";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("Second sentence. Third sentence. Fourth sentence.");
    });

    it("should handle mixed Chinese and English sentences", () => {
      const text = "中文句子。English sentence. 另一个中文句子。Another English.";
      const result = extractLastSentences(text, 2);

      expect(result).toBe("另一个中文句子。Another English.");
    });

    it("should handle question marks as sentence delimiters", () => {
      const text = "这是问句吗？是的。那是什么？不知道。";
      const result = extractLastSentences(text, 2);

      expect(result).toBe("那是什么？不知道。");
    });

    it("should handle exclamation marks as sentence delimiters", () => {
      const text = "第一句！第二句！第三句！第四句！";
      const result = extractLastSentences(text, 2);

      expect(result).toBe("第三句！第四句！");
    });

    it("should handle multiple consecutive delimiters", () => {
      const text = "第一句...第二句！！第三句。。。第四句。";
      const result = extractLastSentences(text, 2);

      // Should treat consecutive delimiters as single delimiter
      expect(result).toContain("第三句");
      expect(result).toContain("第四句");
    });

    it("should trim whitespace from extracted sentences", () => {
      const text = "第一句。  第二句。   第三句。";
      const result = extractLastSentences(text, 2);

      expect(result).toBe("第二句。第三句。");
      expect(result).not.toMatch(/\s{2,}/); // No multiple spaces
    });

    it("should handle cursor position before end of document", () => {
      const text = "第一句。第二句。第三句。";
      const cursorPos = 7; // After "第一句。"
      const result = extractLastSentences(text, 3, cursorPos);

      // Should extract from beginning to cursor position
      expect(result).toBe("第一句。");
    });

    it("should handle cursor at beginning of document", () => {
      const text = "第一句。第二句。第三句。";
      const cursorPos = 0;
      const result = extractLastSentences(text, 3, cursorPos);

      expect(result).toBe("");
    });

    it("should handle default count parameter (3 sentences)", () => {
      const text = "第一句。第二句。第三句。第四句。第五句。";
      const result = extractLastSentences(text); // No count specified

      expect(result).toBe("第三句。第四句。第五句。");
    });

    it("should handle count=1 (single sentence)", () => {
      const text = "第一句。第二句。第三句。";
      const result = extractLastSentences(text, 1);

      expect(result).toBe("第三句。");
    });

    it("should handle count=0 (edge case)", () => {
      const text = "第一句。第二句。第三句。";
      const result = extractLastSentences(text, 0);

      expect(result).toBe("");
    });

    it("should handle negative count (edge case)", () => {
      const text = "第一句。第二句。第三句。";
      const result = extractLastSentences(text, -1);

      // Should return empty string or throw error
      expect(result).toBe("");
    });

    it("should handle very large count (return all sentences)", () => {
      const text = "第一句。第二句。第三句。";
      const result = extractLastSentences(text, 999);

      expect(result).toBe("第一句。第二句。第三句。");
    });

    it("should handle Unicode emoji in sentences", () => {
      const text = "第一句😊。第二句👍。第三句🎉。第四句。";
      const result = extractLastSentences(text, 2);

      expect(result).toBe("第三句🎉。第四句。");
    });

    it("should handle newlines within document", () => {
      const text = "第一句。\n第二句。\n第三句。\n第四句。";
      const result = extractLastSentences(text, 2);

      expect(result).toContain("第三句");
      expect(result).toContain("第四句");
    });

    it("should handle blockquote markers (locked content)", () => {
      const text = "第一句。> 这是锁定的引用。第二句。第三句。";
      const result = extractLastSentences(text, 2);

      // Should extract sentences including blockquote content
      expect(result).toContain("第二句");
      expect(result).toContain("第三句");
    });

    it("should handle Markdown formatting (bold, italic)", () => {
      const text = "第一句。**粗体句子**。*斜体句子*。第四句。";
      const result = extractLastSentences(text, 2);

      expect(result).toContain("斜体句子");
      expect(result).toContain("第四句");
    });

    it("should handle edge case: only whitespace", () => {
      const text = "   \n  \t  ";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("");
    });

    it("should handle edge case: sentence delimiter at end", () => {
      const text = "第一句。第二句。第三句。";
      const result = extractLastSentences(text, 3);

      expect(result).toBe("第一句。第二句。第三句。");
    });

    it("should handle edge case: no delimiter at end", () => {
      const text = "第一句。第二句。第三句";
      const result = extractLastSentences(text, 3);

      // Should treat incomplete sentence as valid sentence
      expect(result).toBe("第一句。第二句。第三句");
    });
  });
});
