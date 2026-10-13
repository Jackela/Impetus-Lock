import { act, cleanup, render, waitFor } from "@testing-library/react";
import { editorViewCtx, type Editor } from "@milkdown/core";
import { history, undo } from "@milkdown/prose/history";
import { TextSelection } from "@milkdown/prose/state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIActionType } from "../../types/ai-actions";
import { EditorCore } from "./EditorCore";

// jsdom has no layout, while the selection toolbar requests text rectangles.
beforeEach(() => {
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [new DOMRect(0, 0, 10, 10)],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 10, 10),
  });
});
afterEach(() => {
  Reflect.deleteProperty(Range.prototype, "getClientRects");
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  cleanup();
  vi.restoreAllMocks();
});

let requestTime = Date.now();

function deferredInterventions() {
  // Separate independent scenarios beyond the service's global delete throttle.
  requestTime += 10_000;
  vi.spyOn(Date, "now").mockReturnValue(requestTime);
  const requests: {
    body: {
      context: string;
      client_meta: { selection_from: number; selection_to: number; doc_version: number };
    };
    finish: (response: Response) => void;
  }[] = [];
  vi.spyOn(global, "fetch").mockImplementation(async (input, options) => {
    if (!String(input).includes("/impetus/generate-intervention"))
      return new Response(new ArrayBuffer(8));
    return new Promise<Response>((finish) => {
      requests.push({ body: JSON.parse(String(options?.body)), finish });
    });
  });
  return requests;
}

