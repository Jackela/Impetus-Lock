import { describe, it, expect } from "vitest";
import { Schema } from "@milkdown/prose/model";
import { EditorState, TextSelection } from "@milkdown/prose/state";
import { getLastSentenceRange } from "./textRange";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() {
        return ["p", 0];
      },
    },
    text: { group: "inline" },
  },
  marks: { strong: {} },
});

function createState(text: string): EditorState {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text(text))]);
  const selection = TextSelection.atEnd(doc);
  const baseState = EditorState.create({ schema, doc });
  return baseState.apply(baseState.tr.setSelection(selection));
}

describe("getLastSentenceRange", () => {
  it.each(["短句。", "“他来了！”", "真的？！", "短句。  "])(
    "does not borrow earlier writing for %s",
    (tail) => {
      const state = createState("上一句必须保持原样。" + tail);
      const range = getLastSentenceRange(state);
      expect(state.doc.textBetween(range.from, range.to, "", "")).toBe(tail);
    }
  );
  it("maps a sentence across formatted text nodes without losing its beginning", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("上句已经结束。现在他准备"),
        schema.text("打开那扇神秘的门🚪", [schema.mark("strong")]),
        schema.text("，却发现钥匙已经失踪。"),
      ]),
    ]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.atEnd(doc) });
    const range = getLastSentenceRange(state);
    expect(state.doc.textBetween(range.from, range.to, "", "")).toBe(
      "现在他准备打开那扇神秘的门🚪，却发现钥匙已经失踪。"
    );
  });

  it("keeps an unfinished paragraph sentence separate from an unpunctuated earlier paragraph", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("前一段没有标点但应保留")),
      schema.node("paragraph", null, schema.text("他打开门🚪，发现屋里站着另一个自己")),
    ]);
    const state = EditorState.create({ schema, doc, selection: TextSelection.atEnd(doc) });
    const range = getLastSentenceRange(state);
    expect(range).toEqual({ from: doc.firstChild!.nodeSize + 1, to: state.selection.from });
    expect(state.doc.textBetween(range.from, range.to, "", "")).toBe(
      "他打开门🚪，发现屋里站着另一个自己"
    );
  });

  it("returns accurate range for multi-sentence Chinese text", () => {
    const text =
      "“信使”穿过霓虹灯闪烁的小巷，雨水打湿了他的风衣。" +
      "他检查了手腕上的数据终端，时间不多了。" +
      "他必须在‘清道夫’之前拿到那个芯片。";

    const state = createState(text);
    const range = getLastSentenceRange(state);
    const extracted = state.doc.textBetween(range.from, range.to, "", "");

    expect(extracted).toBe("他必须在‘清道夫’之前拿到那个芯片。");
  });

  it("skips leading whitespace before final sentence", () => {
    const text = "Second sentence ended.   He must swap the chip before Loki arrives.";
    const state = createState(text);
    const range = getLastSentenceRange(state);
    const extracted = state.doc.textBetween(range.from, range.to, "", "");

    expect(extracted).toBe("He must swap the chip before Loki arrives.");
  });

  it("falls back to minimum window when no punctuation exists", () => {
    const text = "No punctuation yet but the cursor keeps moving forward";
    const state = createState(text);
    const range = getLastSentenceRange(state);

    expect(range.to).toBe(state.selection.from);
    expect(range.to - range.from).toBeGreaterThanOrEqual(10);
  });
  it("does not split an emoji at the maximum lookback boundary", () => {
    const state = createState("甲🚪" + "乙".repeat(479));
    const range = getLastSentenceRange(state);
    expect(state.doc.textBetween(range.from, range.to)).toBe("乙".repeat(479));
  });
});
