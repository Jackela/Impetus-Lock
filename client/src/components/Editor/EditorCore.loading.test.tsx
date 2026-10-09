import { act, cleanup, render, waitFor } from "@testing-library/react";
import { Editor, editorViewCtx } from "@milkdown/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorCore } from "./EditorCore";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EditorCore content arriving during initialization", () => {
  it.each([
    // Task.create returns version 0; TaskResponse preserves that value.
    ["new task version 0", 0, 0, "Loaded task"],
    ["changed nonzero version", 0, 7, "Loaded task"],
    ["uncontrolled initial-only content", undefined, undefined, "Default story"],
  ] as const)(
    "reconciles %s without losing local edits or native lock enforcement",
    async (_label, initialVersion, loadedVersion, expectedHeading) => {
      let releaseCreation = () => {};
      const creationGate = new Promise<void>((resolve) => {
        releaseCreation = resolve;
      });
      const makeEditor = Editor.make;
      vi.spyOn(Editor, "make").mockImplementation(() => {
        const editor = makeEditor();
        const createEditor = editor.create;
        // Delay the public library readiness promise, preserving the real
        // editor, parser, document, view and every installed plugin.
        vi.spyOn(editor, "create").mockImplementation(async () => {
          const created = await createEditor();
          await creationGate;
          return created;
        });
        return editor;
      });

      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn<(markdown: string, lockIds: string[]) => void>();
      const loadedLocks = ["loading_lock"];
      const loadedMarkdown =
        "# Loaded task\n\n> Protected task text <!-- lock:loading_lock source:muse -->";
      const mounted = render(
        <EditorCore
          initialContent="# Default story"
          contentVersion={initialVersion}
          onReady={onReady}
          onChange={onChange}
        />
      );

      try {
        await waitFor(() =>
          expect(mounted.container.querySelector("h1")).toHaveTextContent("Default story")
        );
        expect(onReady).not.toHaveBeenCalled();
        mounted.rerender(
          <EditorCore
            initialContent={loadedMarkdown}
            initialLocks={loadedLocks}
            contentVersion={loadedVersion}
            onReady={onReady}
            onChange={onChange}
          />
        );
        expect(onReady).not.toHaveBeenCalled();
        await act(async () => releaseCreation());
        await waitFor(() => expect(onReady).toHaveBeenCalledOnce());

        const ready = onReady.mock.calls.at(0);
        if (!ready) throw new Error("Editor did not initialize");
        const editor = ready[0];
        const view = editor.action((ctx) => ctx.get(editorViewCtx));
        await waitFor(() =>
          expect(mounted.container.querySelector("h1")).toHaveTextContent(expectedHeading)
        );
        expect(view.state.doc.firstChild?.textContent).toBe(expectedHeading);
        expect(onChange).not.toHaveBeenCalled();

        if (loadedVersion !== undefined) {
          expect(mounted.container.querySelector("blockquote")).toHaveTextContent(
            "Protected task text"
          );
          expect(
            mounted.container.querySelector('[data-lock-id="loading_lock"]')
          ).toBeInTheDocument();
          act(() => {
            const before = view.state.doc;
            const first = before.firstChild;
            if (!first) throw new Error("Loaded heading is missing");
            const deletion = view.state.tr.delete(first.nodeSize, before.content.size);
            expect(view.state.applyTransaction(deletion).transactions).toEqual([]);
            view.dispatch(deletion);
            expect(view.state.doc.eq(before)).toBe(true);
          });
          expect(onChange).not.toHaveBeenCalled();
        }

        act(() => view.dispatch(view.state.tr.insertText("Typed ", 1)));
        expect(view.state.doc.firstChild?.textContent).toBe(`Typed ${expectedHeading}`);
        expect(onChange).toHaveBeenCalledOnce();
        if (loadedVersion !== undefined) {
          expect(onChange.mock.calls.at(-1)?.[0]).toContain(
            "<!-- lock:loading_lock source:muse -->"
          );
          expect(onChange.mock.calls.at(-1)?.[1]).toContain("loading_lock");
        }
        const editedDocument = view.state.doc;
        const editedSelection = view.state.selection;
        const installedPlugins = view.state.plugins;
        const editorDom = view.dom;
        onChange.mockClear();
        mounted.rerender(
          <EditorCore
            initialContent={loadedMarkdown}
            initialLocks={loadedLocks}
            contentVersion={loadedVersion}
            externalTrigger={null}
            onReady={onReady}
            onChange={onChange}
          />
        );
        expect(view.state.doc).toBe(editedDocument);
        expect(view.state.selection).toBe(editedSelection);
        expect(view.state.plugins).toBe(installedPlugins);
        expect(mounted.container.querySelector(".ProseMirror")).toBe(editorDom);
        expect(onReady).toHaveBeenCalledOnce();
        expect(onChange).not.toHaveBeenCalled();

        // Uncontrolled content remains initial-only even after later prop changes.
        if (loadedVersion === undefined) {
          mounted.rerender(
            <EditorCore
              initialContent="# After readiness"
              contentVersion={undefined}
              onReady={onReady}
              onChange={onChange}
            />
          );
          expect(view.state.doc).toBe(editedDocument);
          expect(view.dom).toBe(editorDom);
          expect(onReady).toHaveBeenCalledOnce();
          expect(onChange).not.toHaveBeenCalled();
        }
      } finally {
        releaseCreation();
      }
    }
  );
});

describe("EditorCore controlled loading after readiness", () => {
  it.each([0, 7])(
    "loads supplied content at version %s without emitting a user edit",
    async (version) => {
      const onReady = vi.fn<(editor: Editor) => void>();
      const onChange = vi.fn<(markdown: string, lockIds: string[]) => void>();
      const mounted = render(
        <EditorCore
          initialContent="# Placeholder"
          contentVersion={0}
          onReady={onReady}
          onChange={onChange}
        />
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
      const ready = onReady.mock.calls.at(0);
      if (!ready) throw new Error("Editor did not initialize");
      const view = ready[0].action((ctx) => ctx.get(editorViewCtx));
      const dom = view.dom;
      const plugins = view.state.plugins;
      onChange.mockClear();
      mounted.rerender(
        <EditorCore
          initialContent="# After readiness"
          contentVersion={version}
          onReady={onReady}
          onChange={onChange}
        />
      );
      await waitFor(() => expect(view.state.doc.firstChild?.textContent).toBe("After readiness"));
      expect(view.dom).toBe(dom);
      expect(view.state.plugins).toBe(plugins);
      expect(onReady).toHaveBeenCalledOnce();
      expect(onChange).not.toHaveBeenCalled();
    }
  );
});
