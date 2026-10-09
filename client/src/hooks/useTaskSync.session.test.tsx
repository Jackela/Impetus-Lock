import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskSync } from "./useTaskSync";
import {
  inspectOwnedDrafts,
  listOwnedDrafts,
  readOwnedDraft,
  writeOwnedDraft,
} from "../services/draftStore";
import type { RemoteSession } from "../services/api/remoteSession";

function session(userId = "alice", generation = 1): RemoteSession {
  const controller = new AbortController();
  return {
    userId,
    generation,
    signal: controller.signal,
    isCurrent: () => !controller.signal.aborted,
    onUnauthorized: vi.fn(() => controller.abort()),
  };
}
function task(id = "A", content = "server", version = 7, locks = ["lock-server"]) {
  return {
    id,
    title: "",
    content,
    version,
    lock_ids: locks,
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 1,
    created_at: "now",
    updated_at: "now",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function advance(ms = 0) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

describe("account scoped task drafts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("keeps editing and locks locally while paused without sending on mount or unmount", async () => {
    const http = vi.fn<typeof fetch>(async () => response(task()));
    vi.stubGlobal("fetch", http);
    const { result, unmount } = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: null })
    );
    await advance();
    act(() => result.current.onChange("paused writing", ["lock-local"]));
    await advance(1000);
    unmount();
    await advance();
    expect(http).not.toHaveBeenCalled();
    expect(readOwnedDraft("alice")).toMatchObject({
      content: "paused writing",
      lockIds: ["lock-local"],
      dirty: true,
    });
  });

  it("ignores an old save after the same user establishes a new session", async () => {
    const oldSave = deferred<Response>();
    const first = session();
    const second = session("alice", 2);
    let gets = 0;
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") return oldSave.promise;
      const firstGet = gets++ === 0;
      return response(task("A", firstGet ? "original" : "remote revision", firstGet ? 7 : 9));
    });
    vi.stubGlobal("fetch", http);
    const hook = renderHook(
      ({ scope }) =>
        useTaskSync("default", { userId: "alice", session: scope, externalTaskId: "A" }),
      { initialProps: { scope: first } }
    );
    await advance();
    act(() => hook.result.current.onChange("local", ["lock-local"]));
    await advance(800);
    first.onUnauthorized();
    hook.rerender({ scope: second });
    await advance();
    await act(async () => oldSave.resolve(response(task("A", "local", 8, ["lock-local"]))));
    await advance();
    expect(hook.result.current.version).toBe(7);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "local",
      version: 7,
      dirty: true,
    });
  });

  it("recovers a dirty known version without replacing content or locks and requires a conflict choice", async () => {
    writeOwnedDraft("alice", {
      draftId: "retained",
      content: "unsaved",
      lockIds: ["lock-local"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const remote = task("A", "remote revision", 9, ["lock-remote"]);
    const http = vi.fn<typeof fetch>(async () => response(remote));
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance();
    expect(hook.result.current.content).toBe("unsaved");
    expect(hook.result.current.lockIds).toEqual(["lock-local"]);
    expect(hook.result.current.conflict).toMatchObject({
      local: { content: "unsaved", version: 7 },
      server: remote,
    });
    expect(hook.result.current.hasUnsavedChanges).toBe(true);
    act(() => hook.result.current.onChange("still local", ["lock-local", "lock-new"]));
    await advance(2000);
    expect(http).toHaveBeenCalledTimes(1);
    act(() => hook.result.current.resolveConflict("server"));
    expect(hook.result.current.content).toBe("remote revision");
    expect(hook.result.current.lockIds).toEqual(["lock-remote"]);
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
    expect(listOwnedDrafts("alice")).toContainEqual(
      expect.objectContaining({
        content: "still local",
        lockIds: ["lock-local", "lock-new"],
        recoveryOf: "retained",
      })
    );
  });

  it("uses a matching known version for the retained dirty draft and its locks", async () => {
    writeOwnedDraft("alice", {
      draftId: "retained",
      content: "unsaved",
      lockIds: ["lock-local"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return response(task("A", body.content, 8, body.lock_ids));
      }
      return response(task());
    });
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance();
    expect(hook.result.current.content).toBe("unsaved");
    expect(hook.result.current.lockIds).toEqual(["lock-local"]);
    expect(
      JSON.parse(String(http.mock.calls.find(([, init]) => init?.method === "PUT")?.[1]?.body))
    ).toEqual({ content: "unsaved", lock_ids: ["lock-local"], version: 7 });
    expect(readOwnedDraft("alice", "A")).toMatchObject({ dirty: false, version: 8 });
  });

  it("never queries or uploads an unassigned legacy task until explicit new draft import", async () => {
    localStorage.setItem("impetus.task.cache", "legacy writing");
    localStorage.setItem(
      "impetus.task.meta",
      JSON.stringify({ taskId: "legacy", version: 7, pendingLockIds: ["lock-legacy"] })
    );
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return response(task("new", body.content, 0, body.lock_ids));
    });
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance();
    expect(
      http.mock.calls.map(([input, init]) => ({
        path: new URL(String(input)).pathname,
        method: init?.method,
      }))
    ).toEqual([{ path: "/tasks", method: "POST" }]);
    expect(hook.result.current.content).toBe("default");
    act(() => hook.result.current.createLocalDraft("legacy writing", ["lock-legacy"]));
    await advance();
    expect(http.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/tasks",
      "/tasks",
    ]);
    expect(hook.result.current.lockIds).toEqual(["lock-legacy"]);
    expect(localStorage.getItem("impetus.task.cache")).toBe("legacy writing");
    expect(localStorage.getItem("impetus.task.meta")).toBe(
      JSON.stringify({ taskId: "legacy", version: 7, pendingLockIds: ["lock-legacy"] })
    );
  });

  it("retains in-memory content when browser storage fails and exposes retry and a throwing snapshot", async () => {
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: null }));
    await advance();
    const writes = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    act(() => hook.result.current.onChange("kept in memory", ["lock-local"]));
    expect(hook.result.current.content).toBe("kept in memory");
    expect(hook.result.current.error).toContain("could not be saved on this device");
    expect(hook.result.current.hasUnsavedChanges).toBe(true);
    act(() => expect(() => hook.result.current.flushLocal()).toThrow("storage full"));
    writes.mockRestore();
    await act(async () => hook.result.current.retry());
    expect(readOwnedDraft("alice")).toMatchObject({
      content: "kept in memory",
      lockIds: ["lock-local"],
      dirty: true,
    });
    expect(hook.result.current.error).toBeNull();
  });

  it.each([200, 401, 500])("does not expose Alice's late load %s to Bob", async (status) => {
    const oldLoad = deferred<Response>();
    const alice = session();
    let aliceCurrent = true;
    alice.isCurrent = () => aliceCurrent;
    const bob = session("bob", 2);
    const http = vi.fn<typeof fetch>(async (input) =>
      new URL(String(input)).pathname.endsWith("/A")
        ? oldLoad.promise
        : response(task("B", "Bob writing", 4, ["lock-bob"]))
    );
    vi.stubGlobal("fetch", http);
    const hook = renderHook(
      ({ user, scope, id }) =>
        useTaskSync("default", { userId: user, session: scope, externalTaskId: id }),
      { initialProps: { user: "alice", scope: alice, id: "A" } }
    );
    aliceCurrent = false;
    hook.rerender({ user: "bob", scope: bob, id: "B" });
    await advance();
    await act(async () => oldLoad.resolve(response(task("A", "Alice private writing"), status)));
    await advance(1600);
    expect(hook.result.current.content).toBe("Bob writing");
    expect(hook.result.current.lockIds).toEqual(["lock-bob"]);
    expect(readOwnedDraft("bob", "B")).toMatchObject({ content: "Bob writing", version: 4 });
    expect(alice.onUnauthorized).not.toHaveBeenCalled();
    expect(bob.onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([200, 401, 409])(
    "stops Alice's pending queue and ignores her late save %s after Bob signs in",
    async (status) => {
      const oldSave = deferred<Response>();
      const alice = session();
      let aliceCurrent = true;
      alice.isCurrent = () => aliceCurrent;
      const bob = session("bob", 2);
      const http = vi.fn<typeof fetch>(async (input, init) =>
        init?.method === "PUT"
          ? oldSave.promise
          : response(
              new URL(String(input)).pathname.endsWith("/A")
                ? task("A", "Alice writing")
                : task("B", "Bob writing")
            )
      );
      vi.stubGlobal("fetch", http);
      const hook = renderHook(
        ({ user, scope, id }) =>
          useTaskSync("default", { userId: user, session: scope, externalTaskId: id }),
        { initialProps: { user: "alice", scope: alice, id: "A" } }
      );
      await advance();
      act(() => hook.result.current.onChange("Alice first", ["lock-first"]));
      await advance(800);
      act(() => hook.result.current.onChange("Alice pending", ["lock-pending"]));
      aliceCurrent = false;
      hook.rerender({ user: "bob", scope: bob, id: "B" });
      await advance();
      await act(async () => oldSave.resolve(response(task("A", "Alice first", 8), status)));
      await advance(1600);
      expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
      expect(hook.result.current.content).toBe("Bob writing");
      expect(readOwnedDraft("alice", "A")).toMatchObject({
        content: "Alice pending",
        lockIds: ["lock-pending"],
        dirty: true,
        version: 7,
      });
      expect(readOwnedDraft("bob", "B")).toMatchObject({ content: "Bob writing", dirty: false });
      expect(alice.onUnauthorized).not.toHaveBeenCalled();
      expect(bob.onUnauthorized).not.toHaveBeenCalled();
    }
  );

  it("retains the newest edit on a current 401 and starts no follow-up save", async () => {
    const save = deferred<Response>();
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT" ? save.promise : response(task())
    );
    vi.stubGlobal("fetch", http);
    let flush!: () => void;
    const register = (callback: () => void) => {
      flush = callback;
      return () => {};
    };
    const hook = renderHook(() =>
      useTaskSync("default", {
        userId: "alice",
        session: scope,
        externalTaskId: "A",
        registerSnapshot: register,
      })
    );
    await advance();
    act(() => hook.result.current.onChange("first", ["lock-first"]));
    await advance(800);
    act(() => hook.result.current.onChange("latest", ["lock-latest"]));
    await act(async () => {
      flush();
      save.resolve(response({}, 401));
    });
    await advance(1600);
    expect(scope.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "latest",
      lockIds: ["lock-latest"],
      dirty: true,
    });
  });

  it("retains a 409 conflict through later typing and saves the explicit new choice without writing the old task", async () => {
    const scope = session();
    let gets = 0;
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") return response({}, 409);
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return response(task("new", body.content, 0, body.lock_ids));
      }
      return response(gets++ === 0 ? task() : task("A", "remote revision", 9, ["lock-remote"]));
    });
    vi.stubGlobal("fetch", http);
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, externalTaskId: "A" })
    );
    await advance();
    const identity = hook.result.current.draftIdentity;
    act(() => hook.result.current.onChange("conflicting", ["lock-local"]));
    await advance(800);
    expect(hook.result.current.conflict?.server).toMatchObject({
      content: "remote revision",
      version: 9,
      lock_ids: ["lock-remote"],
    });
    act(() => hook.result.current.onChange("latest local", ["lock-latest"]));
    await advance(1600);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(hook.result.current.conflict?.local.content).toBe("latest local");
    act(() => hook.result.current.resolveConflict("new"));
    await advance();
    expect(hook.result.current.taskId).toBe("new");
    expect(hook.result.current.draftIdentity).not.toBe(identity);
    expect(hook.result.current.content).toBe("latest local");
    expect(hook.result.current.lockIds).toEqual(["lock-latest"]);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "latest local",
      dirty: true,
      version: 7,
    });
  });

  it("rejects a callback captured by the prior editor identity", async () => {
    const http = vi.fn<typeof fetch>(async (input) =>
      response(task(new URL(String(input)).pathname.endsWith("/B") ? "B" : "A"))
    );
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(
      ({ id }) => useTaskSync("default", { userId: "alice", session: scope, externalTaskId: id }),
      { initialProps: { id: "A" } }
    );
    await advance();
    const oldChange = hook.result.current.onChange;
    hook.rerender({ id: "B" });
    await advance();
    act(() => oldChange("old AI text", ["lock-old"]));
    expect(hook.result.current.taskId).toBe("B");
    expect(hook.result.current.content).toBe("server");
    expect(hook.result.current.lockIds).toEqual(["lock-server"]);
  });

  it("retries retained snapshots for every edited task before an account is left", async () => {
    const http = vi.fn<typeof fetch>(async (input, init) =>
      init?.method === "PUT"
        ? response({}, 503)
        : response(task(new URL(String(input)).pathname.endsWith("/B") ? "B" : "A"))
    );
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(
      ({ id }) => useTaskSync("default", { userId: "alice", session: scope, externalTaskId: id }),
      { initialProps: { id: "A" } }
    );
    await advance();
    const originalSet = Storage.prototype.setItem;
    let failA = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (
        key.startsWith("impetus.draft.") &&
        failA &&
        JSON.parse(value).taskId === "A" &&
        JSON.parse(value).dirty
      )
        throw new Error("storage full");
      return originalSet.call(this, key, value);
    });
    act(() => hook.result.current.onChange("A retained in memory", ["lock-a"]));
    hook.rerender({ id: "B" });
    await advance();
    act(() => hook.result.current.onChange("B retained", ["lock-b"]));
    failA = false;
    act(() => hook.result.current.flushLocal());
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "A retained in memory",
      lockIds: ["lock-a"],
      dirty: true,
    });
    expect(readOwnedDraft("alice", "B")).toMatchObject({
      content: "B retained",
      lockIds: ["lock-b"],
      dirty: true,
    });
  });

  it("keeps a recovered dirty snapshot queued until editor validation explicitly permits a retry", async () => {
    writeOwnedDraft("alice", {
      draftId: "unvalidated",
      content: "missing marker",
      lockIds: ["lock-missing"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return response(task("A", body.content, 8, body.lock_ids));
      }
      return response(task());
    });
    vi.stubGlobal("fetch", http);
    let permits = false;
    const canSave = vi.fn(() => permits);
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, canSave })
    );
    await advance(2000);
    expect(
      http.mock.calls.filter(([, init]) => init?.method === "PUT" || init?.method === "POST")
    ).toHaveLength(0);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "missing marker",
      lockIds: ["lock-missing"],
      dirty: true,
      version: 7,
    });
    expect(canSave).toHaveBeenCalledWith("unvalidated", "missing marker", ["lock-missing"]);
    permits = true;
    await advance(2000);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    await act(async () => hook.result.current.retry());
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "missing marker",
      lockIds: ["lock-missing"],
      dirty: false,
      version: 8,
    });
  });

  it("waits for the recovery GET even when editor validation becomes ready and retry is requested", async () => {
    writeOwnedDraft("alice", {
      draftId: "retained",
      content: "local",
      lockIds: ["lock-local"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const loading = deferred<Response>();
    const http = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT" ? response(task("A", "local", 8, ["lock-local"])) : loading.promise
    );
    vi.stubGlobal("fetch", http);
    const scope = session();
    let permits = false;
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, canSave: () => permits })
    );
    await advance();
    permits = true;
    await act(async () => hook.result.current.retry());
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    await act(async () => loading.resolve(response(task("A", "remote newer", 9, ["lock-remote"]))));
    await advance();
    expect(hook.result.current.conflict?.server?.version).toBe(9);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("gates initial creation and explicit import and retains the newest imported candidate for retry", async () => {
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return response(task("created", body.content, 0, body.lock_ids));
    });
    vi.stubGlobal("fetch", http);
    let permits = false;
    const hook = renderHook(
      () => useTaskSync("default", { userId: "alice", session: scope, canSave: () => permits }),
      { reactStrictMode: true }
    );
    await advance(1600);
    expect(http).not.toHaveBeenCalled();
    expect(readOwnedDraft("alice")).toMatchObject({
      content: "default",
      dirty: true,
      taskId: null,
    });
    act(() => hook.result.current.createLocalDraft("imported", ["lock-imported"]));
    act(() => hook.result.current.onChange("latest imported", ["lock-imported", "lock-latest"]));
    await advance(1600);
    expect(http).not.toHaveBeenCalled();
    permits = true;
    await act(async () => hook.result.current.retry());
    expect(http).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).toEqual({
      content: "latest imported",
      lock_ids: ["lock-imported", "lock-latest"],
    });
    expect(hook.result.current.content).toBe("latest imported");
  });

  it("preserves the original editor validation error and retries the same queue after it is resolved", async () => {
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      return response(task("created", body.content, 0, body.lock_ids));
    });
    vi.stubGlobal("fetch", http);
    let invalid = true;
    const hook = renderHook(() =>
      useTaskSync("default", {
        userId: "alice",
        session: scope,
        canSave: () => {
          if (invalid) throw new Error("Recovered lock lock-missing has no marker");
          return true;
        },
      })
    );
    await advance();
    expect(hook.result.current.error).toBe("Recovered lock lock-missing has no marker");
    expect(http).not.toHaveBeenCalled();
    expect(readOwnedDraft("alice")).toMatchObject({
      content: "default",
      dirty: true,
      taskId: null,
    });
    invalid = false;
    await act(async () => hook.result.current.retry());
    expect(http).toHaveBeenCalledTimes(1);
    expect(hook.result.current.error).toBeNull();
  });

  it("gates the explicit save-as-new conflict choice without writing the original task", async () => {
    writeOwnedDraft("alice", {
      draftId: "retained",
      content: "local conflicting",
      lockIds: ["lock-local"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return response(task("new", body.content, 0, body.lock_ids));
      }
      return response(task("A", "remote version", 9, ["lock-remote"]));
    });
    vi.stubGlobal("fetch", http);
    let permits = false;
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, canSave: () => permits })
    );
    await advance();
    act(() => hook.result.current.resolveConflict("new"));
    await advance(1600);
    expect(
      http.mock.calls.filter(([, init]) => init?.method === "PUT" || init?.method === "POST")
    ).toHaveLength(0);
    expect(readOwnedDraft("alice", null)).toMatchObject({
      content: "local conflicting",
      lockIds: ["lock-local"],
      dirty: true,
    });
    permits = true;
    await act(async () => hook.result.current.retry());
    expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("reports unsaved changes during debounce and in-flight saving until the server acknowledges the latest draft", async () => {
    const saving = deferred<Response>();
    const http = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === "PUT" ? saving.promise : response(task())
    );
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, externalTaskId: "A" })
    );
    await advance();
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
    act(() => hook.result.current.onChange("latest edit", ["lock-local"]));
    await advance(799);
    expect(hook.result.current.isSaving).toBe(false);
    expect(hook.result.current.hasUnsavedChanges).toBe(true);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
    await advance(1);
    expect(hook.result.current.isSaving).toBe(true);
    expect(hook.result.current.hasUnsavedChanges).toBe(true);
    await act(async () => saving.resolve(response(task("A", "latest edit", 8, ["lock-local"]))));
    await advance();
    expect(hook.result.current.isSaving).toBe(false);
    expect(hook.result.current.hasUnsavedChanges).toBe(false);
  });

  it.each(["invalid JSON", "invalid locks"])(
    "keeps %s owned source raw, reports recovery errors and sends no default write",
    async (kind) => {
      const raw =
        kind === "invalid JSON"
          ? "{broken JSON"
          : '{"draftId":"broken","content":"Original <!-- lock:x -->","lockIds":"x","taskId":"A","version":7,"versionKnown":true,"dirty":true,"updatedAt":1}';
      localStorage.setItem("impetus.draft.alice.broken", raw);
      const http = vi.fn<typeof fetch>(async () => response(task()));
      vi.stubGlobal("fetch", http);
      const scope = session();
      const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
      await advance(1600);
      expect(hook.result.current.error).toContain("could not be restored");
      expect(hook.result.current.hasBlockedRecovery).toBe(true);
      expect(hook.result.current.recoveryIssues).toContainEqual(
        expect.objectContaining({ key: "impetus.draft.alice.broken", raw })
      );
      expect(hook.result.current.content).toBe(
        kind === "invalid locks" ? "Original <!-- lock:x -->" : raw
      );
      expect(http).not.toHaveBeenCalled();
      await act(async () => hook.result.current.retry());
      act(() => hook.result.current.onChange("edited locally <!-- lock:x -->", []));
      await advance(1600);
      expect(http).not.toHaveBeenCalled();
      expect(localStorage.getItem("impetus.draft.alice.broken")).toBe(raw);
    }
  );

  it("reports a damaged sibling draft while restoring and saving the reliable selected task", async () => {
    const raw = "{broken JSON";
    localStorage.setItem("impetus.draft.alice.broken", raw);
    writeOwnedDraft("alice", {
      draftId: "valid",
      content: "valid local",
      lockIds: ["lock-valid"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    const scope = session();
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return response(task("A", body.content, 8, body.lock_ids));
      }
      return response(task());
    });
    vi.stubGlobal("fetch", http);
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, externalTaskId: "A" })
    );
    await advance();
    expect(hook.result.current.hasBlockedRecovery).toBe(false);
    expect(hook.result.current.content).toBe("valid local");
    expect(hook.result.current.lockIds).toEqual(["lock-valid"]);
    expect(hook.result.current.recoveryIssues[0]?.raw).toBe(raw);
    expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(localStorage.getItem("impetus.draft.alice.broken")).toBe(raw);
  });

  it("retains recovery edits across restart without turning a damaged selected source into a default POST", async () => {
    const raw =
      '{"draftId":"broken","content":"Original <!-- lock:x -->","lockIds":"x","taskId":"A","version":7,"versionKnown":true,"dirty":true,"updatedAt":1}';
    localStorage.setItem("impetus.draft.alice.broken", raw);
    const scope = session();
    const http = vi.fn<typeof fetch>(async () => response(task()));
    vi.stubGlobal("fetch", http);
    const initial = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, externalTaskId: "A" })
    );
    await advance();
    act(() => initial.result.current.onChange("Retained recovery edit <!-- lock:x -->", []));
    act(() => initial.result.current.flushLocal());
    initial.unmount();
    const restored = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance(1600);
    expect(restored.result.current.hasBlockedRecovery).toBe(true);
    expect(restored.result.current.content).toBe("Retained recovery edit <!-- lock:x -->");
    expect(http).not.toHaveBeenCalled();
    expect(inspectOwnedDrafts("alice").issues[0]?.raw).toBe(raw);
  });

  it("only resumes a repaired source after explicit retry, server version check and editor validation", async () => {
    const raw =
      '{"draftId":"broken","content":"Original <!-- lock:x -->","lockIds":"x","taskId":"A","version":7,"versionKnown":true,"dirty":true,"updatedAt":1}';
    localStorage.setItem("impetus.draft.alice.broken", raw);
    const scope = session();
    let permits = false;
    const http = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return response(task("A", body.content, 8, body.lock_ids));
      }
      return response(task());
    });
    vi.stubGlobal("fetch", http);
    const hook = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, canSave: () => permits })
    );
    await advance();
    expect(hook.result.current.hasBlockedRecovery).toBe(true);
    writeOwnedDraft("alice", {
      draftId: "broken",
      content: "Original <!-- lock:x -->",
      lockIds: ["x"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    await advance(1600);
    expect(http).not.toHaveBeenCalled();
    await act(async () => hook.result.current.retry());
    expect(hook.result.current.hasBlockedRecovery).toBe(false);
    expect(hook.result.current.recoveryIssues).toEqual([]);
    expect(hook.result.current.content).toBe("Original <!-- lock:x -->");
    expect(hook.result.current.lockIds).toEqual(["x"]);
    expect(http.mock.calls.map(([, init]) => init?.method)).toEqual([undefined]);
    permits = true;
    await act(async () => hook.result.current.retry());
    expect(http.mock.calls.map(([, init]) => init?.method)).toEqual([undefined, "PUT"]);
    expect(JSON.parse(String(http.mock.calls[1]?.[1]?.body))).toEqual({
      content: "Original <!-- lock:x -->",
      lock_ids: ["x"],
      version: 7,
    });
  });

  it("keeps the actual task and shows a failed storage read until an explicit retry can finish the requested switch", async () => {
    writeOwnedDraft("alice", {
      draftId: "B-draft",
      content: "cached B",
      lockIds: ["lock-b"],
      taskId: "B",
      version: 11,
      versionKnown: true,
      dirty: false,
      updatedAt: 1,
    });
    const scope = session();
    const http = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return response(task("B", body.content, 12, body.lock_ids));
      }
      return response(
        new URL(String(input)).pathname.endsWith("/B")
          ? task("B", "server B", 11, ["lock-b"])
          : task("A", "server A", 7, ["lock-a"])
      );
    });
    vi.stubGlobal("fetch", http);
    let permits = false;
    const hook = renderHook(
      ({ id }) =>
        useTaskSync("default", {
          userId: "alice",
          session: scope,
          externalTaskId: id,
          canSave: () => permits,
        }),
      { initialProps: { id: "A" } }
    );
    await advance();
    act(() => hook.result.current.onChange("reliable A local", ["lock-a", "lock-new"]));
    const originalGet = Storage.prototype.getItem;
    let fails = true;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (fails && key === "impetus.draft.alice.B-draft")
        throw new DOMException("Storage denied", "SecurityError");
      return originalGet.call(this, key);
    });
    hook.rerender({ id: "B" });
    await advance();
    expect(hook.result.current.taskId).toBe("A");
    expect(hook.result.current.content).toBe("reliable A local");
    expect(hook.result.current.lockIds).toEqual(["lock-a", "lock-new"]);
    expect(hook.result.current.error).toContain("could not be saved on this device");
    expect(hook.result.current.status).toBe("error");
    await act(async () => hook.result.current.retry());
    expect(http.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual(["/tasks/A"]);
    fails = false;
    await act(async () => hook.result.current.retry());
    expect(hook.result.current.taskId).toBe("B");
    expect(hook.result.current.content).toBe("server B");
    expect(hook.result.current.version).toBe(11);
    expect(hook.result.current.error).toBeNull();
    expect(http.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      "/tasks/A",
      "/tasks/B",
    ]);
    expect(readOwnedDraft("alice", "A")).toMatchObject({
      content: "reliable A local",
      dirty: true,
      lockIds: ["lock-a", "lock-new"],
    });
    permits = true;
    act(() => hook.result.current.onChange("B own edit", ["lock-b", "lock-b-new"]));
    await advance(800);
    const save = http.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(new URL(String(save?.[0])).pathname).toBe("/tasks/B");
    expect(JSON.parse(String(save?.[1]?.body))).toEqual({
      content: "B own edit",
      lock_ids: ["lock-b", "lock-b-new"],
      version: 11,
    });
    expect(hook.result.current.version).toBe(12);
  });

  it.each(["getItem", "length"] as const)(
    "handles a permanent storage %s SecurityError without rejecting retries or leaving the reliable task",
    async (boundary) => {
      const scope = session();
      const http = vi.fn<typeof fetch>(async () =>
        response(task("A", "reliable A", 7, ["lock-a"]))
      );
      vi.stubGlobal("fetch", http);
      const hook = renderHook(
        ({ id }) =>
          useTaskSync("default", {
            userId: "alice",
            session: scope,
            externalTaskId: id,
            canSave: () => false,
          }),
        { initialProps: { id: "A" } }
      );
      await advance();
      act(() => hook.result.current.onChange("latest local A", ["lock-a", "lock-new"]));
      const failure = () => {
        throw new DOMException("Storage denied", "SecurityError");
      };
      if (boundary === "getItem")
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(failure);
      else vi.spyOn(Storage.prototype, "length", "get").mockImplementation(failure);
      hook.rerender({ id: "B" });
      await advance();
      await act(async () => {
        await expect(hook.result.current.retry()).resolves.toBeUndefined();
      });
      expect(hook.result.current.taskId).toBe("A");
      expect(hook.result.current.content).toBe("latest local A");
      expect(hook.result.current.lockIds).toEqual(["lock-a", "lock-new"]);
      expect(hook.result.current.status).toBe("error");
      expect(hook.result.current.error).toContain("could not be saved on this device");
      expect(http).toHaveBeenCalledTimes(1);
    }
  );

  it("reports an initial storage read failure without creating a default task, including subsequent typing and retry", async () => {
    writeOwnedDraft("alice", {
      draftId: "retained",
      content: "owned draft",
      lockIds: ["lock-owned"],
      taskId: "A",
      version: 7,
      versionKnown: true,
      dirty: true,
      updatedAt: 1,
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const scope = session();
    const http = vi.fn<typeof fetch>(async () => response(task()));
    vi.stubGlobal("fetch", http);
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance();
    expect(hook.result.current.error).toContain("could not be saved on this device");
    act(() =>
      hook.result.current.onChange("locally retained while storage is unavailable", ["lock-local"])
    );
    await advance(1600);
    await act(async () => {
      await expect(hook.result.current.retry()).resolves.toBeUndefined();
    });
    expect(hook.result.current.content).toBe("locally retained while storage is unavailable");
    expect(hook.result.current.lockIds).toEqual(["lock-local"]);
    expect(http).not.toHaveBeenCalled();
  });
});
