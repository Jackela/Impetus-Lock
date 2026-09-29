import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskSyncErrorMessages, useTaskSync } from "./useTaskSync";

function task(id: string, content = id, version = 7, locks = [`lock-${id}`]) {
  return {
    id,
    title: "",
    content,
    lock_ids: locks,
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 0,
    created_at: "2026-09-29T00:00:00Z",
    updated_at: "2026-09-29T00:00:00Z",
    version,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

async function advance(ms = 800) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useTaskSync synchronization races", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("retains the latest local draft and locks when an in-flight save conflicts", async () => {
    const original = {
      id: "task-conflict",
      title: "",
      content: "# Original server draft",
      lock_ids: ["lock-original"],
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 0,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-29T00:00:00Z",
      version: 7,
    };
    const latestServer = {
      ...original,
      content: "# Edited on another device",
      lock_ids: ["lock-remote"],
      version: 9,
    };
    let finishSave!: (response: Response) => void;
    const saveResponse = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    let conflictReceived = false;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (new URL(String(input)).pathname !== "/tasks/task-conflict") {
        throw new Error(`Unexpected task request: ${String(input)}`);
      }
      if (init?.method === "PUT") {
        const response = await saveResponse;
        conflictReceived = true;
        return response;
      }
      return new Response(JSON.stringify(conflictReceived ? latestServer : original), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    // Keep the hook and taskClient real; control only HTTP, storage and time.
    const { result } = renderHook(
      () => useTaskSync("# Default", { externalTaskId: "task-conflict" }),
      { reactStrictMode: true }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.version).toBe(7);

    vi.useFakeTimers();
    act(() => result.current.onChange("# First local edit", ["lock-original"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(result.current.isSaving).toBe(true);
    const saveRequest = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(saveRequest?.[1]?.body))).toEqual({
      content: "# First local edit",
      lock_ids: ["lock-original"],
      version: 7,
    });

    // The writer keeps typing while the older save is still awaiting its response.
    act(() => result.current.onChange("# Latest local draft", ["lock-original", "lock-new"]));
    await act(async () => {
      finishSave(new Response(JSON.stringify({ detail: "Version conflict" }), { status: 409 }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect({
      content: result.current.content,
      lockIds: result.current.lockIds,
      version: result.current.version,
      error: result.current.error,
      cachedDraft: localStorage.getItem("impetus.task.cache"),
    }).toEqual({
      content: "# Latest local draft",
      lockIds: ["lock-original", "lock-new"],
      version: 9,
      error: TaskSyncErrorMessages.CONFLICT_REFRESHED,
      cachedDraft: "# Latest local draft",
    });
  });

  it("serializes saves with the latest queued draft and acknowledged server version", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const puts: Array<{ content: string; lock_ids: string[]; version: number }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method !== "PUT") return response(task("A"));
        puts.push(JSON.parse(String(init.body)));
        return puts.length === 1 ? first.promise : second.promise;
      })
    );
    const { result } = renderHook(() => useTaskSync("default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("first", ["lock-first"]));
    await advance();
    act(() => result.current.onChange("intermediate", ["lock-middle"]));
    act(() => result.current.onChange("latest", ["lock-latest"]));
    await advance();
    expect(puts).toEqual([{ content: "first", lock_ids: ["lock-first"], version: 7 }]);
    await act(async () => first.resolve(response(task("A", "first", 8, ["lock-first"]))));
    await advance(0);
    expect(puts).toEqual([
      { content: "first", lock_ids: ["lock-first"], version: 7 },
      { content: "latest", lock_ids: ["lock-latest"], version: 8 },
    ]);
    expect(result.current.content).toBe("latest");
    expect(result.current.lockIds).toEqual(["lock-latest"]);
    expect(result.current.isSaving).toBe(true);
    await act(async () => second.resolve(response(task("A", "latest", 9, ["lock-latest"]))));
    await advance(0);
    expect(result.current.version).toBe(9);
    expect(result.current.isSaving).toBe(false);
    expect(localStorage.getItem("impetus.task.cache")).toBe("latest");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "A",
      version: 9,
    });
  });

  it("keeps the conflict warning and draft until an explicit edit after version refresh", async () => {
    const refresh = deferred<Response>();
    let gets = 0;
    const puts: Array<{ content: string; lock_ids: string[]; version: number }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method !== "PUT") return ++gets === 1 ? response(task("A")) : refresh.promise;
        const body = JSON.parse(String(init.body));
        puts.push(body);
        return puts.length === 1
          ? response({}, 409)
          : response(task("A", body.content, 10, body.lock_ids));
      })
    );
    const { result, rerender } = renderHook(() => useTaskSync("default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("conflicting", ["lock-local"]));
    await advance();
    act(() => result.current.onChange("typed during refresh", ["lock-local", "lock-new"]));
    await act(async () => refresh.resolve(response(task("A", "remote", 9, ["lock-remote"]))));
    await advance(1600);
    rerender();
    expect(puts).toHaveLength(1);
    expect(result.current.content).toBe("typed during refresh");
    expect(result.current.lockIds).toEqual(["lock-local", "lock-new"]);
    expect(result.current.error).toBe(TaskSyncErrorMessages.CONFLICT_REFRESHED);
    expect(result.current.error).toContain("Local draft kept");
    act(() => result.current.onChange("deliberate retry", ["lock-local", "lock-new"]));
    await advance();
    expect(puts[1]).toEqual({
      content: "deliberate retry",
      lock_ids: ["lock-local", "lock-new"],
      version: 9,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.version).toBe(10);
  });

  it.each(["success", "conflict", "failure"] as const)(
    "drains pending A saves and isolates B from A's late %s",
    async (outcome) => {
      const oldSave = deferred<Response>();
      const writes: Array<{ id: string; content: string; lock_ids: string[]; version: number }> =
        [];
      let aGets = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input, init) => {
          const id = new URL(String(input)).pathname.split("/").pop()!;
          if (init?.method !== "PUT") {
            return response(id === "A" && ++aGets > 1 ? task("A", "remote A", 12) : task(id));
          }
          const body = JSON.parse(String(init.body));
          writes.push({ id, ...body });
          return writes.length === 1
            ? oldSave.promise
            : response(task(id, body.content, 9, body.lock_ids));
        })
      );
      const { result, rerender } = renderHook(
        ({ id }) => useTaskSync("default", { externalTaskId: id }),
        { initialProps: { id: "A" }, reactStrictMode: true }
      );
      await waitFor(() => expect(result.current.status).toBe("ready"));
      vi.useFakeTimers();
      act(() => result.current.onChange("A first", ["lock-first"]));
      await advance();
      act(() => result.current.onChange("A pending", ["lock-pending"]));
      rerender({ id: "B" });
      await advance(0);
      expect(result.current.taskId).toBe("B");
      await act(async () =>
        oldSave.resolve(
          outcome === "success"
            ? response(task("A", "A first", 8, ["lock-first"]))
            : response({}, outcome === "conflict" ? 409 : 500)
        )
      );
      await advance(1600);
      expect(writes).toEqual(
        outcome === "conflict"
          ? [{ id: "A", content: "A first", lock_ids: ["lock-first"], version: 7 }]
          : [
              { id: "A", content: "A first", lock_ids: ["lock-first"], version: 7 },
              {
                id: "A",
                content: "A pending",
                lock_ids: ["lock-pending"],
                version: outcome === "success" ? 8 : 7,
              },
            ]
      );
      expect({
        taskId: result.current.taskId,
        content: result.current.content,
        lockIds: result.current.lockIds,
        version: result.current.version,
        error: result.current.error,
        status: result.current.status,
        saving: result.current.isSaving,
        cache: localStorage.getItem("impetus.task.cache"),
        meta: JSON.parse(localStorage.getItem("impetus.task.meta")!),
      }).toEqual({
        taskId: "B",
        content: "B",
        lockIds: ["lock-B"],
        version: 7,
        error: null,
        status: "ready",
        saving: false,
        cache: "B",
        meta: { taskId: "B", version: 7 },
      });
      if (outcome === "conflict") {
        rerender({ id: "A" });
        await advance(0);
        expect(result.current.content).toBe("A pending");
        expect(result.current.lockIds).toEqual(["lock-pending"]);
        expect(result.current.version).toBe(12);
        expect(result.current.error).toBe(TaskSyncErrorMessages.CONFLICT_REFRESHED);
        await advance();
        expect(writes).toHaveLength(1);
      }
    }
  );

  it.each(["success", "failure"] as const)(
    "loads B immediately while A is unresolved and ignores A's late load %s",
    async (outcome) => {
      const loadA = deferred<Response>();
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input) => {
          return new URL(String(input)).pathname.endsWith("/A")
            ? loadA.promise
            : response(task("B"));
        })
      );
      const { result, rerender } = renderHook(
        ({ id }) => useTaskSync("default", { externalTaskId: id }),
        { initialProps: { id: "A" }, reactStrictMode: true }
      );
      vi.useFakeTimers();
      rerender({ id: "B" });
      await advance(0);
      expect(result.current.taskId).toBe("B");
      expect(result.current.status).toBe("ready");
      act(() => result.current.onChange("B draft", ["lock-B", "lock-edit"]));
      await act(async () =>
        loadA.resolve(outcome === "success" ? response(task("A")) : response({}, 500))
      );
      await advance(0);
      expect({
        taskId: result.current.taskId,
        content: result.current.content,
        lockIds: result.current.lockIds,
        version: result.current.version,
        error: result.current.error,
        status: result.current.status,
        cache: localStorage.getItem("impetus.task.cache"),
        meta: JSON.parse(localStorage.getItem("impetus.task.meta")!),
      }).toEqual({
        taskId: "B",
        content: "B draft",
        lockIds: ["lock-B", "lock-edit"],
        version: 7,
        error: null,
        status: "ready",
        cache: "B draft",
        meta: { taskId: "B", version: 7 },
      });
    }
  );

  it("creates a single bootstrap task under root StrictMode even before its response arrives", async () => {
    const created = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>(async () => created.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useTaskSync("new draft"), {
      reactStrictMode: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]?.method).toBe("POST");
    await act(async () => created.resolve(response(task("created", "new draft", 0, []), 201)));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.taskId).toBe("created");
    expect(localStorage.getItem("impetus.task.cache")).toBe("new draft");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "created",
      version: 0,
    });
  });

  it.each(["success", "failure"] as const)(
    "ignores bootstrap's late %s after selecting B",
    async (outcome) => {
      const create = deferred<Response>();
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (_input, init) =>
          init?.method === "POST" ? create.promise : response(task("B"))
        )
      );
      const { result, rerender } = renderHook(
        ({ id }) => useTaskSync("default", { externalTaskId: id }),
        { initialProps: { id: null as string | null }, reactStrictMode: true }
      );
      vi.useFakeTimers();
      rerender({ id: "B" });
      await advance(0);
      act(() => result.current.onChange("B local", ["lock-B", "lock-local"]));
      await act(async () =>
        create.resolve(outcome === "success" ? response(task("created"), 201) : response({}, 500))
      );
      await advance(0);
      expect({
        taskId: result.current.taskId,
        content: result.current.content,
        lockIds: result.current.lockIds,
        version: result.current.version,
        error: result.current.error,
        status: result.current.status,
        cache: localStorage.getItem("impetus.task.cache"),
        meta: JSON.parse(localStorage.getItem("impetus.task.meta")!),
      }).toEqual({
        taskId: "B",
        content: "B local",
        lockIds: ["lock-B", "lock-local"],
        version: 7,
        error: null,
        status: "ready",
        cache: "B local",
        meta: { taskId: "B", version: 7 },
      });
    }
  );

  it("keeps one save queue when returning to A before its old save completes", async () => {
    const oldSave = deferred<Response>();
    const puts: Array<{ content: string; lock_ids: string[]; version: number }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const id = new URL(String(input)).pathname.split("/").pop()!;
        if (init?.method !== "PUT") return response(task(id));
        const body = JSON.parse(String(init.body));
        puts.push(body);
        return puts.length === 1
          ? oldSave.promise
          : response(task(id, body.content, 9, body.lock_ids));
      })
    );
    const { result, rerender } = renderHook(
      ({ id }) => useTaskSync("default", { externalTaskId: id }),
      { initialProps: { id: "A" }, reactStrictMode: true }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("A first", ["lock-first"]));
    await advance();
    act(() => result.current.onChange("A pending", ["lock-pending"]));
    rerender({ id: "B" });
    await advance(0);
    rerender({ id: "A" });
    await advance(0);
    expect(result.current.content).toBe("A pending");
    expect(result.current.lockIds).toEqual(["lock-pending"]);
    expect(result.current.isSaving).toBe(true);
    act(() => result.current.onChange("A newest", ["lock-newest"]));
    await advance();
    expect(puts).toEqual([{ content: "A first", lock_ids: ["lock-first"], version: 7 }]);
    await act(async () => oldSave.resolve(response(task("A", "A first", 8, ["lock-first"]))));
    await advance(0);
    expect(puts[1]).toEqual({ content: "A newest", lock_ids: ["lock-newest"], version: 8 });
    expect(result.current.content).toBe("A newest");
    expect(result.current.lockIds).toEqual(["lock-newest"]);
    expect(result.current.version).toBe(9);
    expect(result.current.isSaving).toBe(false);
    expect(localStorage.getItem("impetus.task.cache")).toBe("A newest");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "A",
      version: 9,
    });
  });

  it("drains the pending draft on unmount and restores its paired identity offline", async () => {
    const save = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT" ? save.promise : response(task("A"))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result, unmount } = renderHook(() => useTaskSync("default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("persisted draft", ["lock-A"]));
    unmount();
    const [, init] = fetchMock.mock.calls.find(([, request]) => request?.method === "PUT")!;
    expect(JSON.parse(String(init?.body))).toEqual({
      content: "persisted draft",
      lock_ids: ["lock-A"],
      version: 7,
    });
    await act(async () => save.resolve(response(task("A", "persisted draft", 8))));
    await advance(1600);
    expect(localStorage.getItem("impetus.task.cache")).toBe("persisted draft");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "A",
      version: 7,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => response({}, 503))
    );
    const restored = renderHook(() => useTaskSync("default"), { reactStrictMode: true });
    await advance(0);
    expect(restored.result.current.status).toBe("error");
    expect(restored.result.current.content).toBe("persisted draft");
    expect(restored.result.current.taskId).toBe("A");
    expect(restored.result.current.version).toBe(7);
    expect(restored.result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);
  });

  it("still refreshes a clean task when the writer returns to it", async () => {
    let aGets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const id = new URL(String(input)).pathname.split("/").pop()!;
        return response(
          id === "A" && ++aGets > 1 ? task("A", "remote update", 11, ["lock-remote"]) : task(id)
        );
      })
    );
    const { result, rerender } = renderHook(
      ({ id }) => useTaskSync("default", { externalTaskId: id }),
      { initialProps: { id: "A" }, reactStrictMode: true }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    rerender({ id: "B" });
    await advance(0);
    rerender({ id: "A" });
    await advance(0);
    expect(result.current.content).toBe("remote update");
    expect(result.current.lockIds).toEqual(["lock-remote"]);
    expect(result.current.version).toBe(11);
    expect(localStorage.getItem("impetus.task.cache")).toBe("remote update");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "A",
      version: 11,
    });
  });

  it("drains A's debounce-pending save immediately when selecting B", async () => {
    const save = deferred<Response>();
    const writes: Array<{ path: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (init?.method === "PUT") {
          writes.push({ path, body: JSON.parse(String(init.body)) });
          return save.promise;
        }
        return response(task(path.endsWith("/A") ? "A" : "B"));
      })
    );
    const { result, rerender } = renderHook(
      ({ id }) => useTaskSync("default", { externalTaskId: id }),
      { initialProps: { id: "A" }, reactStrictMode: true }
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("A pending", ["lock-local"]));
    rerender({ id: "B" });
    await advance(0);
    expect(writes).toEqual([
      { path: "/tasks/A", body: { content: "A pending", lock_ids: ["lock-local"], version: 7 } },
    ]);
    expect(result.current.taskId).toBe("B");
    await act(async () => save.resolve(response(task("A", "A pending", 8, ["lock-local"]))));
    await advance(1600);
    expect(writes).toHaveLength(1);
    expect(result.current.content).toBe("B");
    expect(result.current.version).toBe(7);
    expect(result.current.isSaving).toBe(false);
    expect(localStorage.getItem("impetus.task.cache")).toBe("B");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "B",
      version: 7,
    });
  });

  it("retains local content and a warning when the conflict version cannot be fetched", async () => {
    let gets = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") return response({}, 409);
      return ++gets === 1 ? response(task("A")) : response({}, 503);
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(() => useTaskSync("default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    vi.useFakeTimers();
    act(() => result.current.onChange("local conflict", ["lock-local"]));
    await advance();
    rerender();
    await advance(1600);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(result.current.content).toBe("local conflict");
    expect(result.current.lockIds).toEqual(["lock-local"]);
    expect(result.current.version).toBe(7);
    expect(result.current.error).toBe(TaskSyncErrorMessages.CONFLICT_REFRESH_FAILED);
    expect(result.current.isSaving).toBe(false);
    expect(localStorage.getItem("impetus.task.cache")).toBe("local conflict");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "A",
      version: 7,
    });
  });
});
