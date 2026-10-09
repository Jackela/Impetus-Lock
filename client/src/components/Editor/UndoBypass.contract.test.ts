import { Schema } from "@milkdown/prose/model";
import { EditorState } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";
import { describe, expect, it } from "vitest";
import { deleteWithoutUndo, insertWithoutUndo } from "./UndoBypass";

describe("undo bypass position contract", () => {
  it("rejects noninteger positions without changing a real document", () => {
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
      for (const pos of [NaN, Infinity, -Infinity, 1.5]) {
        expect(deleteWithoutUndo(view, pos, 5)).toBe(false);
        expect(deleteWithoutUndo(view, 1, pos)).toBe(false);
        expect(insertWithoutUndo(view, pos, "AI text")).toBe(false);
        expect(view.state.doc.eq(state.doc)).toBe(true);
      }
    } finally {
      view.destroy();
    }
  });
});
