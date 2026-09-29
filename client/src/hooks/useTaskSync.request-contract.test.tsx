import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskSync } from "./useTaskSync";

describe("useTaskSync request contract", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("bootstraps a task with content and lock_ids accepted by the transport", async () => {
    let transportStatus = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        content?: unknown;
        lock_ids?: unknown;
      };
      // TaskCreateRequest requires nonempty content and string lock IDs.
      const validBody =
        typeof body.content === "string" &&
        body.content.length >= 1 &&
        body.content.length <= 100000 &&
        Array.isArray(body.lock_ids) &&
        body.lock_ids.every((id: unknown) => typeof id === "string");
      transportStatus = validBody ? 201 : 422;
      return new Response(
        JSON.stringify(
          validBody
            ? {
                id: "task-created",
                title: "",
                content: "# New draft",
                lock_ids: [],
                category: "WRITING",
                priority: "MEDIUM",
                due_date: null,
                word_count: 0,
                created_at: "2026-09-29T00:00:00Z",
                updated_at: "2026-09-29T00:00:00Z",
                version: 0,
              }
            : { detail: [{ loc: ["body", "content"], type: "missing" }] }
        ),
        { status: transportStatus, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    // Keep useTaskSync and taskClient real; stub only the HTTP boundary.
    const { result } = renderHook(() => useTaskSync("# New draft"));
    await waitFor(() => expect(result.current.status).not.toBe("loading"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(new URL(String(url)).pathname).toBe("/tasks");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body)), `transport returned HTTP ${transportStatus}`).toEqual({
      content: "# New draft",
      lock_ids: [],
    });
    expect(result.current.status).toBe("ready");
    expect(result.current.taskId).toBe("task-created");
    expect(result.current.error).toBeNull();
  });

  it("saves existing task content, lock_ids and the loaded version accepted by the transport", async () => {
    const existing = {
      id: "task-existing",
      title: "",
      content: "# Saved draft",
      lock_ids: ["lock-original"],
      category: "WRITING",
      priority: "MEDIUM",
      due_date: null,
      word_count: 0,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-29T00:00:00Z",
      version: 7,
    };
    let transportStatus = 0;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method !== "PUT") {
        return new Response(JSON.stringify(existing), { status: 200 });
      }

      const body = JSON.parse(String(init.body)) as {
        content?: unknown;
        lock_ids?: unknown;
        version?: unknown;
      };
      // TaskUpdateRequest requires content, string lock IDs and a nonnegative integer version.
      const validBody =
        typeof body.content === "string" &&
        body.content.length >= 1 &&
        body.content.length <= 100000 &&
        Array.isArray(body.lock_ids) &&
        body.lock_ids.every((id: unknown) => typeof id === "string") &&
        typeof body.version === "number" &&
        Number.isInteger(body.version) &&
        body.version >= 0;
      transportStatus = validBody ? 200 : 422;
      return new Response(
        JSON.stringify(
          validBody
            ? {
                ...existing,
                content: body.content,
                lock_ids: body.lock_ids,
                version: 8,
              }
            : { detail: [{ loc: ["body", "content"], type: "missing" }] }
        ),
        { status: transportStatus }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useTaskSync("# Default", { externalTaskId: "task-existing" })
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    vi.useFakeTimers();
    act(() => result.current.onChange("# Edited draft", ["lock-original", "lock-added"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(new URL(String(url)).pathname).toBe("/tasks/task-existing");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body)), `transport returned HTTP ${transportStatus}`).toEqual({
      content: "# Edited draft",
      lock_ids: ["lock-original", "lock-added"],
      version: 7,
    });
    expect(result.current.content).toBe("# Edited draft");
    expect(result.current.lockIds).toEqual(["lock-original", "lock-added"]);
    expect(result.current.version).toBe(8);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.error).toBeNull();
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "task-existing",
      version: 8,
    });
  });

  it("creates the edited local draft with its locks when the API becomes available", async () => {
    let transportStatus = 0;
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        content?: unknown;
        lock_ids?: unknown;
      };
      const validBody =
        typeof body.content === "string" &&
        body.content.length >= 1 &&
        body.content.length <= 100000 &&
        Array.isArray(body.lock_ids) &&
        body.lock_ids.every((id: unknown) => typeof id === "string");
      transportStatus = validBody ? 201 : 422;
      return new Response(
        JSON.stringify(
          validBody
            ? {
                id: "task-recovered",
                title: "",
                content: body.content,
                lock_ids: body.lock_ids,
                category: "WRITING",
                priority: "MEDIUM",
                due_date: null,
                word_count: 0,
                created_at: "2026-09-29T00:00:00Z",
                updated_at: "2026-09-29T00:00:00Z",
                version: 0,
              }
            : { detail: [{ loc: ["body", "content"], type: "missing" }] }
        ),
        { status: transportStatus }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTaskSync("# Default"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.taskId).toBeNull();

    vi.useFakeTimers();
    act(() => result.current.onChange("# Recovered draft", ["lock-recovered"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(new URL(String(url)).pathname).toBe("/tasks");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body)), `transport returned HTTP ${transportStatus}`).toEqual({
      content: "# Recovered draft",
      lock_ids: ["lock-recovered"],
    });
    expect(result.current.taskId).toBe("task-recovered");
    expect(result.current.content).toBe("# Recovered draft");
    expect(result.current.lockIds).toEqual(["lock-recovered"]);
    expect(result.current.version).toBe(0);
    expect(result.current.error).toBeNull();
    expect(JSON.parse(localStorage.getItem("impetus.task.meta")!)).toEqual({
      taskId: "task-recovered",
      version: 0,
    });
  });
});
