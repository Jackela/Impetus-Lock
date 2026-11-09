/**
 * Production-bundle guard for the editor's window test hooks.
 *
 * `EditorCore` publishes `lockManager`, `editorInstance`, `insertLockedContentForTest`,
 * `triggerMuseRewriteForTest`, and `triggerManualDeleteForTest` on `window` for the
 * Playwright suites that run against the Vite dev server. Those globals must never
 * reach real users, so the block is gated on `import.meta.env.DEV`, which the
 * bundler replaces with a literal `false` and eliminates in a production build.
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import type { Editor } from "@milkdown/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorCore } from "./EditorCore";

const HOOK_NAMES = [
  "lockManager",
  "editorInstance",
  "insertLockedContentForTest",
  "triggerMuseRewriteForTest",
  "triggerManualDeleteForTest",
] as const;

type HookName = (typeof HOOK_NAMES)[number];

function clearHooks(): void {
  for (const name of HOOK_NAMES) Reflect.deleteProperty(window, name);
}

async function renderEditor() {
  const onReady = vi.fn<(editor: Editor) => void>();
  const mounted = render(<EditorCore initialContent="编辑中的段落。" onReady={onReady} />);
  await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
  return mounted;
}

function installedHooks(): HookName[] {
  return HOOK_NAMES.filter((name) => window[name] !== undefined);
}

beforeEach(() => {
  clearHooks();
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
  clearHooks();
  vi.restoreAllMocks();
});

describe("EditorCore window test hooks", () => {
  it("publishes the hooks on a development server so E2E helpers keep working", async () => {
    expect(import.meta.env.DEV).toBe(true);

    const mounted = await renderEditor();

    expect(installedHooks()).toEqual([...HOOK_NAMES]);
    // The helpers really target the live editor and lock store.
    expect(typeof window.insertLockedContentForTest).toBe("function");
    expect(mounted.getByTestId("editor-ready")).toBeTruthy();
  });

  it("publishes nothing when the build is not a development build", async () => {
    const env = import.meta.env as unknown as Record<string, unknown>;
    const original = env.DEV;
    env.DEV = false;
    try {
      await renderEditor();
      expect(installedHooks()).toEqual([]);
    } finally {
      env.DEV = original;
    }
  });

  it("guards the hook block with the DEV flag that the bundler can eliminate", async () => {
    const source = await import("./EditorCore.tsx?raw");
    const text = String((source as { default?: string }).default ?? "");
    const guard = text.indexOf('if (import.meta.env.DEV && typeof window !== "undefined")');
    expect(guard).toBeGreaterThan(-1);
    // Every hook assignment must live inside the guarded block.
    for (const name of HOOK_NAMES) {
      const assignment = text.indexOf(`testWindow.${name} =`);
      expect(assignment).toBeGreaterThan(guard);
    }
  });
});
