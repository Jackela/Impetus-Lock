import { Editor, editorViewCtx } from "@milkdown/core";
import { Schema } from "@milkdown/prose/model";
import { EditorState } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";

/** Create a real Milkdown context and ProseMirror view through public APIs. */
export function createToolbarEditor(lines = 1) {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] },
      text: {},
    },
    marks: { strong: {}, em: {} },
  });
  const doc = schema.node(
    "doc",
    null,
    Array.from({ length: lines }, () =>
      schema.node("paragraph", null, schema.text("Toolbar selection"))
    )
  );
  const view = new EditorView(document.createElement("div"), {
    state: EditorState.create({ schema, doc }),
  });
  const editor = Editor.make();
  editor.ctx.inject(editorViewCtx, view);
  return { editor, view };
}