describe("EditorCore intervention document snapshot", () => {
  it.each(["muse", "loki"] as const)(
    "sends %s context and coordinates from the live cursor after selection-only movement",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const props = {
        initialContent:
          "# 开场😊。\n\n第一句话。**第二句话**！他打开门🚪，还没\n\n后面的情节不应发送。",
        mode,
        onReady,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      let cursor = 0;
      view.state.doc.descendants((node, pos) => {
        if (node.isText && node.text!.includes("还没")) cursor = pos + node.text!.length;
      });
      act(() =>
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)))
      );
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0]!.body.context).toBe("第一句话。第二句话！他打开门🚪，还没");
      expect(requests[0]!.body.client_meta).toEqual({
        selection_from: cursor,
        selection_to: cursor,
        doc_version: 0,
      });
    }
  );

  it.each([
    ["muse", "provoke"],
    ["muse", "rewrite"],
    ["muse", "delete"],
    ["loki", "provoke"],
    ["loki", "rewrite"],
    ["loki", "delete"],
  ] as const)(
    "ignores delayed %s %s after accepted writing changed its target",
    async (mode, action) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = {
        initialContent:
          "这是一个等待干预的较长原始句子。\n\n> 已有锁定内容 <!-- lock:existing-lock source:muse -->",
        mode,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() =>
        view.dispatch(
          view.state.tr.setSelection(
            TextSelection.create(view.state.doc, view.state.doc.firstChild!.nodeSize - 1)
          )
        )
      );
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      act(() => view.dispatch(view.state.tr.insertText("作者继续写作。", 1)));
      const edited = view.state.doc;
      onChange.mockClear();
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action,
              content: "不应落入新版本的旧响应",
              lock_id: "stale-lock",
              source: mode,
              anchor:
                action === "provoke"
                  ? { type: "pos", from: 1 }
                  : { type: "range", from: 1, to: 13 },
            })
          )
        )
      );
      expect(view.state.doc).toBe(edited);
      expect(onChange).not.toHaveBeenCalled();
      act(() => view.dispatch(view.state.tr.insertText("再次写作。", 1)));
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["existing-lock"]);
    }
  );

  it.each(["muse", "loki"] as const)(
    "invalidates delayed %s even after switching away and back",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = { initialContent: "模式切换之前正在编辑的中文句子。", onReady, onChange };
      const mounted = render(<EditorCore {...props} mode={mode} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      mounted.rerender(
        <EditorCore
          {...props}
          mode={mode}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      mounted.rerender(<EditorCore {...props} mode="off" />);
      mounted.rerender(<EditorCore {...props} mode={mode} />);
      const before = view.state.doc;
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action: "provoke",
              content: "旧模式响应",
              lock_id: "stale-mode-lock",
              source: mode,
              anchor: { type: "pos", from: 1 },
            })
          )
        )
      );
      expect(view.state.doc).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
    }
  );
  it.each(["muse", "loki"] as const)(
    "bounds long %s context to a literal 2000-character suffix",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const initialContent = "起点" + "🚪未完".repeat(800);
      const props = { initialContent, mode, onReady };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc))));
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0]!.body.context).toBe(Array.from(initialContent).slice(-2000).join(""));
    }
  );

  it.each(["muse", "loki"] as const)(
    "sends both ends of a backward %s selection with context ending at selection.to",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const props = { initialContent: "保留前句。短句。后续不发送。", mode, onReady };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() =>
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 9, 6)))
      );
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0]!.body.context).toBe("保留前句。短句。");
      expect(requests[0]!.body.client_meta).toEqual({
        selection_from: 6,
        selection_to: 9,
        doc_version: 0,
      });
    }
  );

  it.each([0, 1])(
    "accepts the first completed valid snapshot response (request %s), then rejects its stale peer",
    async (first) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = {
        initialContent: "保留前句。短句。",
        mode: "muse" as const,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc))));
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      mounted.rerender(<EditorCore {...props} />);
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
      await waitFor(() => expect(requests).toHaveLength(2));
      const respond = (index: number) =>
        requests[index]!.finish(
          new Response(
            JSON.stringify({
              action: "provoke",
              content: `有效响应${index}`,
              lock_id: `response-${index}`,
              source: "muse",
              anchor: { type: "pos", from: 9 },
            })
          )
        );
      await act(async () => respond(first));
      expect(view.state.doc.textContent).toContain(`保留前句。有效响应${first}`);
      expect(view.state.doc.textContent).not.toContain("短句。");
      const accepted = view.state.doc;
      onChange.mockClear();
      await act(async () => respond(1 - first));
      expect(view.state.doc).toBe(accepted);
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it.each(["muse", "loki"] as const)(
    "ignores delayed %s after an accepted edit is undone",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = { initialContent: "等待响应的句子。", mode, onReady, onChange };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, history()] }));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc))));
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      act(() => {
        view.dispatch(view.state.tr.insertText("编辑", 1));
        expect(undo(view.state, view.dispatch)).toBe(true);
      });
      expect(view.state.doc.textContent).toBe(props.initialContent);
      const restored = view.state.doc;
      onChange.mockClear();
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action: "provoke",
              content: "过期",
              lock_id: "old",
              source: mode,
              anchor: { type: "pos", from: 1 },
            })
          )
        )
      );
      expect(view.state.doc).toBe(restored);
      expect(onChange).not.toHaveBeenCalled();
      mounted.rerender(<EditorCore {...props} />);
      requestTime += 10000;
      vi.mocked(Date.now).mockReturnValue(requestTime);
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1]!.body.client_meta.doc_version).toBe(2);
    }
  );

  it.each(["muse", "loki"] as const)(
    "applies a returned %s rewrite range across marks at the captured cursor",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const target = "现在他打开门🚪，发现了秘密。";
      const props = {
        initialContent: "# 序章\n\n保留这一句。现在他**打开门🚪**，发现了秘密。后文仍在。",
        mode,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      let cursor = 0;
      view.state.doc.descendants((node, pos) => {
        if (node.isText && node.text!.includes("发现了秘密。"))
          cursor = pos + node.text!.indexOf("后文");
      });
      act(() =>
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, cursor)))
      );
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atStart(view.state.doc))));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action: "rewrite",
              content: "门后站着失踪的兄长。",
              lock_id: "new-lock",
              source: mode,
              anchor: { type: "range", from: cursor - target.length, to: cursor },
            })
          )
        )
      );
      expect(view.state.doc.textContent).toContain("序章保留这一句。");
      expect(view.state.doc.textContent).toContain("门后站着失踪的兄长。");
      expect(view.state.doc.textContent).toContain("后文仍在。");
      expect(view.state.doc.textContent).not.toContain(target);
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["new-lock"]);
    }
  );
  it.each([
    ["loki", "rewrite"],
    ["loki", "delete"],
  ] as const)(
    "ignores a %s cursor-tail %s reaching across an empty paragraph",
    async (mode, action) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = { initialContent: "必须保留的上一段。", mode, onReady, onChange };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => {
        view.dispatch(
          view.state.tr.insert(view.state.doc.content.size, view.state.schema.node("paragraph"))
        );
        view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      });
      const cursor = view.state.selection.to;
      const before = view.state.doc;
      onChange.mockClear();
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.CHAOS} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action,
              content: "不应落入上一段",
              lock_id: "invalid-lock",
              source: mode,
              anchor: {
                type: "range",
                from: cursor - requests[0]!.body.context.length,
                to: cursor,
              },
            })
          )
        )
      );
      expect(view.state.doc).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
      act(() => view.dispatch(view.state.tr.insertText("继续写作", cursor)));
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual([]);
    }
  );

  it.each([false, true])(
    "keeps the captured blank-paragraph Muse insertion and existing locks (continued typing=%s)",
    async (continuedTyping) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = {
        initialContent:
          "必须保留的上一段。\n\n> 已有锁定内容 <!-- lock:existing-lock source:muse -->",
        mode: "muse" as const,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      const originalParagraph = view.state.doc.firstChild!;
      const originalLock = view.state.doc.lastChild!;
      act(() => {
        view.dispatch(
          view.state.tr.insert(originalParagraph.nodeSize, view.state.schema.node("paragraph"))
        );
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 12)));
      });
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0]!.body.context).toBe("必须保留的上一段。\n");
      expect(requests[0]!.body.client_meta.selection_from).toBe(12);
      expect(requests[0]!.body.client_meta.selection_to).toBe(12);
      act(() => {
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
        if (continuedTyping) view.dispatch(view.state.tr.insertText("作者继续写作。", 12));
      });
      const beforeResponse = view.state.doc;
      onChange.mockClear();
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action: "rewrite",
              content: "开场提示。",
              lock_id: "opening-lock",
              source: "muse",
              // Actual InterventionService result for the asserted context/cursor.
              anchor: { type: "range", from: 2, to: 12 },
            })
          )
        )
      );
      if (continuedTyping) {
        expect(view.state.doc).toBe(beforeResponse);
        expect(onChange).not.toHaveBeenCalled();
        act(() => view.dispatch(view.state.tr.insertText("仍可续写。", 12)));
        expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["existing-lock"]);
      } else {
        expect(view.state.doc.firstChild!.toJSON()).toEqual(originalParagraph.toJSON());
        expect(view.state.doc.lastChild!.toJSON()).toEqual(originalLock.toJSON());
        expect(view.state.doc.textContent).toBe(
          `${originalParagraph.textContent}开场提示。 <!-- lock:opening-lock source:muse -->${originalLock.textContent}`
        );
        expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["existing-lock", "opening-lock"]);
        const protectedDocument = view.state.doc;
        act(() => view.dispatch(view.state.tr.delete(0, view.state.doc.content.size)));
        expect(view.state.doc).toBe(protectedDocument);
      }
    }
  );

  it.each([
    { name: "zero-length", from: 12, to: 12, selectionFrom: 12 },
    { name: "negative position", from: -1, to: 12, selectionFrom: 12 },
    { name: "out-of-bounds", from: 2, to: 99, selectionFrom: 12 },
    { name: "fractional position", from: 1.5, to: 12, selectionFrom: 12 },
    { name: "nonempty selection", from: 2, to: 12, selectionFrom: 1 },
  ])("rejects a blank-paragraph Muse rewrite with $name", async ({ from, to, selectionFrom }) => {
    const requests = deferredInterventions();
    const onReady = vi.fn<(editor: Editor) => void>();
    const onChange = vi.fn();
    const props = {
      initialContent: "必须保留的上一段。",
      mode: "muse" as const,
      onReady,
      onChange,
    };
    const mounted = render(<EditorCore {...props} />);
    await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
    act(() => {
      view.dispatch(
        view.state.tr.insert(view.state.doc.content.size, view.state.schema.node("paragraph"))
      );
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, selectionFrom, 12))
      );
    });
    const before = view.state.doc;
    onChange.mockClear();
    mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () =>
      requests[0]!.finish(
        new Response(
          JSON.stringify({
            action: "rewrite",
            content: "不能写入",
            lock_id: "invalid-lock",
            source: "muse",
            anchor: { type: "range", from, to },
          })
        )
      )
    );
    expect(view.state.doc).toBe(before);
    expect(onChange).not.toHaveBeenCalled();
    act(() => view.dispatch(view.state.tr.insertText("继续写作", 12)));
    expect(onChange.mock.calls.at(-1)?.[1]).toEqual([]);
  });

  it.each(["rewrite", "delete"] as const)(
    "rejects a %s anchor splitting an emoji without registering a lock",
    async (action) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = { initialContent: "保留🚪后文。", mode: "loki" as const, onReady, onChange };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc))));
      const before = view.state.doc;
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.CHAOS} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action,
              content: "不应写入",
              lock_id: "invalid-lock",
              source: "loki",
              anchor: { type: "range", from: 4, to: view.state.selection.to },
            })
          )
        )
      );
      expect(view.state.doc).toBe(before);
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it.each(["muse", "loki"] as const)(
    "keeps a valid explicit %s multi-block range without remapping it to the cursor sentence",
    async (mode) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = {
        initialContent: "第一段需要替换。\n\n第二段也需要替换。\n\n最后这一段必须保留。",
        mode,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => {
        view.dispatch(
          view.state.tr.insert(view.state.doc.content.size, view.state.schema.node("paragraph"))
        );
        view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
      });
      const to = view.state.doc.child(0).nodeSize + view.state.doc.child(1).nodeSize - 1;
      mounted.rerender(
        <EditorCore
          {...props}
          externalTrigger={mode === "muse" ? AIActionType.PROVOKE : AIActionType.CHAOS}
        />
      );
      await waitFor(() => expect(requests).toHaveLength(1));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action: "rewrite",
              content: "明确范围的替换。",
              lock_id: "explicit-lock",
              source: "loki",
              anchor: { type: "range", from: 1, to },
            })
          )
        )
      );
      expect(view.state.doc.textContent).toContain("明确范围的替换。");
      expect(view.state.doc.textContent).toContain("最后这一段必须保留。");
      expect(view.state.doc.textContent).not.toContain("第一段需要替换。");
      expect(view.state.doc.textContent).not.toContain("第二段也需要替换。");
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["explicit-lock"]);
    }
  );
  it.each([
    ["provoke", false],
    ["rewrite", false],
    ["provoke", true],
    ["rewrite", true],
  ] as const)(
    "keeps a captured %s insertion at the original paragraph start (empty=%s) after cursor movement",
    async (action, empty) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = {
        initialContent: "原段文字不能丢。\n\n后段句子必须保留。",
        mode: "muse" as const,
        onReady,
        onChange,
      };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      act(() => {
        if (empty) view.dispatch(view.state.tr.insert(0, view.state.schema.node("paragraph")));
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
      });
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      act(() => view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc))));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action,
              content: "开场提示。",
              lock_id: "opening-lock",
              source: "muse",
              anchor:
                action === "rewrite" ? { type: "range", from: 0, to: 1 } : { type: "pos", from: 1 },
            })
          )
        )
      );
      expect(view.state.doc.textContent).toContain("原段文字不能丢。");
      expect(view.state.doc.textContent).toContain("后段句子必须保留。");
      expect(view.state.doc.textContent.startsWith("开场提示。")).toBe(true);
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["opening-lock"]);
    }
  );

  it.each(["provoke", "rewrite"] as const)(
    "inserts an actual locked paragraph for empty-document Muse %s",
    async (action) => {
      const requests = deferredInterventions();
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn();
      const props = { initialContent: "", mode: "muse" as const, onReady, onChange };
      const mounted = render(<EditorCore {...props} />);
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const view = onReady.mock.calls[0]![0].action((ctx) => ctx.get(editorViewCtx));
      mounted.rerender(<EditorCore {...props} externalTrigger={AIActionType.PROVOKE} />);
      await waitFor(() => expect(requests).toHaveLength(1));
      await act(async () =>
        requests[0]!.finish(
          new Response(
            JSON.stringify({
              action,
              content: "故事从这扇门开始。",
              lock_id: "empty-lock",
              source: "muse",
              // InterventionService normalizes the empty-context fallback at cursor 1
              // to this range; document position 0 is outside the empty paragraph.
              anchor:
                action === "rewrite" ? { type: "range", from: 0, to: 1 } : { type: "pos", from: 1 },
            })
          )
        )
      );
      expect(view.state.doc.textContent).toContain("故事从这扇门开始。");
      expect(onChange.mock.calls.at(-1)?.[1]).toEqual(["empty-lock"]);
      let lockedParagraph = false;
      view.state.doc.descendants((node) => {
        if (node.type.name === "paragraph" && node.textContent.includes("故事从这扇门开始。"))
          lockedParagraph = true;
      });
      expect(lockedParagraph).toBe(true);
      const protectedDoc = view.state.doc;
      act(() => view.dispatch(view.state.tr.delete(0, view.state.doc.content.size)));
      expect(view.state.doc).toBe(protectedDoc);
    }
  );
});
