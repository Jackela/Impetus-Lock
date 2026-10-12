import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useAccountExport } from "./useAccountExport";
import type { TaskRecord } from "../services/api/taskClient";

function task(index: number): TaskRecord {
  return {
    id: `task-${index}`,
    title: `Title ${index}`,
    content: `Body ${index}`,
    lock_ids: [`lock-${index}`],
    version: index,
    category: "WRITING",
    priority: "MEDIUM",
    due_date: null,
    word_count: 2,
    created_at: "2026-10-11T00:00:00Z",
    updated_at: "2026-10-11T00:00:00Z",
  };
}
const stats = {
  total_tasks: 0,
  total_muse_interventions: 0,
  total_loki_interventions: 0,
  total_locks_created: 0,
  writing_minutes: 0,
  last_activity_at: null,
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([0, 100, 101, 201])(
  "exports all %i tasks with their full bodies, locks and versions",
  async (count) => {
    const records = Array.from({ length: count }, (_, index) => task(index));
    const offsets: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/stats/") return response({ ...stats, total_tasks: count });
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        offsets.push(offset);
        return response({
          tasks: records.slice(offset, offset + limit),
          total: count,
          limit,
          offset,
        });
      })
    );
    const hook = renderHook(useAccountExport);
    const download = vi.fn();
    await act(async () => hook.result.current.exportAccountData(download));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0]?.[0].tasks).toMatchObject({ total: count, tasks: records });
    expect(hook.result.current.error).toBeNull();
    expect(offsets).toEqual(
      count <= 100 ? [0, 0] : count === 101 ? [0, 100, 0, 100] : [0, 100, 200, 0, 100, 200]
    );
  }
);

it("refuses a partial download when the second page fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/stats/") return response(stats);
      const offset = Number(url.searchParams.get("offset"));
      return offset === 100
        ? response({}, 503)
        : response({
            tasks: Array.from({ length: 100 }, (_, index) => task(index)),
            total: 101,
            limit: 100,
            offset: 0,
          });
    })
  );
  const hook = renderHook(useAccountExport);
  const download = vi.fn();
  await act(async () => hook.result.current.exportAccountData(download));
  expect(download).not.toHaveBeenCalled();
  expect(hook.result.current.error).toContain("HTTP 503");
  expect(hook.result.current.exporting).toBe(false);
});

it.each(["body", "locks", "version", "identity", "total"] as const)(
  "stops on an observable collection %s change and only downloads after a new stable attempt",
  async (change) => {
    let records = Array.from({ length: 101 }, (_, index) => task(index));
    let rounds = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === "/stats/") return response(stats);
        const offset = Number(url.searchParams.get("offset"));
        if (offset === 0 && ++rounds === 2) {
          if (change === "total") records = [...records, task(101)];
          else
            records[0] = {
              ...task(0),
              ...(change === "body" ? { content: "changed body" } : {}),
              ...(change === "locks" ? { lock_ids: ["changed-lock"] } : {}),
              ...(change === "version" ? { version: 1 } : {}),
              ...(change === "identity" ? { id: "replacement-id" } : {}),
            };
        }
        return response({
          tasks: records.slice(offset, offset + 100),
          total: records.length,
          limit: 100,
          offset,
        });
      })
    );
    const hook = renderHook(useAccountExport);
    const download = vi.fn();
    await act(async () => hook.result.current.exportAccountData(download));
    expect(download).not.toHaveBeenCalled();
    expect(hook.result.current.error).toContain("collection changed");
    expect(rounds).toBe(2);
    await act(async () => hook.result.current.exportAccountData(download));
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0]?.[0].tasks.tasks).toEqual(records);
    expect(hook.result.current.error).toBeNull();
  }
);
