import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDraftRecovery } from "./useDraftRecovery";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("reports unreadable legacy content, refuses an incomplete download and retries without discarding either source", () => {
  localStorage.setItem("impetus.task.cache", "legacy body <!-- lock:original -->");
  const meta = '{"lockIds":["original"],"taskId":"A","version":4}';
  localStorage.setItem("impetus.task.meta", meta);
  const get = Storage.prototype.getItem;
  let blocked = true;
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
    if (blocked && key === "impetus.task.cache")
      throw new DOMException("Storage denied", "SecurityError");
    return get.call(this, key);
  });
  const download = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: download, revokeObjectURL: vi.fn() });
  const hook = renderHook(() => useDraftRecovery());
  expect(hook.result.current.legacy).toMatchObject({
    readFailed: true,
    metaRaw: meta,
    payload: null,
  });
  expect(hook.result.current.legacy?.error).toContain("could not be read");
  act(() => hook.result.current.exportLegacy());
  expect(download).not.toHaveBeenCalled();
  blocked = false;
  act(() => hook.result.current.retryLegacy());
  expect(hook.result.current.legacy).toMatchObject({
    contentRaw: "legacy body <!-- lock:original -->",
    metaRaw: meta,
    payload: {
      content: "legacy body <!-- lock:original -->",
      lockIds: ["original"],
      taskId: "A",
      version: 4,
    },
    error: null,
  });
  expect(localStorage.getItem("impetus.task.meta")).toBe(meta);
});
