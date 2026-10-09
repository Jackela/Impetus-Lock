import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function cacheA() {
  localStorage.setItem("impetus.task.cache", "# Recovered unsaved A");
  localStorage.setItem("impetus.task.meta", JSON.stringify({ taskId: "A", version: 7 }));
}

function cachedPair() {
  return {
    content: localStorage.getItem("impetus.task.cache"),
    meta: JSON.parse(localStorage.getItem("impetus.task.meta") ?? "null") as unknown,
  };
}

type Write = { content: string; lock_ids: string[]; version: number };

// R13/V03: exercise the public hook under root StrictMode and the real taskClient.
// Only HTTP completion, time and browser storage are controlled.
describe("useTaskSync V03 review regressions", () => {
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

  it.each(["external load", "cached bootstrap", "initial create"] as const)(
    "preserves edits during %s and saves subsequent typing with the adopted version",
    async (source) => {
      if (source === "cached bootstrap") cacheA();
      const loadedVersion = source === "initial create" ? 0 : 9;
      const load = deferred<Response>();
      const firstSave = deferred<Response>();
      const writes: Array<{ path: string; body: Write }> = [];
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        if (init?.method !== "PUT") return load.promise;
        const body = JSON.parse(String(init.body)) as Write;
        writes.push({ path: new URL(String(input)).pathname, body });
        return writes.length === 1
          ? firstSave.promise
          : response(task("A", body.content, loadedVersion + 2, body.lock_ids));
      });
      vi.stubGlobal("fetch", fetchMock);
      const { result } = renderHook(
        () =>
          useTaskSync("# Default", {
            externalTaskId: source === "external load" ? "A" : null,
          }),
        { reactStrictMode: true }
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe("loading");

      act(() => result.current.onChange("# Local before load", ["lock-local"]));
      await advance(100);
      await act(async () =>
        load.resolve(
          response(
            task("A", "# Remote original", loadedVersion, ["lock-remote"]),
            source === "initial create" ? 201 : 200
          )
        )
      );
      await advance();
      expect(writes).toEqual([]);
      await advance(699);
      expect(writes).toEqual([]);
      expect
        .soft({
          taskId: result.current.taskId,
          version: result.current.version,
          content: result.current.content,
          lockIds: result.current.lockIds,
          status: result.current.status,
          cache: cachedPair(),
        })
        .toEqual({
          taskId: "A",
          version: loadedVersion,
          content: "# Local before load",
          lockIds: ["lock-local"],
          status: "ready",
          cache: {
            content: "# Local before load",
            meta: { taskId: "A", version: loadedVersion },
          },
        });

      // Model the next keystroke from the document actually exposed to the editor.
      act(() => result.current.onChange(`${result.current.content}!`, result.current.lockIds));
      await advance(800);
      expect.soft(writes).toEqual([
        {
          path: "/tasks/A",
          body: {
            content: "# Local before load!",
            lock_ids: ["lock-local"],
            version: loadedVersion,
          },
        },
      ]);
      act(() => result.current.onChange("# Latest queued local", ["lock-local", "lock-new"]));
      await advance(800);
      expect(writes).toHaveLength(1);
      await act(async () =>
        firstSave.resolve(
          response(task("A", "# Local before load!", loadedVersion + 1, ["lock-local"]))
        )
      );
      await advance();
      expect(writes[1]).toEqual({
        path: "/tasks/A",
        body: {
          content: "# Latest queued local",
          lock_ids: ["lock-local", "lock-new"],
          version: loadedVersion + 1,
        },
      });
      expect(result.current.content).toBe("# Latest queued local");
      expect(result.current.version).toBe(loadedVersion + 2);
      expect(result.current.isSaving).toBe(false);
    }
  );

  it.each(["external load", "cached bootstrap", "initial create"] as const)(
    "drains an edited draft after unmount when delayed %s adopts its identity and version",
    async (source) => {
      if (source === "cached bootstrap") cacheA();
      const load = deferred<Response>();
      const loadedVersion = source === "initial create" ? 0 : 9;
      const writes: Array<{ path: string; body: Write }> = [];
      const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
        if (init?.method !== "PUT") return load.promise;
        const body = JSON.parse(String(init.body)) as Write;
        writes.push({ path: new URL(String(input)).pathname, body });
        return response(task("A", body.content, loadedVersion + 1, body.lock_ids));
      });
      vi.stubGlobal("fetch", fetchMock);
      const { result, unmount } = renderHook(
        () =>
          useTaskSync("# Default", {
            externalTaskId: source === "external load" ? "A" : null,
          }),
        { reactStrictMode: true }
      );
      act(() => result.current.onChange("# Unmounted local A", ["lock-local"]));
      await advance(100);
      const cachedBeforeUnmount = cachedPair();
      unmount();
      await advance(1600);
      expect.soft(writes).toEqual([]);
      expect.soft(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () =>
        load.resolve(
          response(task("A", "# Remote A", loadedVersion), source === "initial create" ? 201 : 200)
        )
      );
      await advance();
      expect(writes).toEqual([
        {
          path: "/tasks/A",
          body: {
            content: "# Unmounted local A",
            lock_ids: ["lock-local"],
            version: loadedVersion,
          },
        },
      ]);
      expect(cachedPair()).toEqual(cachedBeforeUnmount);
    }
  );

  it("waits for a delayed task load beyond debounce before sending the pending draft", async () => {
    const load = deferred<Response>();
    const save = deferred<Response>();
    const writes: Write[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method !== "PUT") return load.promise;
        writes.push(JSON.parse(String(init.body)) as Write);
        return save.promise;
      })
    );
    const { result } = renderHook(() => useTaskSync("# Default", { externalTaskId: "A" }), {
      reactStrictMode: true,
    });
    act(() => result.current.onChange("# Pending local A", ["lock-local"]));
    await advance(1600);
    // The version is unknown until GET completes: no write may use the placeholder 0.
    expect.soft(writes).toEqual([]);
    await act(async () => load.resolve(response(task("A", "# Remote A", 9, ["lock-remote"]))));
    await advance(800);
    expect
      .soft(writes)
      .toEqual([{ content: "# Pending local A", lock_ids: ["lock-local"], version: 9 }]);
    expect.soft(result.current.content).toBe("# Pending local A");
    expect.soft(result.current.lockIds).toEqual(["lock-local"]);
    await act(async () =>
      save.resolve(response(task("A", "# Pending local A", 10, ["lock-local"])))
    );
    await advance();
  });

  it("retains an offline recovered A and paired metadata across A to B to A without an edit", async () => {
    cacheA();
    let offline = true;
    const writes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (init?.method === "PUT" || init?.method === "POST") writes.push(path);
        if (offline) throw new TypeError("Failed to fetch");
        return response(
          path.endsWith("/A")
            ? task("A", "# Remote older A", 9, ["lock-remote"])
            : task("B", "# Remote B", 4, ["lock-B"])
        );
      })
    );
    const { result, rerender } = renderHook(
      ({ id }) => useTaskSync("# Default", { externalTaskId: id }),
      { initialProps: { id: null as string | null }, reactStrictMode: true }
    );
    await advance();
    expect(result.current.content).toBe("# Recovered unsaved A");
    expect(result.current.error).toBe(TaskSyncErrorMessages.API_UNAVAILABLE);
    expect(result.current.taskId).toBe("A");
    expect(result.current.version).toBe(7);

    offline = false;
    rerender({ id: "B" });
    await advance();
    expect(result.current.content).toBe("# Remote B");
    expect(cachedPair()).toEqual({ content: "# Remote B", meta: { taskId: "B", version: 4 } });
    rerender({ id: "A" });
    await advance(1600);
    expect({
      taskId: result.current.taskId,
      content: result.current.content,
      version: result.current.version,
      cache: cachedPair(),
      writes,
    }).toEqual({
      taskId: "A",
      content: "# Recovered unsaved A",
      version: 7,
      cache: { content: "# Recovered unsaved A", meta: { taskId: "A", version: 7 } },
      writes: [],
    });
  });

  it.each(["success", "failure"] as const)(
    "settles cached A bootstrap after late %s while B is selected so A can be used again",
    async (outcome) => {
      cacheA();
      const loadA = deferred<Response>();
      let firstA = true;
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input) => {
          if (new URL(String(input)).pathname.endsWith("/A")) {
            if (firstA) {
              firstA = false;
              return loadA.promise;
            }
            return response(task("A", "# Available A", 9, ["lock-A"]));
          }
          return response(task("B", "# Selected B", 4, ["lock-B"]));
        })
      );
      const { result, rerender } = renderHook(
        ({ id }) => useTaskSync("# Default", { externalTaskId: id }),
        { initialProps: { id: null as string | null }, reactStrictMode: true }
      );
      rerender({ id: "B" });
      await advance();
      await act(async () =>
        loadA.resolve(
          outcome === "success"
            ? response(task("A", "# Available A", 9, ["lock-A"]))
            : response({}, 503)
        )
      );
      await advance();
      expect({
        taskId: result.current.taskId,
        content: result.current.content,
        lockIds: result.current.lockIds,
        version: result.current.version,
        status: result.current.status,
        error: result.current.error,
        cache: cachedPair(),
      }).toEqual({
        taskId: "B",
        content: "# Selected B",
        lockIds: ["lock-B"],
        version: 4,
        status: "ready",
        error: null,
        cache: { content: "# Selected B", meta: { taskId: "B", version: 4 } },
      });

      rerender({ id: "A" });
      await advance(1600);
      // A may have settled, or a failed bootstrap may trigger a fresh GET on return.
      expect(["ready", "error"]).toContain(result.current.status);
      expect(result.current.taskId).toBe("A");
      if (result.current.status === "ready") {
        expect(result.current.content).toBe("# Available A");
        expect(result.current.lockIds).toEqual(["lock-A"]);
        expect(result.current.version).toBe(9);
      } else {
        expect(result.current.content).toBe("# Recovered unsaved A");
        expect(result.current.error).toBeTruthy();
      }
      expect(cachedPair()).toEqual({
        content: result.current.content,
        meta: { taskId: "A", version: result.current.version },
      });
    }
  );
});
