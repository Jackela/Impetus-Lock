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
  marks: {},
});

function createState(text: string): EditorState {
  const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text(text))]);
  const selection = TextSelection.atEnd(doc);
  const baseState = EditorState.create({ schema, doc });
  return baseState.apply(baseState.tr.setSelection(selection));
}

describe("getLastSentenceRange", () => {
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
});
