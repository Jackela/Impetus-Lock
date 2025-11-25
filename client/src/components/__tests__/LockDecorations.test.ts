import { describe, it, expect, vi, beforeEach } from "vitest";

import * as LockDecorations from "../Editor/LockDecorations";

type MockPlugin = { spec?: { key?: unknown } };
type MockState = {
  plugins: MockPlugin[];
  reconfigure: ReturnType<typeof vi.fn<(config: { plugins: MockPlugin[] }) => MockState>>;
};
type MockView = {
  state: MockState;
  updateState: ReturnType<typeof vi.fn<(nextState: MockState) => void>>;
};

function createMockView(): MockView {
  const baseState: MockState = {
    plugins: [],
    reconfigure: vi.fn((config: { plugins: MockPlugin[] }) => ({
      ...baseState,
      plugins: config.plugins,
    })),
  };

  const view: MockView = {
    state: baseState,
    updateState: vi.fn((nextState: MockState) => {
      view.state = nextState;
    }),
  };

  return view;
}

describe("applyLockDecorations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("installs the plugin once per view", () => {
    const view = createMockView();

    LockDecorations.applyLockDecorations(view);
    LockDecorations.applyLockDecorations(view);

    expect(view.updateState).toHaveBeenCalledTimes(1);
    expect(
      view.state.plugins.some((plugin) => plugin?.spec?.key === LockDecorations.lockDecorationsKey)
    ).toBe(true);
  });

  it("reinstalls on a new EditorView instance", () => {
    const viewA = createMockView();
    const viewB = createMockView();

    LockDecorations.applyLockDecorations(viewA);
    LockDecorations.applyLockDecorations(viewB);

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
