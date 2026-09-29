import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTask } from "../services/api/taskClient";
import { TaskSyncErrorMessages, useTaskSync } from "./useTaskSync";

function task(id: string, content: string, version: number, locks: string[] = []) {
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

async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

type Write = { content: string; lock_ids: string[]; version: number };

// Stateful HTTP boundary: a matching version 0 PUT really replaces the record.
// useTaskSync, taskClient, response mapping and browser storage remain real.
function httpBoundary() {
  const records = new Map([
    ["A", task("A", "# Original server A", 0, ["lock-server-A"])],
    ["B", task("B", "# Selected B", 4, ["lock-B"])],
  ]);
  const http = {
    failA: true,
    failCreate: false,
    nextAGet: null as Promise<Response> | null,
    gets: [] as string[],
    puts: [] as Array<{ path: string; body: Write }>,
    posts: [] as Array<{ content: string; lock_ids: string[] }>,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      const method = init?.method ?? "GET";
      if (method === "POST" && path === "/tasks") {
        const body = JSON.parse(String(init?.body)) as { content: string; lock_ids: string[] };
        http.posts.push(body);
        if (http.failCreate) return response({}, 503);
        const created = task("created", body.content, 0, body.lock_ids);
        records.set("created", created);
        return response(created, 201);
      }
      const id = path.slice("/tasks/".length);
      const record = records.get(id);
      if (!record || path !== `/tasks/${id}`) throw new Error(`Unexpected HTTP ${method} ${path}`);
      if (method === "GET") {
        http.gets.push(id);
        if (id === "A" && http.nextAGet) {
          const pending = http.nextAGet;
          http.nextAGet = null;
          return pending;
        }
        return id === "A" && http.failA ? response({}, 503) : response(record);
      }
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body)) as Write;
        http.puts.push({ path, body });
        if (body.version !== record.version) return response({}, 409);
        const saved = task(id, body.content, record.version + 1, body.lock_ids);
        records.set(id, saved);
        return response(saved);
      }
      throw new Error(`Unexpected HTTP ${method} ${path}`);
    })
  );
  return http;
}

