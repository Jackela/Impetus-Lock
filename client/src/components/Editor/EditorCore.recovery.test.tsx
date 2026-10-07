import { act, cleanup, render, waitFor } from "@testing-library/react";
import { editorViewCtx, parserCtx, remarkCtx, type Editor } from "@milkdown/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorCore } from "./EditorCore";
import { deleteContentAtAnchor, rewriteRangeWithLock } from "../../services/ContentInjector";
import { validateRecoveredLocks } from "../../utils/editorMarkdown";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EditorCore draft recovery", () => {
  it.each(["delete", "rewrite"] as const)(
    "keeps current locks saveable after an accepted AI %s",
    async (action) => {
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn<(markdown: string, ids: string[]) => void>();
      const onRecoveryError = vi.fn();
      const mounted = render(
        <EditorCore
          initialContent={"Writer\n\n> Old protected <!-- lock:retired-lock -->"}
          initialLocks={["retired-lock"]}
          contentVersion={0}
          onReady={onReady}
          onChange={onChange}
          onRecoveryError={onRecoveryError}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const editor = onReady.mock.calls[0]![0];
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      let from = 0;
      let to = 0;
      view.state.doc.forEach((node, offset) => {
        if (node.type.name === "blockquote") {
          from = offset;
          to = offset + node.nodeSize;
        }
      });
      const before = view.state.doc;
      act(() => view.dispatch(view.state.tr.delete(from, to)));
      expect(view.state.doc).toBe(before);
      act(() => {
        if (action === "delete") deleteContentAtAnchor(view, { type: "range", from, to });
        else
          rewriteRangeWithLock({
            view,
            content: "New protected",
            lockId: "replacement-lock",
            source: "loki",
            anchor: { type: "range", from, to },
          });
      });
      const [markdown, ids] = onChange.mock.calls.at(-1)!;
      expect(ids).toEqual(action === "delete" ? [] : ["replacement-lock"]);
      expect(() =>
        editor.action((ctx) =>
          validateRecoveredLocks(markdown, ids, ctx.get(remarkCtx), ctx.get(parserCtx))
        )
      ).not.toThrow();
      mounted.rerender(
        <EditorCore
          initialContent={markdown}
          initialLocks={ids}
          contentVersion={1}
          onReady={onReady}
          onChange={onChange}
          onRecoveryError={onRecoveryError}
        />
      );
      expect(onRecoveryError).not.toHaveBeenCalled();
      expect(view.editable).toBe(true);
    }
  );

  it.each(["Server writing", "# Server writing"])(
    "accepts canonical spacing for locked %s",
    async (opening) => {
      const onReady = vi.fn<(editor: Editor) => void>();
      const onRecoveryError = vi.fn();
      const mounted = render(
        <EditorCore
          initialContent={`${opening}\n\n> Protected server <!-- lock:server-lock -->`}
          initialLocks={["server-lock"]}
          contentVersion={2}
          onReady={onReady}
          onRecoveryError={onRecoveryError}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      expect(onRecoveryError).not.toHaveBeenCalled();
      expect(view.editable).toBe(true);
      await waitFor(() =>
        expect(mounted.container.querySelector('[data-lock-id="server-lock"]')).toBeInTheDocument()
      );
      const before = view.state.doc;
      let protectedPosition = 0;
      before.forEach((node, offset) => {
        if (node.type.name === "blockquote") protectedPosition = offset;
      });
      act(() => view.dispatch(view.state.tr.delete(protectedPosition, before.content.size)));
      expect(view.state.doc).toBe(before);
      act(() => view.dispatch(view.state.tr.insertText("Continued ", 1)));
      expect(view.state.doc.textContent).toContain("Continued Server writing");
    }
  );

  it("reports and blocks a controlled replacement rejected by existing locks", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onRecoveryError = vi.fn();
    const mounted = render(
      <EditorCore
        initialContent={"Writer\n\n> Protected local <!-- lock:local-lock -->"}
        initialLocks={["local-lock"]}
        contentVersion={1}
        onReady={onReady}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    const before = view.state.doc;
    const candidate = "Server writer\n\n> Protected server <!-- lock:server-lock -->";
    mounted.rerender(
      <EditorCore
        initialContent={candidate}
        initialLocks={["server-lock"]}
        contentVersion={2}
        onReady={onReady}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onRecoveryError).toHaveBeenCalledWith(expect.any(Error)));
    expect(view.state.doc).toBe(before);
    expect(view.editable).toBe(false);
    expect(mounted.container.querySelector('[data-testid="unrecovered-draft"]')).toHaveTextContent(
      "Protected server"
    );
  });

  it("restores and enforces prose locks omitted by legacy metadata", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    render(
      <EditorCore
        initialContent={
          "Writer\n\n> Protected A <!-- lock:legacy-a -->\n\n> Protected B <!-- lock:legacy-b source:loki -->"
        }
        initialLocks={["legacy-a"]}
        onReady={onReady}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    const before = view.state.doc;
    let secondProtected = 0;
    view.state.doc.forEach((node, offset) => {
      if (node.textContent.includes("Protected B")) secondProtected = offset;
    });
    act(() => view.dispatch(view.state.tr.delete(secondProtected, before.content.size)));
    expect(view.state.doc).toBe(before);
    act(() => view.dispatch(view.state.tr.insertText("Edited ", 1)));
    expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["legacy-a", "legacy-b"]);
  });

  it("does not create persisted locks from code literals when the user edits", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const onRecoveryError = vi.fn();
    const mounted = render(
      <EditorCore
        initialContent={
          "Writer\n\n`<!-- lock:inline_literal -->`\n\n```text\n<!-- lock:block_literal -->\n```"
        }
        onReady={onReady}
        onChange={onChange}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    act(() => view.dispatch(view.state.tr.insertText("Edited ", 1)));
    const [markdown, ids] = onChange.mock.calls.at(-1)!;
    expect(ids).toEqual([]);
    mounted.unmount();
    onReady.mockClear();
    render(
      <EditorCore
        initialContent={markdown}
        initialLocks={ids}
        onReady={onReady}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    expect(onRecoveryError).not.toHaveBeenCalled();
  });

  it("blocks an unsafe controlled refresh and resumes only after a valid retry", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const onRecoveryError = vi.fn();
    const mounted = render(
      <EditorCore
        initialContent="Current local draft"
        contentVersion={0}
        onReady={onReady}
        onChange={onChange}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    const before = view.state.doc;
    mounted.rerender(
      <EditorCore
        initialContent="Recovered plain text"
        initialLocks={["missing-lock"]}
        contentVersion={1}
        onReady={onReady}
        onChange={onChange}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onRecoveryError).toHaveBeenCalled());
    expect(view.state.doc).toBe(before);
    expect(view.editable).toBe(false);
    expect(
      view.state.applyTransaction(view.state.tr.insertText("Unsafe edit ", 1)).transactions
    ).toEqual([]);
    expect(
      mounted.container.querySelector("pre[data-testid='unrecovered-draft']")
    ).toHaveTextContent("Recovered plain text");
    expect(onChange).not.toHaveBeenCalled();

    mounted.rerender(
      <EditorCore
        initialContent="Recovered plain text"
        initialLocks={[]}
        contentVersion={2}
        onReady={onReady}
        onChange={onChange}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(view.editable).toBe(true));
    expect(view.state.doc.textContent).toBe("Recovered plain text");
    act(() => view.dispatch(view.state.tr.insertText("Safe edit ", 1)));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("retains damaged original content and metadata while blocking editing", async () => {
    const original = "# Original draft\n\nProtected <!-- lock:damaged";
    const metadata = ["damaged"];
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const onRecoveryError = vi.fn();
    const mounted = render(
      <EditorCore
        initialContent={original}
        initialLocks={metadata}
        onReady={onReady}
        onChange={onChange}
        onRecoveryError={onRecoveryError}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());

    expect(onRecoveryError).toHaveBeenCalledWith(expect.any(Error));
    expect(mounted.container.querySelector('[data-state="recovery-error"]')).toBeInTheDocument();
    expect(
      mounted.container.querySelector("pre[data-testid='unrecovered-draft']")
    ).toHaveTextContent("Protected <!-- lock:damaged");
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    const before = view.state.doc;
    expect(
      view.state.applyTransaction(
        view.state.tr.insertText("Unsafe AI edit ", 1).setMeta("aiAction", true)
      ).transactions
    ).toEqual([]);
    act(() => view.dispatch(view.state.tr.insertText("Unsafe edit ", 1)));
    expect(view.state.doc).toBe(before);
    expect(view.editable).toBe(false);
    expect(metadata).toEqual(["damaged"]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
