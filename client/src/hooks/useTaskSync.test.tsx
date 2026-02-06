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

/**
 * Mock fetch with a queue of responses.
 */
function mockFetchQueue(queue: Array<{ status?: number; body?: unknown; reject?: Error }>) {
  return vi.fn(async () => {
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

  // ST-004: Test external task ID loading
  it("loads external task when externalTaskId changes", async () => {
    const defaultTask = record({ id: "task-default", content: "default task" });
    const task2 = record({ id: "task-2", content: "external task content", lock_ids: ["lock_b"] });
    const fetchMock = mockFetchQueue([
      { status: 200, body: defaultTask }, // bootstrap creates default task
      { status: 200, body: task2 }, // then loads external task
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ externalTaskId }) => useTaskSync("default", { externalTaskId }),
      { initialProps: { externalTaskId: null } }
    );

    // Initially loading (no external task, will bootstrap to create new task)
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Change externalTaskId to load a different task
    rerender({ externalTaskId: "task-2" });

    // Should load the external task
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.content).toBe("external task content");
    expect(result.current.lockIds).toEqual(["lock_b"]);
    // Should have made 2 calls: create during bootstrap, then load external task
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reload when externalTaskId is the same as current task", async () => {
    const task1 = record({ id: "task-1", content: "task 1 content" });
    const fetchMock = mockFetchQueue([{ status: 200, body: task1 }]);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ externalTaskId }) => useTaskSync("default", { externalTaskId }),
      { initialProps: { externalTaskId: "task-1" } }
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Re-render with same externalTaskId
    rerender({ externalTaskId: "task-1" });

    // Should not fetch again
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("switches between external tasks", async () => {
    const task1 = record({ id: "task-1", content: "first task" });
    const task2 = record({ id: "task-2", content: "second task", lock_ids: ["lock_x"] });
    const fetchMock = mockFetchQueue([
      { status: 200, body: task1 },
      { status: 200, body: task2 },
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ externalTaskId }) => useTaskSync("default", { externalTaskId }),
      { initialProps: { externalTaskId: "task-1" } }
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.content).toBe("first task");

    // Switch to task-2
    rerender({ externalTaskId: "task-2" });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.content).toBe("second task");
    expect(result.current.lockIds).toEqual(["lock_x"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
