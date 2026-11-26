import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RemoteSession } from "../services/api/remoteSession";
import {
  inspectOwnedDrafts,
  readDraftSelection,
  writeDraftSelection,
  writeOwnedDraft,
} from "../services/draftStore";
import { useTaskSync } from "./useTaskSync";

function scope(): RemoteSession {
  const controller = new AbortController();
  return {
    userId: "alice",
    generation: 1,
    signal: controller.signal,
    isCurrent: () => !controller.signal.aborted,
    onUnauthorized: () => controller.abort(),
  };
}
const content = { A: "server A", B: "server B" };
let lockIds: string[];
let version: number;
const flush = (ms = 0) => act(async () => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  content.A = "server A";
  lockIds = [];
  version = 7;
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const id = new URL(String(input)).pathname.endsWith("/B") ? "B" : "A";
      return new Response(
        JSON.stringify({
          id,
          title: "",
          content: content[id],
          lock_ids: lockIds,
          version,
          category: "WRITING",
          priority: "MEDIUM",
          due_date: null,
          word_count: 2,
          created_at: "2026-10-11T00:00:00Z",
          updated_at: "2026-10-11T00:00:00Z",
        }),
        { status: 200 }
      );
    })
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("restores the tab's own prior A copy after refreshing with B selected", async () => {
  const session = scope();
  const open = (writingContextId: string, active: string | null) =>
    renderHook(
      ({ id }) =>
        useTaskSync("default", {
          userId: "alice",
          session,
          externalTaskId: id,
          writingContextId,
          canSave: () => false,
        }),
      { initialProps: { id: active } }
    );
  const first = open("tab-1", "A");
  const sibling = open("tab-2", "A");
  await flush();
  act(() => first.result.current.onChange("first unique prose", ["first-lock"]));
  first.rerender({ id: "B" });
  await flush(10);
  act(() => sibling.result.current.onChange("sibling newer prose", ["sibling-lock"]));
  first.unmount();

  const refreshed = open("tab-1", null);
  await flush();
  expect(refreshed.result.current.taskId).toBe("B");
  expect(refreshed.result.current.error).toBeNull();
  expect(inspectOwnedDrafts("alice").drafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        content: "first unique prose",
        lockIds: ["first-lock"],
        taskId: "A",
      }),
      expect.objectContaining({
        content: "sibling newer prose",
        lockIds: ["sibling-lock"],
        taskId: "A",
      }),
    ])
  );
  refreshed.rerender({ id: "A" });
  await flush();
  expect(refreshed.result.current).toMatchObject({
    taskId: "A",
    content: "first unique prose",
    lockIds: ["first-lock"],
    version: 7,
    error: null,
  });
});

it("does not adopt another tab's pending copy when selecting a task for the first time", async () => {
  const session = scope();
  const sibling = renderHook(() =>
    useTaskSync("default", {
      userId: "alice",
      session,
      externalTaskId: "A",
      writingContextId: "sibling",
    })
  );
  await flush();
  act(() => sibling.result.current.onChange("other writer's pending text", ["sibling-lock"]));
  sibling.unmount();

  const firstVisit = renderHook(() =>
    useTaskSync("default", {
      userId: "alice",
      session,
      externalTaskId: "A",
      writingContextId: "first-visit",
    })
  );
  await flush(1000);
  expect(firstVisit.result.current).toMatchObject({
    content: content.A,
    lockIds: [],
    version: 7,
    hasUnsavedChanges: false,
  });
  expect(vi.mocked(fetch).mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual([
    "GET",
    "GET",
  ]);
});

it("keeps local snapshot count bounded when repeatedly reopening unchanged writing", async () => {
  writeOwnedDraft("alice", {
    draftId: "original",
    taskId: "A",
    content: content.A,
    lockIds: [],
    version: 7,
    versionKnown: true,
    dirty: false,
    updatedAt: 1,
  });
  writeDraftSelection("alice", "original");

  const session = scope();
  const counts = [inspectOwnedDrafts("alice").drafts.length];
  for (let i = 0; i < 12; i++) {
    const opened = renderHook(() => useTaskSync("default", { userId: "alice", session }));
    await flush(1);
    expect(opened.result.current).toMatchObject({ taskId: "A", content: content.A, error: null });
    opened.unmount();
    counts.push(inspectOwnedDrafts("alice").drafts.length);
  }
  const uniqueBodies = new Set(inspectOwnedDrafts("alice").drafts.map((draft) => draft.content));
  expect([...uniqueBodies]).toEqual([content.A]);
  expect(counts.at(-1), counts.join(" → ")).toBeLessThanOrEqual(2);
});

it("reopens a maximum-size clean draft without filling storage", async () => {
  const large = "讲".repeat(100000);
  content.A = large;
  writeOwnedDraft("alice", {
    draftId: "large-original",
    taskId: "A",
    content: large,
    lockIds: [],
    version: 7,
    versionKnown: true,
    dirty: false,
    updatedAt: 1,
  });
  writeDraftSelection("alice", "large-original");

  const session = scope();
  for (let i = 0; i < 55; i++) {
    const opened = renderHook(() => useTaskSync("default", { userId: "alice", session }));
    await flush(1);
    expect(opened.result.current).toMatchObject({ taskId: "A", version: 7, error: null });
    expect(opened.result.current.content).toBe(large);
    expect(() => act(() => opened.result.current.flushLocal())).not.toThrow();
    opened.unmount();
  }
  expect(inspectOwnedDrafts("alice").drafts.length).toBeLessThanOrEqual(2);
});

it("forks on edit when two instances inherit the same selected clean snapshot", async () => {
  const session = scope();
  const open = () =>
    renderHook(() =>
      useTaskSync("default", {
        userId: "alice",
        session,
        externalTaskId: "A",
        canSave: () => false,
      })
    );
  const first = open();
  await flush();
  const inheritedSelection = readDraftSelection("alice", "editor", "A");
  const sibling = open();
  await flush();
  expect(readDraftSelection("alice", "editor", "A")).toBe(inheritedSelection);
  expect(first.result.current.draftIdentity).not.toBe(sibling.result.current.draftIdentity);

  act(() => first.result.current.onChange("first distinct writing", ["first-lock"]));
  act(() => sibling.result.current.onChange("sibling distinct writing", ["sibling-lock"]));
  expect(inspectOwnedDrafts("alice").drafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        draftId: inheritedSelection,
        content: content.A,
        lockIds: [],
        dirty: false,
      }),
      expect.objectContaining({
        content: "first distinct writing",
        lockIds: ["first-lock"],
        dirty: true,
      }),
      expect.objectContaining({
        content: "sibling distinct writing",
        lockIds: ["sibling-lock"],
        dirty: true,
      }),
    ])
  );
});

it("keeps separate reusable snapshots when the same text has a new version or locks", async () => {
  const session = scope();
  const open = () =>
    renderHook(() => useTaskSync("default", { userId: "alice", session, externalTaskId: "A" }));
  const original = open();
  await flush();
  original.unmount();

  version = 8;
  lockIds = ["new-lock"];
  const newer = open();
  await flush();
  expect(newer.result.current).toMatchObject({ content: content.A, version: 8, lockIds });
  expect(inspectOwnedDrafts("alice").drafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ content: content.A, version: 7, lockIds: [], dirty: false }),
      expect.objectContaining({
        content: content.A,
        version: 8,
        lockIds: ["new-lock"],
        dirty: false,
      }),
    ])
  );
});
