import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LockManagerProvider } from "../contexts/LockManagerContext";
import { useLockEnforcement } from "./useLockEnforcement";

describe("useLockEnforcement with its real provider", () => {
  it("updates visible locks and count after applying, merging, and removing locks", () => {
    const { result } = renderHook(() => useLockEnforcement(), {
      wrapper: LockManagerProvider,
    });
    expect(result.current.locks).toEqual([]);
    expect(result.current.lockCount).toBe(0);

    act(() => result.current.applyLock("lock_first", { source: "muse" }));
    expect(result.current.locks).toEqual(["lock_first"]);
    expect(result.current.hasLock("lock_first")).toBe(true);
    expect(result.current.lockCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    act(() => result.current.applyLock("lock_first", { source: "loki" }));
    expect(result.current.lockCount).toBe(1);
    act(() => result.current.applyLock("lock_second"));
    expect(result.current.lockCount).toBe(2);
    act(() => result.current.removeLock("lock_first"));
    expect(result.current.locks).toEqual(["lock_second"]);
    expect(result.current.hasLock("lock_first")).toBe(false);
    expect(result.current.lockCount).toBe(1);
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.removeLock("missing"));
    expect(result.current.lockCount).toBe(1);
  });

  it("round-trips source-aware Markdown lock markers without registering new locks", () => {
    const { result } = renderHook(() => useLockEnforcement(), {
      wrapper: LockManagerProvider,
    });
    let markdown = "";
    act(() => {
      markdown = result.current.injectLockComment("Keep this", "lock_story", {
        source: "muse",
      });
    });
    expect(markdown).toBe("Keep this <!-- lock:lock_story source:muse -->");
    act(() => {
      expect(result.current.extractLocks(markdown)).toEqual(["lock_story"]);
      expect(result.current.extractLocks("Ordinary writing")).toEqual([]);
      result.current.clearError();
    });
    expect(result.current.locks).toEqual([]);
    expect(result.current.lockCount).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
