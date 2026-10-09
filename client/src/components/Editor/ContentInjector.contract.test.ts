import { Schema } from "@milkdown/prose/model";
import { EditorState } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";
import { describe, expect, it, vi } from "vitest";
import { injectLockedBlock } from "../../services/ContentInjector";

vi.mock("../../services/ContentInjector", async (importOriginal) => await importOriginal());

describe("content injection library contract", () => {
  it("leaves a real document unchanged when its schema cannot create a blockquote", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {},
      },
    });
    const state = EditorState.create({
      schema,
      doc: schema.node("doc", null, schema.node("paragraph", null, schema.text("Writer text"))),
    });
    const view = new EditorView(document.createElement("div"), { state });
    try {
      expect(() =>
        injectLockedBlock(view, "AI text", "schema_lock", { type: "pos", from: 1 })
      ).not.toThrow();
      expect(view.state.doc.eq(state.doc)).toBe(true);
    } finally {
      view.destroy();
    }
  });
});
