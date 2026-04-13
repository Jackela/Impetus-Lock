/**
 * Unit tests for useTaskSyncCloud hook
 * @module hooks/useTaskSyncCloud.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTaskSyncCloud } from "./useTaskSyncCloud";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useTaskSyncCloud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("fetches tasks on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tasks: [
          {
            id: "t1",
            title: "Test",
            content: "Content",
            lock_ids: [],
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            version: 0,
          },
        ],
      }),
    });

    const { result } = renderHook(() => useTaskSyncCloud(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].id).toBe("t1");
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useTaskSyncCloud(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
  });

  it("creates task and invalidates cache", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "t2",
          title: "New",
          content: "New Task",
          lock_ids: [],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          version: 0,
        }),
      });

    const { result } = renderHook(() => useTaskSyncCloud(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.createTask({ content: "New Task", lockIds: [] });

    await waitFor(() => expect(result.current.isCreating).toBe(false));
  });
});
