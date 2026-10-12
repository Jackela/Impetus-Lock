import { describe, expect, it } from "vitest";
import { extractLastSentences } from "./contextExtractor";

describe("literal intervention context", () => {
  it("preserves the source suffix spacing so cursor-relative anchors stay aligned", () => {
    expect(extractLastSentences("第一句。\n第二句。  他打开门，还没  ", 2, undefined, true)).toBe(
      "第二句。  他打开门，还没  "
    );
  });
  it("retains closing quotes and repeated punctuation with the sentence", () => {
    expect(
      extractLastSentences("旧情节。\n“他来了！”\n真的吗？！\n她仍在犹豫", 3, undefined, true)
    ).toBe("“他来了！”\n真的吗？！\n她仍在犹豫");
  });
  it("does not remove whitespace between punctuation runs in literal mode", () => {
    expect(extractLastSentences("旧句。现在？！  ！！  下一句未完  ", 3, undefined, true)).toBe(
      "旧句。现在？！  ！！  下一句未完  "
    );
  });
});