// R13 Wave5/V03-06 approved seam: real hook + taskClient under root StrictMode.
describe("useTaskSync unknown server version", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each(["after 503", "before 503"] as const)(
    "retains typing %s without overwriting an unseen server version 0 after debounce",
    async (timing) => {
      const http = httpBoundary();
      const load = deferred<Response>();
      http.nextAGet = load.promise;
      const { result } = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
        reactStrictMode: true,
      });
      if (timing === "before 503") {
        act(() => result.current.onChange("# Local while unavailable", ["lock-local"]));
      }
      await act(async () => load.resolve(response({}, 503)));
      await advance();
      expect(result.current.error).toBe(TaskSyncErrorMessages.SERVER_ERROR);
      if (timing === "after 503") {
        act(() => result.current.onChange("# Local while unavailable", ["lock-local"]));
      }
      await advance(799);
      expect(http.puts).toEqual([]);
      await advance(1);
      expect
        .soft(http.puts, "Unknown version must not authorize a PUT at the debounce deadline")
        .toEqual([]);
      expect
        .soft({
          content: result.current.content,
          lockIds: result.current.lockIds,
          status: result.current.status,
          error: result.current.error,
          isSaving: result.current.isSaving,
        })
        .toEqual({
          content: "# Local while unavailable",
          lockIds: ["lock-local"],
          status: "error",
          error: TaskSyncErrorMessages.SERVER_ERROR,
          isSaving: false,
        });
      expect(localStorage.getItem("impetus.task.cache")).toBe("# Local while unavailable");
      expect(http.gets).toEqual(["A"]);
      http.failA = false;
      const remote = await fetchTask("A");
      expect
        .soft({ content: remote.content, locks: remote.lock_ids, version: remote.version })
        .toEqual({
          content: "# Original server A",
          locks: ["lock-server-A"],
          version: 0,
        });
    }
  );

  it.each(["selection change", "unmount"] as const)(
    "keeps unknown-version pending intent local during %s before debounce",
    async (exit) => {
      const http = httpBoundary();
      const { result, rerender, unmount } = renderHook(
        ({ id }) => useTaskSync("# Default", { externalTaskId: id }),
        { initialProps: { id: "A" }, reactStrictMode: true }
      );
      await advance();
      act(() => result.current.onChange("# Pending unavailable A", ["lock-local"]));
      await advance(100);
      if (exit === "unmount") unmount();
      else rerender({ id: "B" });
      await advance(1600);
      expect.soft(http.puts, "Cleanup must not flush a placeholder version").toEqual([]);
      if (exit === "unmount") {
        expect(localStorage.getItem("impetus.task.cache")).toBe("# Pending unavailable A");
      } else {
        expect(result.current.content).toBe("# Selected B");
        expect(result.current.lockIds).toEqual(["lock-B"]);
        expect(result.current.version).toBe(4);
      }
      http.failA = false;
      expect.soft((await fetchTask("A")).content).toBe("# Original server A");
    }
  );

  it("reloads unknown A on return from B and resumes pending intent without replacing local content or locks", async () => {
    const http = httpBoundary();
    const { result, rerender } = renderHook(
      ({ id }) => useTaskSync("# Default", { externalTaskId: id }),
      { initialProps: { id: "A" }, reactStrictMode: true }
    );
    await advance();
    act(() => result.current.onChange("# Retained A", ["lock-local"]));
    // Let the debounce become due while the actual server version remains unknown.
    await advance(800);
    expect.soft(http.puts).toEqual([]);
    rerender({ id: "B" });
    await advance();
    expect(result.current.content).toBe("# Selected B");

    http.failA = false;
    const recovery = deferred<Response>();
    http.nextAGet = recovery.promise;
    rerender({ id: "A" });
    await advance();
    expect
      .soft(http.gets, "Returning to an unknown dirty draft must establish its server version")
      .toEqual(["A", "B", "A"]);
    expect.soft(http.puts).toEqual([]);
    expect(result.current.content).toBe("# Retained A");
    expect(result.current.lockIds).toEqual(["lock-local"]);
    await act(async () =>
      recovery.resolve(response(task("A", "# Original server A", 0, ["lock-server-A"])))
    );
    await advance(800);
    expect.soft(http.puts).toEqual([
      {
        path: "/tasks/A",
        body: { content: "# Retained A", lock_ids: ["lock-local"], version: 0 },
      },
    ]);
    expect
      .soft({
        content: result.current.content,
        locks: result.current.lockIds,
        status: result.current.status,
        error: result.current.error,
        version: result.current.version,
      })
      .toEqual({
        content: "# Retained A",
        locks: ["lock-local"],
        status: "ready",
        error: null,
        version: 1,
      });
  });

  it("keeps cached unknown identity unwritable across unmount and bootstrap failure, then recovers through selection", async () => {
    const http = httpBoundary();
    const first = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await advance();
    act(() => first.result.current.onChange("# Cached unavailable A", []));
    first.unmount();
    await advance();
    expect.soft(http.puts).toEqual([]);

    const restored = renderHook(({ id }) => useTaskSync("# Default", { externalTaskId: id }), {
      initialProps: { id: null as string | null },
      reactStrictMode: true,
    });
    await advance();
    expect(restored.result.current.taskId).toBe("A");
    expect(restored.result.current.content).toBe("# Cached unavailable A");
    expect(restored.result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);
    act(() => restored.result.current.onChange(`${restored.result.current.content}!`, []));
    await advance(800);
    expect
      .soft(http.puts, "Cache must not turn an unknown placeholder into a trusted version")
      .toEqual([]);
    expect.soft(restored.result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);

    restored.rerender({ id: "B" });
    await advance();
    http.failA = false;
    restored.rerender({ id: "A" });
    await advance(800);
    expect.soft(http.gets).toEqual(["A", "A", "B", "A"]);
    expect.soft(http.puts).toEqual([
      {
        path: "/tasks/A",
        body: { content: "# Cached unavailable A!", lock_ids: [], version: 0 },
      },
    ]);
    expect.soft(restored.result.current.content).toBe("# Cached unavailable A!");
    expect.soft(restored.result.current.error).toBeNull();
    expect.soft(restored.result.current.version).toBe(1);
  });

  it("saves with a legitimate version 0 established by a successful GET and preserves the 800ms debounce", async () => {
    const http = httpBoundary();
    http.failA = false;
    const { result } = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await advance();
    expect(result.current.content).toBe("# Original server A");
    expect(result.current.version).toBe(0);
    act(() => result.current.onChange("# Legitimately edited A", ["lock-server-A", "lock-new"]));
    await advance(799);
    expect(http.puts).toEqual([]);
    await advance(1);
    expect(http.puts).toEqual([
      {
        path: "/tasks/A",
        body: {
          content: "# Legitimately edited A",
          lock_ids: ["lock-server-A", "lock-new"],
          version: 0,
        },
      },
    ]);
    expect(result.current.version).toBe(1);
    expect(result.current.error).toBeNull();
    expect((await fetchTask("A")).content).toBe("# Legitimately edited A");
  });

  it("recovers offline new creation without a task identity instead of blocking all error states", async () => {
    const http = httpBoundary();
    http.failCreate = true;
    const { result } = renderHook(() => useTaskSync("# Default"), { reactStrictMode: true });
    await advance();
    expect(result.current.taskId).toBeNull();
    expect(result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);
    expect(http.posts).toEqual([{ content: "# Default", lock_ids: [] }]);
    http.failCreate = false;
    act(() => result.current.onChange("# Offline new draft", ["lock-offline"]));
    await advance(799);
    expect(http.posts).toHaveLength(1);
    await advance(1);
    expect(http.posts).toEqual([
      { content: "# Default", lock_ids: [] },
      { content: "# Offline new draft", lock_ids: ["lock-offline"] },
    ]);
    expect(http.puts).toEqual([]);
    expect(result.current.taskId).toBe("created");
    expect(result.current.content).toBe("# Offline new draft");
    expect(result.current.lockIds).toEqual(["lock-offline"]);
    expect(result.current.version).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it("restores edited unknown cache and locks across restart, then saves only after a trusted version 0 GET", async () => {
    const http = httpBoundary();
    const producer = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await advance();
    expect(producer.result.current.error).toBe(TaskSyncErrorMessages.SERVER_ERROR);
    act(() => producer.result.current.onChange("# Unsaved restart A", ["lock-restart-A"]));
    producer.unmount();
    await advance();
    expect(http.puts).toEqual([]);
    expect(localStorage.getItem("impetus.task.cache")).toBe("# Unsaved restart A");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toMatchObject({
      taskId: "A",
      version: null,
    });

    http.failA = false;
    const recovery = deferred<Response>();
    http.nextAGet = recovery.promise;
    const restored = renderHook(() => useTaskSync("# Default", { externalTaskId: null }), {
      reactStrictMode: true,
    });
    await advance(1600);
    expect(http.gets).toEqual(["A", "A"]);
    expect(http.puts).toEqual([]);
    expect.soft(restored.result.current.content).toBe("# Unsaved restart A");
    expect.soft(restored.result.current.lockIds).toEqual(["lock-restart-A"]);
    expect(localStorage.getItem("impetus.task.cache")).toBe("# Unsaved restart A");

    await act(async () =>
      recovery.resolve(response(task("A", "# Original server A", 0, ["lock-server-A"])))
    );
    await advance(800);
    expect
      .soft(http.puts, "Restart must resume the original pending edit without new typing")
      .toEqual([
        {
          path: "/tasks/A",
          body: { content: "# Unsaved restart A", lock_ids: ["lock-restart-A"], version: 0 },
        },
      ]);
    expect
      .soft({
        content: restored.result.current.content,
        locks: restored.result.current.lockIds,
        version: restored.result.current.version,
        status: restored.result.current.status,
        error: restored.result.current.error,
      })
      .toEqual({
        content: "# Unsaved restart A",
        locks: ["lock-restart-A"],
        version: 1,
        status: "ready",
        error: null,
      });
    expect.soft(localStorage.getItem("impetus.task.cache")).toBe("# Unsaved restart A");
    const saved = await fetchTask("A");
    expect.soft({ content: saved.content, locks: saved.lock_ids, version: saved.version }).toEqual({
      content: "# Unsaved restart A",
      locks: ["lock-restart-A"],
      version: 1,
    });
  });

  it("does not queue untouched failed-load placeholder content when restart GET succeeds", async () => {
    const http = httpBoundary();
    const producer = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await advance();
    expect(producer.result.current.error).toBe(TaskSyncErrorMessages.SERVER_ERROR);
    expect(producer.result.current.content).toBe("# Default");
    producer.unmount();
    await advance();
    expect(localStorage.getItem("impetus.task.cache")).toBe("# Default");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toMatchObject({
      taskId: "A",
      version: null,
    });

    http.failA = false;
    const restored = renderHook(() => useTaskSync("# Default", { externalTaskId: null }), {
      reactStrictMode: true,
    });
    await advance(1600);
    expect(restored.result.current.content).toBe("# Original server A");
    expect(restored.result.current.lockIds).toEqual(["lock-server-A"]);
    expect(restored.result.current.version).toBe(0);
    expect(restored.result.current.error).toBeNull();
    restored.unmount();
    await advance(1600);
    expect(http.puts).toEqual([]);
    expect(http.posts).toEqual([]);
    expect(http.gets).toEqual(["A", "A"]);
    const unchanged = await fetchTask("A");
    expect({
      content: unchanged.content,
      locks: unchanged.lock_ids,
      version: unchanged.version,
    }).toEqual({
      content: "# Original server A",
      locks: ["lock-server-A"],
      version: 0,
    });
  });

  it("retains restored pending intent through another bootstrap failure and saves A in the background without new edits", async () => {
    const http = httpBoundary();
    const producer = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    await advance();
    act(() => producer.result.current.onChange("# Twice offline A", ["lock-twice-A"]));
    await advance(800);
    producer.unmount();
    await advance();
    expect(http.puts).toEqual([]);
    expect(localStorage.getItem("impetus.task.cache")).toBe("# Twice offline A");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toMatchObject({
      taskId: "A",
      version: null,
    });

    const restored = renderHook(({ id }) => useTaskSync("# Default", { externalTaskId: id }), {
      initialProps: { id: null as string | null },
      reactStrictMode: true,
    });
    await advance(1600);
    expect(restored.result.current.taskId).toBe("A");
    expect(restored.result.current.content).toBe("# Twice offline A");
    expect.soft(restored.result.current.lockIds).toEqual(["lock-twice-A"]);
    expect(restored.result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);
    expect(http.puts).toEqual([]);

    restored.rerender({ id: "B" });
    await advance();
    expect(restored.result.current.content).toBe("# Selected B");
    http.failA = false;
    const recovery = deferred<Response>();
    http.nextAGet = recovery.promise;
    restored.rerender({ id: "A" });
    await advance();
    expect(http.gets).toEqual(["A", "A", "B", "A"]);
    expect(restored.result.current.content).toBe("# Twice offline A");
    expect.soft(restored.result.current.lockIds).toEqual(["lock-twice-A"]);
    expect(http.puts).toEqual([]);
    restored.rerender({ id: "B" });
    await advance();

    await act(async () =>
      recovery.resolve(response(task("A", "# Original server A", 0, ["lock-server-A"])))
    );
    await advance(800);
    expect.soft(http.puts, "A second failure must retain the pre-restart queued edit").toEqual([
      {
        path: "/tasks/A",
        body: { content: "# Twice offline A", lock_ids: ["lock-twice-A"], version: 0 },
      },
    ]);
    expect({
      taskId: restored.result.current.taskId,
      content: restored.result.current.content,
      locks: restored.result.current.lockIds,
      version: restored.result.current.version,
      status: restored.result.current.status,
      error: restored.result.current.error,
    }).toEqual({
      taskId: "B",
      content: "# Selected B",
      locks: ["lock-B"],
      version: 4,
      status: "ready",
      error: null,
    });
    expect(localStorage.getItem("impetus.task.cache")).toBe("# Selected B");
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toMatchObject({
      taskId: "B",
      version: 4,
    });
    const saved = await fetchTask("A");
    expect.soft({ content: saved.content, locks: saved.lock_ids, version: saved.version }).toEqual({
      content: "# Twice offline A",
      locks: ["lock-twice-A"],
      version: 1,
    });
  });
});
