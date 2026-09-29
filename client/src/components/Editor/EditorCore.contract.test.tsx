import { act, cleanup, render, waitFor } from "@testing-library/react";
import { editorViewCtx, type Editor } from "@milkdown/core";
import { history, undo } from "@milkdown/prose/history";
import { Plugin } from "@milkdown/prose/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorCore } from "./EditorCore";
import { deleteWithoutUndo } from "./UndoBypass";
import { lockDecorationsKey } from "./LockDecorations";

afterEach(cleanup);

describe("EditorCore transaction library contract", () => {
  it("enforces locks through real state and dispatch while allowing metadata and raw edits", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    render(
      <EditorCore
        initialContent={"Writer text\n\n> Protected text <!-- lock:contract_lock source:muse -->"}
        initialLocks={["contract_lock"]}
        onReady={onReady}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const ready = onReady.mock.calls.at(0);
    if (!ready) throw new Error("Editor did not initialize");

    act(() =>
      ready[0].action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const before = view.state;
        const first = before.doc.firstChild;
        if (!first) throw new Error("Writer paragraph is missing");
        const deletion = before.tr.delete(first.nodeSize, before.doc.content.size);
        // Native state filtering must work without relying on a view-only property.
        expect(before.applyTransaction(deletion).transactions).toEqual([]);
        onChange.mockClear();
        view.dispatch(deletion);
        expect(view.state.doc.eq(before.doc)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        view.dispatch(view.state.tr.setMeta("contract-metadata", true));
        expect(view.state).not.toBe(before);
        expect(view.state.doc.eq(before.doc)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        view.dispatch(view.state.tr.insertText("Edited ", 1));
        expect(view.state.doc.firstChild?.textContent).toBe("Edited Writer text");
        expect(onChange).toHaveBeenCalledOnce();
        expect(onChange.mock.calls.at(-1)?.[0]).toContain(
          "<!-- lock:contract_lock source:muse -->"
        );
      })
    );
  });

  it("blocks real undo of locked content and retains installed filters and AI metadata", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    render(<EditorCore initialContent="Writer text" onReady={onReady} onChange={onChange} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const ready = onReady.mock.calls.at(0);
    if (!ready) throw new Error("Editor did not initialize");

    act(() =>
      ready[0].action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const installed = view.state.plugins;
        const veto = new Plugin({
          filterTransaction: (tr) => !tr.getMeta("contract-veto"),
        });
        view.updateState(view.state.reconfigure({ plugins: [...installed, history(), veto] }));
        for (const plugin of installed) expect(view.state.plugins).toContain(plugin);
        expect(lockDecorationsKey.get(view.state)).toBeDefined();

        view.dispatch(view.state.tr.insertText(" <!-- lock:undo_lock source:loki -->", 12));
        const locked = view.state.doc;
        onChange.mockClear();
        expect(undo(view.state, view.dispatch)).toBe(true);
        expect(view.state.doc.eq(locked)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        view.dispatch(view.state.tr.insertText("Vetoed ", 1).setMeta("contract-veto", true));
        expect(view.state.doc.eq(locked)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();

        // AI deletion must pass the lock filter and remain absent from history.
        expect(deleteWithoutUndo(view, 1, view.state.doc.content.size - 1)).toBe(true);
        expect(view.state.doc.textContent).toBe("");
        expect(onChange).toHaveBeenCalledOnce();
        // A prior user edit may still leave a mapped, empty undo event.
        // Regardless of the command's availability, it must not restore AI deletion.
        undo(view.state, view.dispatch);
        expect(view.state.doc.textContent).toBe("");
      })
    );
  });

  it("blocks locked deletion after positions shift inside a multi-step transaction", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    render(
      <EditorCore
        initialContent={"Writer text\n\n> Protected text <!-- lock:shifted_lock source:muse -->"}
        initialLocks={["shifted_lock"]}
        onReady={onReady}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const ready = onReady.mock.calls.at(0);
    if (!ready) throw new Error("Editor did not initialize");
    act(() =>
      ready[0].action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const before = view.state.doc;
        const first = before.firstChild;
        if (!first) throw new Error("Writer paragraph is missing");
        const tr = view.state.tr.insertText("x".repeat(100), 1);
        tr.delete(first.nodeSize + 100, tr.doc.content.size);
        onChange.mockClear();
        expect(() => view.dispatch(tr)).not.toThrow();
        expect(view.state.doc.eq(before)).toBe(true);
        expect(onChange).not.toHaveBeenCalled();
      })
    );
  });
});
