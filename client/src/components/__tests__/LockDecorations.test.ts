import { describe, it, expect, vi, beforeEach } from "vitest";

import * as LockDecorations from "../Editor/LockDecorations";

import { Schema } from "@milkdown/prose/model";
import { EditorState } from "@milkdown/prose/state";
import { EditorView } from "@milkdown/prose/view";
import { LockManager } from "../../services/LockManager";
import { afterEach } from "vitest";

const views: EditorView[] = [];
function createMockView() {
  const schema = new Schema({
    nodes: {
      doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] },
      text: {},
    },
  });
  const view = new EditorView(document.createElement("div"), {
    state: EditorState.create({ schema }),
  });
  vi.spyOn(view, "updateState");
  views.push(view);
  return view;
}
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
});

describe("applyLockDecorations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("installs the plugin once per view", () => {
    const view = createMockView();

    LockDecorations.applyLockDecorations(view, new LockManager());
    LockDecorations.applyLockDecorations(view, new LockManager());

    expect(view.updateState).toHaveBeenCalledTimes(1);
    expect(
      view.state.plugins.some((plugin) => plugin?.spec?.key === LockDecorations.lockDecorationsKey)
    ).toBe(true);
  });

  it("reinstalls on a new EditorView instance", () => {
    const viewA = createMockView();
    const viewB = createMockView();

    LockDecorations.applyLockDecorations(viewA, new LockManager());
    LockDecorations.applyLockDecorations(viewB, new LockManager());

    expect(viewA.updateState).toHaveBeenCalledTimes(1);
    expect(viewB.updateState).toHaveBeenCalledTimes(1);
    expect(
      viewA.state.plugins.some((plugin) => plugin?.spec?.key === LockDecorations.lockDecorationsKey)
    ).toBe(true);
    expect(
      viewB.state.plugins.some((plugin) => plugin?.spec?.key === LockDecorations.lockDecorationsKey)
    ).toBe(true);
  });
});
