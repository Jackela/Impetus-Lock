import { Editor, EditorStatus, defaultValueCtx, editorViewCtx, rootCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { describe, expect, it } from "vitest";
import { placeholder } from "./PlaceholderPlugin";

describe("placeholder library contract", () => {
  it("initializes a real editor and updates the placeholder through document transactions", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, "");
      })
      .use(commonmark)
      .use(placeholder);

    try {
      await editor.create();
      expect(root.querySelector(".placeholder")).toHaveTextContent("Start writing...");

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.setMeta("placeholder-regression", true));
      });
      expect(root.querySelector(".placeholder")).toHaveTextContent("Start writing...");

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText("Writer text", 1));
        expect(view.state.doc.textContent).toBe("Writer text");
      });
      expect(root.querySelector(".placeholder")).toBeNull();

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.delete(1, 12));
        expect(view.state.doc.textContent).toBe("");
      });
      expect(root.querySelector(".placeholder")).toHaveTextContent("Start writing...");
    } finally {
      // A failed create leaves Milkdown in OnCreate; destroy would retry forever
      // and hide the original library-contract failure behind a test timeout.
      if (editor.status === EditorStatus.Created) {
        await editor.destroy();
      }
      root.remove();
    }
  });
});
