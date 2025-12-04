import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { useTaskSync } from "./useTaskSync";

const record = (overrides: Partial<ReturnType<typeof baseRecord>> = {}) => ({
  ...baseRecord(),
  ...overrides,
});

function baseRecord() {
  return {
    id: "task-1",
    content: "server-content",
    lock_ids: ["lock_a"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 0,
  };
}

const metaKey = "impetus.task.meta";
const cacheKey = "impetus.task.cache";

function mockFetchQueue(queue: Array<{ status?: number; body?: unknown; reject?: Error }>) {
  return vi.fn(async (_url: string, _options?: RequestInit) => {
    const next = queue.shift();
    if (!next) {
      throw new Error("No mock response");
    }
    if (next.reject) {
      throw next.reject;
    }
    return {
      ok: next.status !== undefined ? next.status >= 200 && next.status < 300 : true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as Response;
  });
}

describe("useTaskSync", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("hydrates from existing task id", async () => {
    localStorage.setItem(metaKey, JSON.stringify({ taskId: "task-1", version: 0 }));
    const fetchMock = mockFetchQueue([{ status: 200, body: record() }]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskSync("local-default"));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.content).toBe("server-content");
    expect(result.current.lockIds).toEqual(["lock_a"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to local cache when API fails", async () => {
    localStorage.setItem(cacheKey, "cached-draft");
    const fetchMock = mockFetchQueue([{ reject: new Error("network fail") }]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskSync("default"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.content).toBe("cached-draft");
    expect(result.current.error).toContain("Task API unavailable");
  });

  it("saves changes with optimistic versioning", async () => {
    const created = record({ version: 0 });
    const updated = record({ content: "updated", lock_ids: ["lock_z"], version: 1 });
    const fetchMock = mockFetchQueue([
      { status: 200, body: created }, // create
      { status: 200, body: updated }, // update
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskSync("initial"));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.onChange("updated", ["lock_z"]);
    });

    await waitFor(() => expect(result.current.version).toBe(1), { timeout: 3000 });
    expect(result.current.lockIds).toContain("lock_z");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
