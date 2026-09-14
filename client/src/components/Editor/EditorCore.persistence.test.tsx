import { act, cleanup, render, waitFor } from "@testing-library/react";
import { editorViewCtx, type Editor } from "@milkdown/core";
import { Transform, Step } from "@milkdown/prose/transform";
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectLockedBlock, rewriteRangeWithLock } from "../../services/ContentInjector";
import { LockManager } from "../../services/LockManager";
import { EditorCore } from "./EditorCore";

afterEach(cleanup);

describe("EditorCore persistence", () => {
  it("emits Markdown preserving headings, lists, and blockquotes after an edit", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn<(markdown: string, lockIds: string[]) => void>();
    const { container } = render(
      <EditorCore
        initialContent={"# Heading\n\n- List item\n\n> Quoted text"}
        onReady={onReady}
        onChange={onChange}
      />
    );

    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(container.querySelector("h1")).toHaveTextContent("Heading");
    expect(container.querySelector("li")).toHaveTextContent("List item");
    expect(container.querySelector("blockquote")).toHaveTextContent("Quoted text");

    const editor = onReady.mock.calls[0]![0];
    onChange.mockClear();
    act(() => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText("Updated ", 1));
      });
    });

    expect(container.querySelector("h1")).toHaveTextContent("Updated Heading");
    expect(onChange).toHaveBeenCalled();
    const [markdown, lockIds] = onChange.mock.calls.at(-1)!;
    expect(markdown).toMatch(/^# Updated Heading$/m);
    expect(markdown).toMatch(/^[-*+] List item$/m);
    expect(markdown).toMatch(/^> Quoted text$/m);
    expect(lockIds).toEqual([]);
  });

  it.each(["provoke", "rewrite"] as const)(
    "preserves %s lock comments and sources through persistence",
    async (action) => {
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn<(markdown: string, lockIds: string[]) => void>();
      const first = render(
        <EditorCore initialContent="Normal text" onReady={onReady} onChange={onChange} />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      let rollback: Step;
      act(() =>
        onReady.mock.calls[0]![0].action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const original = view.state.doc;
          if (action === "provoke") {
            injectLockedBlock(
              view,
              "Protected text",
              "lock_provoke_001",
              { type: "pos", from: view.state.doc.content.size },
              "muse"
            );
          } else {
            const from = view.state.doc.content.size;
            view.dispatch(
              view.state.tr.insert(
                from,
                view.state.schema.nodes.paragraph.create(null, view.state.schema.text("Replace me"))
              )
            );
            rewriteRangeWithLock({
              view,
              content: "Protected text",
              lockId: "lock_provoke_001",
              source: "loki",
              anchor: { type: "range", from, to: view.state.doc.content.size },
            });
          }
          // Invert the document replacement representing the AI change. Replaying
          // this rollback after hydration must pass through the real lock filter.
          rollback = new Transform(original)
            .replaceWith(0, original.content.size, view.state.doc.content)
            .steps[0]!.invert(original);
        })
      );
      const [markdown, lockIds] = onChange.mock.calls.at(-1)!;
      expect(lockIds).toEqual(["lock_provoke_001"]);
      const source = action === "provoke" ? "muse" : "loki";
      expect(markdown).toContain(`<!-- lock:lock_provoke_001 source:${source} -->`);
      expect(new LockManager().extractLockEntriesFromMarkdown(markdown)).toEqual([
        { lockId: "lock_provoke_001", source },
      ]);
      first.unmount();
      onReady.mockClear();
      const second = render(
        <EditorCore
          initialContent={markdown}
          initialLocks={lockIds}
          onReady={onReady}
          onChange={onChange}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      expect(
        second.container.querySelector(action === "provoke" ? "blockquote" : ".milkdown")
      ).toHaveTextContent("Protected text");
      act(() =>
        onReady.mock.calls[0]![0].action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const before = view.state.doc;
          const from = before.firstChild!.nodeSize;
          view.dispatch(view.state.tr.delete(from, before.content.size));
          expect(view.state.doc.eq(before)).toBe(true);
          view.dispatch(
            view.state.tr
              .step(Step.fromJSON(view.state.schema, rollback.toJSON()))
              .setMeta("history$", { redo: false })
          );
          expect(view.state.doc.eq(before)).toBe(true);
          view.dispatch(view.state.tr.insertText("Edited ", 1));
          expect(view.state.doc.firstChild!.textContent).toBe("Edited Normal text");
        })
      );
    }
  );

  it("keeps a saved version refresh unchanged and parses changed external Markdown", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn<(markdown: string, lockIds: string[]) => void>();
    const mounted = render(
      <EditorCore
        initialContent="# Heading"
        contentVersion={0}
        onReady={onReady}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const editor = onReady.mock.calls[0]![0];
    act(() =>
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.dispatch(view.state.tr.insertText("Edited ", 1));
      })
    );
    const [saved] = onChange.mock.calls.at(-1)!;
    const before = editor.action((ctx) => ctx.get(editorViewCtx).state.doc);
    onChange.mockClear();
    mounted.rerender(
      <EditorCore initialContent={saved} contentVersion={1} onReady={onReady} onChange={onChange} />
    );
    expect(editor.action((ctx) => ctx.get(editorViewCtx).state.doc)).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    mounted.rerender(
      <EditorCore
        initialContent={"## External heading\n\n- External item\n\n> External quote"}
        contentVersion={2}
        onReady={onReady}
        onChange={onChange}
      />
    );
    expect(mounted.container.querySelector("h2")).toHaveTextContent("External heading");
    expect(mounted.container.querySelector("li")).toHaveTextContent("External item");
    expect(mounted.container.querySelector("blockquote")).toHaveTextContent("External quote");
  });
});
