import { act, cleanup, render, waitFor } from "@testing-library/react";
import { editorViewCtx, type Editor } from "@milkdown/core";
import { TextSelection } from "@milkdown/prose/state";
import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemoteSession } from "../../services/api/remoteSession";
import { AIActionType } from "../../types/ai-actions";
import { EditorCore } from "./EditorCore";
import { ManualTriggerButton } from "../ManualTriggerButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function currentSession(): RemoteSession {
  return {
    userId: "account-a",
    generation: 1,
    signal: new AbortController().signal,
    isCurrent: () => true,
    onUnauthorized: vi.fn(),
  };
}

describe("EditorCore remote request lifetime", () => {
  it("accepts a second public Muse click after the parent clears the first trigger", async () => {
    const session = currentSession();
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const requests: RequestInit[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, options) => {
      if (!String(input).includes("/impetus/generate-intervention"))
        return new Response(new ArrayBuffer(8));
      requests.push(options ?? {});
      const lastNode = view.state.doc.lastChild!;
      return new Response(
        JSON.stringify({
          action: "rewrite",
          content: `Protected contribution ${requests.length}.`,
          lock_id: `manual-lock-${requests.length}`,
          source: "muse",
          anchor: {
            type: "range",
            from: view.state.doc.content.size - lastNode.nodeSize,
            to: view.state.doc.content.size,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    function Writer() {
      const [trigger, setTrigger] = useState<AIActionType | null>(null);
      const clearTrigger = useCallback(() => setTrigger(null), []);
      return (
        <>
          <ManualTriggerButton mode="muse" onTrigger={setTrigger} />
          <EditorCore
            initialContent="Original writer.\n\nFirst editable target."
            requestIdentity="manual-writer"
            session={session}
            mode="muse"
            externalTrigger={trigger}
            onTriggerProcessed={clearTrigger}
            onReady={onReady}
            onChange={onChange}
          />
        </>
      );
    }
    const mounted = render(<Writer />);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    vi.useFakeTimers();
    const button = mounted.getByRole("button", {
      name: "I'm stuck! Trigger AI assistance",
    });
    await act(async () => button.click());
    expect(requests).toHaveLength(1);
    expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["manual-lock-1"]);
    const firstParagraphs = view.state.doc.toJSON().content;
    act(() => button.click());
    expect(requests).toHaveLength(1);
    await act(async () => vi.advanceTimersByTimeAsync(4100));
    expect(button).toBeEnabled();
    act(() => {
      const paragraph = view.state.schema.nodes.paragraph!.create(
        null,
        view.state.schema.text("Second editable target.")
      );
      view.dispatch(view.state.tr.insert(view.state.doc.content.size, paragraph));
      // Insertion at an explicit position does not move the writer's selection.
      view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
    });
    await act(async () => button.click());
    expect(requests).toHaveLength(2);
    expect(JSON.parse(String(requests[1]!.body)).context).toContain("Second editable target.");
    expect(view.state.doc.toJSON().content.slice(0, 2)).toEqual(firstParagraphs);
    expect(view.state.doc.lastChild!.textContent).toContain("Protected contribution 2.");
    expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["manual-lock-1", "manual-lock-2"]);
    const protectedDocument = view.state.doc;
    act(() => view.dispatch(view.state.tr.delete(0, view.state.doc.content.size)));
    expect(view.state.doc).toBe(protectedDocument);
    await act(async () => vi.advanceTimersByTimeAsync(4100));
    expect(requests).toHaveLength(2);
  });

  it("pauses automatic and manual AI while retaining local writing and locks", async () => {
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const onTimerUpdate = vi.fn();
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async () => new Response(new ArrayBuffer(8)));
    const content = `${"Writer text. ".repeat(30)}\n\n> Protected text <!-- lock:paused-lock source:muse -->`;
    const mounted = render(
      <EditorCore
        initialContent={content}
        initialLocks={["paused-lock"]}
        session={null}
        mode="muse"
        onReady={onReady}
        onChange={onChange}
        onTimerUpdate={onTimerUpdate}
      />
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    const before = view.state.doc;
    vi.useFakeTimers();
    mounted.rerender(
      <EditorCore
        initialContent={content}
        initialLocks={["paused-lock"]}
        session={null}
        mode="muse"
        externalTrigger={AIActionType.DELETE}
        onReady={onReady}
        onChange={onChange}
        onTimerUpdate={onTimerUpdate}
      />
    );
    await act(async () => vi.advanceTimersByTimeAsync(120_000));

    expect(view.state.doc).toBe(before);
    expect(onTimerUpdate).not.toHaveBeenCalled();
    expect(
      fetchSpy.mock.calls.filter(([url]) => String(url).includes("/impetus/generate-intervention"))
    ).toEqual([]);
    act(() => view.dispatch(view.state.tr.insertText("Local edit ", 1)));
    expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["paused-lock"]);
    const edited = view.state.doc;
    act(() =>
      view.dispatch(
        view.state.tr.delete(view.state.doc.firstChild!.nodeSize, view.state.doc.content.size)
      )
    );
    expect(view.state.doc).toBe(edited);
  });

  it.each([
    ["muse", "provoke"],
    ["muse", "rewrite"],
    ["muse", "delete"],
    ["loki", "provoke"],
    ["loki", "rewrite"],
    ["loki", "delete"],
  ] as const)(
    "ignores a previous draft's %s %s response within the same session",
    async (mode, action) => {
      const session = currentSession();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      let finishRequest!: (response: Response) => void;
      const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        if (String(input).includes("/impetus/generate-intervention")) {
          return new Promise((resolve) => {
            finishRequest = resolve;
          });
        }
        return new Response(new ArrayBuffer(8));
      });
      const mounted = render(
        <EditorCore
          initialContent="Draft A sentence."
          contentVersion={0}
          requestIdentity="draft-a"
          session={session}
          mode={mode}
          onReady={onReady}
          onChange={onChange}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      mounted.rerender(
        <EditorCore
          initialContent="Draft A sentence."
          contentVersion={0}
          requestIdentity="draft-a"
          session={session}
          mode={mode}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
          onReady={onReady}
          onChange={onChange}
        />
      );
      await waitFor(() =>
        expect(
          fetchSpy.mock.calls.some(([url]) =>
            String(url).includes("/impetus/generate-intervention")
          )
        ).toBe(true)
      );

      const onDraftBChange = vi.fn();
      mounted.rerender(
        <EditorCore
          initialContent="Draft B sentence."
          contentVersion={1}
          requestIdentity="draft-b"
          session={session}
          mode={mode}
          onReady={onReady}
          onChange={onDraftBChange}
        />
      );
      await act(async () =>
        finishRequest(
          new Response(
            JSON.stringify({
              action,
              content: "Late text from draft A",
              lock_id: "late-a-lock",
              source: mode,
            })
          )
        )
      );

      expect(mounted.container.querySelector(".milkdown")).toHaveTextContent("Draft B sentence.");
      expect(mounted.container.querySelector(".milkdown")).not.toHaveTextContent("Late text");
      expect(onDraftBChange).not.toHaveBeenCalled();
      expect(
        onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx).state.doc.textContent)
      ).toBe("Draft B sentence.");
      act(() =>
        onReady.mock.calls[0]![0].action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.dispatch(view.state.tr.insertText("Local B edit ", 1));
        })
      );
      expect(onDraftBChange.mock.calls.at(-1)?.[1]).toEqual([]);
    }
  );

  it.each([200, 403])(
    "ignores an in-flight response or error after remote work is paused (%s)",
    async (status) => {
      const session = currentSession();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const onInterventionError = vi.fn();
      let finishRequest!: (response: Response) => void;
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        if (String(input).includes("/impetus/generate-intervention"))
          return new Promise((resolve) => {
            finishRequest = resolve;
          });
        return new Response(new ArrayBuffer(8));
      });
      const content = "Writer sentence.\n\n> Protected <!-- lock:retained-lock source:muse -->";
      const mounted = render(
        <EditorCore
          initialContent={content}
          session={session}
          mode="muse"
          onReady={onReady}
          onChange={onChange}
          onInterventionError={onInterventionError}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      mounted.rerender(
        <EditorCore
          initialContent={content}
          session={session}
          mode="muse"
          externalTrigger={AIActionType.PROVOKE}
          onReady={onReady}
          onChange={onChange}
          onInterventionError={onInterventionError}
        />
      );
      await waitFor(() => expect(finishRequest).toBeDefined());
      mounted.rerender(
        <EditorCore
          initialContent={content}
          session={null}
          mode="muse"
          onReady={onReady}
          onChange={onChange}
          onInterventionError={onInterventionError}
        />
      );
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => view.dispatch(view.state.tr.insertText("Continued locally ", 1)));
      const before = view.state.doc;
      onChange.mockClear();
      await act(async () =>
        finishRequest(
          new Response(
            JSON.stringify({
              action: "provoke",
              content: "Late response",
              lock_id: "late-lock",
              source: "muse",
            }),
            { status }
          )
        )
      );
      expect(view.state.doc).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
      expect(onInterventionError).not.toHaveBeenCalled();
      expect(
        mounted.container.querySelector('[data-animation="error-flash"]')
      ).not.toBeInTheDocument();
    }
  );

  it.each([200, 403])(
    "ignores a destroyed editor's completion and dispatch after another draft mounts (%s)",
    async (status) => {
      const onOldReady = vi.fn<(editor: Editor) => void>();
      const onOldChange = vi.fn();
      const onOldError = vi.fn();
      let finishRequest!: (response: Response) => void;
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        if (String(input).includes("/impetus/generate-intervention"))
          return new Promise((resolve) => {
            finishRequest = resolve;
          });
        return new Response(new ArrayBuffer(8));
      });
      const old = render(
        <EditorCore
          initialContent="Old draft."
          mode="muse"
          onReady={onOldReady}
          onChange={onOldChange}
          onInterventionError={onOldError}
        />
      );
      await waitFor(() => expect(onOldReady).toHaveBeenCalledOnce());
      old.rerender(
        <EditorCore
          initialContent="Old draft."
          mode="muse"
          externalTrigger={AIActionType.PROVOKE}
          onReady={onOldReady}
          onChange={onOldChange}
          onInterventionError={onOldError}
        />
      );
      await waitFor(() => expect(finishRequest).toBeDefined());
      const oldView = onOldReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      const before = oldView.state.doc;
      old.unmount();
      const onNewReady = vi.fn<(editor: Editor) => void>();
      const onNewChange = vi.fn();
      const next = render(
        <EditorCore initialContent="New draft." onReady={onNewReady} onChange={onNewChange} />
      );
      await waitFor(() => expect(onNewReady).toHaveBeenCalledOnce());
      await act(async () =>
        finishRequest(
          new Response(
            JSON.stringify({
              action: "provoke",
              content: "Late response",
              lock_id: "late-lock",
              source: "muse",
            }),
            { status }
          )
        )
      );
      act(() => oldView.dispatch(oldView.state.tr.insertText("Old dispatch ", 1)));
      expect(oldView.state.doc).toBe(before);
      expect(next.container.querySelector(".milkdown")).toHaveTextContent("New draft.");
      expect(onOldChange).not.toHaveBeenCalled();
      expect(onOldError).not.toHaveBeenCalled();
      expect(onNewChange).not.toHaveBeenCalled();
    }
  );
});
