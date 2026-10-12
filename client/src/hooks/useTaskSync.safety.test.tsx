import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteSession } from "../services/api/remoteSession";
import type { TaskRecord } from "../services/api/taskClient";
import { inspectOwnedDrafts, writeOwnedDraft, writeDraftSelection } from "../services/draftStore";
import { useTaskSync } from "./useTaskSync";

function session(): RemoteSession {
  const controller = new AbortController();
  return {
    userId: "alice",
    generation: 1,
    signal: controller.signal,
    isCurrent: () => !controller.signal.aborted,
    onUnauthorized: () => controller.abort(),
  };
}

function task(id = "A", content = "server body", locks = ["server-lock"], version = 7): TaskRecord {
  return {
    id,
    title: "",
    content,
    lock_ids: locks,
    version,
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
  };
}

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
async function advance(ms = 0) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

function retained(content: string, lockIds: string[], dirty = true) {
  writeOwnedDraft("alice", {
    draftId: "original-source",
    content,
    lockIds,
    taskId: "A",
    version: 0,
    versionKnown: false,
    dirty,
    updatedAt: 1,
  });
}

describe("owned draft safety at the real hook and HTTP boundary", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  it.each(["new draft", "task switch"] as const)(
    "keeps the current unique memory draft visible when storage rejects a %s",
    async (operation) => {
      const requests: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (input) => {
          const path = new URL(String(input)).pathname;
          requests.push(path);
          return response(
            path.endsWith("/B") ? task("B", "other body", ["other-lock"], 9) : task()
          );
        })
      );
      const scope = session();
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
      const identity = hook.result.current.draftIdentity;
      const save = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("Storage full", "QuotaExceededError");
      });
      act(() => hook.result.current.onChange("unique memory body", ["unique-lock"]));
      if (operation === "new draft")
        act(() =>
          expect(() => hook.result.current.createLocalDraft("replacement body", [])).toThrow()
        );
      else {
        hook.rerender({ id: "B" });
        await advance();
      }
      expect(hook.result.current).toMatchObject({
        draftIdentity: identity,
        taskId: "A",
        content: "unique memory body",
        lockIds: ["unique-lock"],
        version: 7,
      });
      expect(requests).toEqual(["/tasks/A"]);
      save.mockRestore();
      if (operation === "new draft")
        act(() => hook.result.current.createLocalDraft("replacement body", []));
      else await act(async () => hook.result.current.retry());
      expect(inspectOwnedDrafts("alice").drafts).toContainEqual(
        expect.objectContaining({
          content: "unique memory body",
          lockIds: ["unique-lock"],
          taskId: "A",
          version: 7,
          dirty: true,
        })
      );
      expect(hook.result.current.content).toBe(
        operation === "new draft" ? "replacement body" : "other body"
      );
    }
  );
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([
    { content: "local body", locks: ["server-lock"] },
    { content: "server body", locks: ["local-lock"] },
    { content: "retained clean body", locks: ["local-lock"], dirty: false },
  ])(
    "preserves both complete versions when an unknown owned version differs: $content $locks",
    async ({ content, locks, dirty }) => {
      retained(content, locks, dirty ?? true);
      const remote = task();
      const requests: Array<{ method: string; account: string | null; body: unknown }> = [];
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>(async (_input, init) => {
          requests.push({
            method: init?.method ?? "GET",
            account: new Headers(init?.headers).get("X-Expected-User-ID"),
            body: init?.body ? JSON.parse(String(init.body)) : null,
          });
          return response(remote);
        })
      );
      const scope = session();
      const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
      await advance(2000);
      expect(requests.map(({ method }) => method)).toEqual(["GET"]);
      expect(requests[0]?.account).toBe("alice");
      expect(hook.result.current).toMatchObject({
        taskId: "A",
        content,
        lockIds: locks,
        version: 0,
      });
      expect(hook.result.current.conflict).toMatchObject({
        local: { content, lockIds: locks, versionKnown: false },
        server: remote,
      });
      expect(inspectOwnedDrafts("alice").drafts).toContainEqual(
        expect.objectContaining({ content, lockIds: locks, dirty: dirty ?? true })
      );
    }
  );

  it("blocks the selected damaged copy instead of uploading another writer's older valid copy", async () => {
    const raw = JSON.stringify({
      draftId: "selected-bad-copy",
      content: "Latest selected writing <!-- lock:kept -->",
      lockIds: "kept",
      taskId: "A",
      version: 0,
      versionKnown: true,
      dirty: true,
      updatedAt: 20,
    });
    localStorage.setItem("impetus.draft.alice.selected-bad-copy", raw);
    writeOwnedDraft("alice", {
      draftId: "older-valid-copy",
      content: "Older sibling writing",
      lockIds: [],
      taskId: "A",
      version: 0,
      versionKnown: true,
      dirty: true,
      updatedAt: 10,
    });
    writeDraftSelection("alice", "selected-bad-copy");
    const http = vi.fn<typeof fetch>(async () => response(task("A", "Server original", [], 0)));
    vi.stubGlobal("fetch", http);
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: session() }));
    await advance(2000);
    expect(hook.result.current.content).toBe("Latest selected writing <!-- lock:kept -->");
    expect(hook.result.current.hasBlockedRecovery).toBe(true);
    expect(hook.result.current.recoveryIssues).toContainEqual(
      expect.objectContaining({ key: "impetus.draft.alice.selected-bad-copy", raw })
    );
    expect(
      http.mock.calls.filter(([, init]) => init?.method === "PUT" || init?.method === "POST")
    ).toHaveLength(0);
    expect(localStorage.getItem("impetus.draft.alice.selected-bad-copy")).toBe(raw);
    hook.unmount();
    const reopened = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: session() })
    );
    await advance(2000);
    expect(reopened.result.current.content).toBe("Latest selected writing <!-- lock:kept -->");
    expect(reopened.result.current.hasBlockedRecovery).toBe(true);
    expect(
      http.mock.calls.filter(([, init]) => init?.method === "PUT" || init?.method === "POST")
    ).toHaveLength(0);
  });

  it("keeps independent working copies and the original source when two writers open the same owned draft", async () => {
    retained("source body", ["source-lock"]);
    const originalRaw = localStorage.getItem("impetus.draft.alice.original-source");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => response(task()))
    );
    const scope = session();
    const first = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    const second = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance();
    act(() => first.result.current.onChange("first writer", ["first-lock"]));
    act(() => second.result.current.onChange("second writer", ["second-lock"]));
    expect(first.result.current.draftIdentity).not.toBe(second.result.current.draftIdentity);
    expect(localStorage.getItem("impetus.draft.alice.original-source")).toBe(originalRaw);
    expect(inspectOwnedDrafts("alice").drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: "first writer",
          lockIds: ["first-lock"],
          taskId: "A",
          version: 0,
          workingCopyOf: "original-source",
        }),
        expect.objectContaining({
          content: "second writer",
          lockIds: ["second-lock"],
          taskId: "A",
          version: 0,
          workingCopyOf: "original-source",
        }),
      ])
    );
  });

  it("returns to this writer's own task instead of a sibling writer's newer unsaved copy", async () => {
    const scope = session();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) =>
        response(
          new URL(String(input)).pathname.endsWith("/B")
            ? task("B", "other task", ["B-lock"], 4)
            : task()
        )
      )
    );
    const first = renderHook(
      ({ id }) =>
        useTaskSync("default", {
          userId: "alice",
          session: scope,
          externalTaskId: id,
          writingContextId: "first-tab",
          canSave: () => false,
        }),
      { initialProps: { id: "A" } }
    );
    const second = renderHook(() =>
      useTaskSync("default", {
        userId: "alice",
        session: scope,
        externalTaskId: "A",
        writingContextId: "second-tab",
        canSave: () => false,
      })
    );
    await advance();
    const identity = first.result.current.draftIdentity;
    first.rerender({ id: "B" });
    await advance();
    await advance(10);
    act(() => second.result.current.onChange("sibling unsaved writing", ["sibling-lock"]));
    first.rerender({ id: "A" });
    await advance();
    expect(first.result.current).toMatchObject({
      taskId: "A",
      content: "server body",
      lockIds: ["server-lock"],
      version: 7,
      draftIdentity: identity,
    });
    expect(second.result.current).toMatchObject({
      content: "sibling unsaved writing",
      lockIds: ["sibling-lock"],
      version: 7,
    });
  });

  it("keeps this writer's background copy after the same account session is checked again", async () => {
    const scope = session();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) =>
        response(
          new URL(String(input)).pathname.endsWith("/B")
            ? task("B", "other task", ["B-lock"], 4)
            : task()
        )
      )
    );
    const first = renderHook(
      ({ id, currentSession }: { id: string; currentSession: RemoteSession | null }) =>
        useTaskSync("default", {
          userId: "alice",
          session: currentSession,
          externalTaskId: id,
          writingContextId: "first-tab",
          canSave: () => false,
        }),
      { initialProps: { id: "A", currentSession: scope as RemoteSession | null } }
    );
    const sibling = renderHook(() =>
      useTaskSync("default", {
        userId: "alice",
        session: scope,
        externalTaskId: "A",
        writingContextId: "sibling-tab",
        canSave: () => false,
      })
    );
    await advance();
    act(() => first.result.current.onChange("first writer unique unsaved", ["first-lock"]));
    const originalIdentity = first.result.current.draftIdentity;
    first.rerender({ id: "B", currentSession: scope });
    await advance(10);
    act(() => sibling.result.current.onChange("sibling newer unsaved", ["sibling-lock"]));
    first.rerender({ id: "B", currentSession: null });
    await advance();
    const checkedSession = session();
    first.rerender({ id: "B", currentSession: checkedSession });
    await advance();
    first.rerender({ id: "A", currentSession: checkedSession });
    await advance();
    expect(first.result.current).toMatchObject({
      taskId: "A",
      content: "first writer unique unsaved",
      lockIds: ["first-lock"],
      version: 7,
    });
    expect(inspectOwnedDrafts("alice").drafts).toContainEqual(
      expect.objectContaining({
        content: "first writer unique unsaved",
        lockIds: ["first-lock"],
        workingCopyOf: originalIdentity,
      })
    );
    expect(sibling.result.current.content).toBe("sibling newer unsaved");
  });

  it("confirms an identical complete unknown version without sending a redundant update", async () => {
    retained("server body", ["server-lock"]);
    const http = vi.fn<typeof fetch>(async () => response(task()));
    vi.stubGlobal("fetch", http);
    const scope = session();
    const hook = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance(1600);
    expect(http.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["GET"]);
    expect(hook.result.current).toMatchObject({
      content: "server body",
      lockIds: ["server-lock"],
      taskId: "A",
      version: 7,
      hasUnsavedChanges: false,
      conflict: null,
    });
  });

  it("restores the last selected task after another task's late save changes ordering", async () => {
    let finishSave!: (response: Response) => void;
    const save = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    const http = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === "PUT") return save;
      return response(
        new URL(String(input)).pathname.endsWith("/B")
          ? task("B", "selected body", ["selected-lock"], 12)
          : task()
      );
    });
    vi.stubGlobal("fetch", http);
    const scope = session();
    const first = renderHook(
      ({ id }) =>
        useTaskSync("default", {
          userId: "alice",
          session: scope,
          externalTaskId: id,
          writingContextId: "first-tab",
        }),
      { initialProps: { id: "A" } }
    );
    await advance();
    act(() => first.result.current.onChange("late A body", ["late-lock"]));
    await advance(800);
    first.rerender({ id: "B" });
    await advance();
    await advance(10);
    await act(async () => finishSave(response(task("A", "late A body", ["late-lock"], 8))));
    expect(inspectOwnedDrafts("alice").drafts[0]?.taskId).toBe("A");
    first.unmount();
    const refreshed = renderHook(() =>
      useTaskSync("default", { userId: "alice", session: scope, writingContextId: "first-tab" })
    );
    await advance();
    expect(refreshed.result.current).toMatchObject({
      taskId: "B",
      content: "selected body",
      lockIds: ["selected-lock"],
      version: 12,
    });
  });

  it("preserves a committed-but-unacknowledged create and never repeats it automatically, even after refresh", async () => {
    const records: TaskRecord[] = [];
    const requests: Array<{ method: string; path: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ method, path: url.pathname, body });
        if (method === "POST") {
          records.push(task("committed", body.content, body.lock_ids, 0));
          throw new TypeError("Failed to fetch after server committed");
        }
        if (url.pathname === "/tasks/committed") return response(records[0]);
        return response({ tasks: records, total: records.length, limit: 100, offset: 0 });
      })
    );
    const scope = session();
    const first = renderHook(() =>
      useTaskSync("submitted body", { userId: "alice", session: scope })
    );
    await advance();
    act(() => first.result.current.onChange("newer local body", ["newer-lock"]));
    await advance(1600);
    await act(async () => first.result.current.retry());
    expect(requests.filter(({ method }) => method === "POST")).toHaveLength(1);
    expect(first.result.current.creationUncertain).toBe(true);
    first.unmount();
    const restored = renderHook(() => useTaskSync("default", { userId: "alice", session: scope }));
    await advance(1600);
    expect(restored.result.current).toMatchObject({
      content: "newer local body",
      lockIds: ["newer-lock"],
      taskId: null,
      creationUncertain: true,
    });
    let candidates: TaskRecord[] = [];
    await act(async () => {
      candidates = await restored.result.current.checkCreation();
    });
    expect(candidates).toEqual([task("committed", "submitted body", [], 0)]);
    expect(restored.result.current.creationUncertain).toBe(true);
    expect(restored.result.current.taskId).toBeNull();
    expect(requests.filter(({ method }) => method === "POST")).toHaveLength(1);
    await act(async () => restored.result.current.adoptCreation("committed"));
    expect(restored.result.current).toMatchObject({
      content: "newer local body",
      lockIds: ["newer-lock"],
      taskId: "committed",
      creationUncertain: false,
    });
    expect(restored.result.current.conflict).toMatchObject({
      local: { content: "newer local body", lockIds: ["newer-lock"], versionKnown: false },
      server: task("committed", "submitted body", [], 0),
    });
    expect(inspectOwnedDrafts("alice").drafts).toContainEqual(
      expect.objectContaining({
        content: "newer local body",
        lockIds: ["newer-lock"],
        taskId: null,
        creationUncertain: true,
        recoveryOf: expect.any(String),
      })
    );
    expect(requests.filter(({ method }) => method === "PUT")).toEqual([]);
  });
});
