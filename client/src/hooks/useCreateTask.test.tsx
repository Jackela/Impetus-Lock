/**
 * useCreateTask Hook Tests
 *
 * Test suite for useCreateTask hook that creates tasks via the API using React Query.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written before implementation
 * - Article V (Documentation): Complete JSDoc comments
 *
 * @module hooks/useCreateTask.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateTask } from "./useCreateTask";
import type { TaskRecord } from "../types/task";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

/**
 * Creates a wrapper component with QueryClientProvider for testing React Query hooks.
 *
 * @param queryClient - Optional QueryClient instance (creates fresh one if not provided)
 * @returns React component wrapper
 */
function createWrapper(queryClient?: QueryClient): React.FC<{ children: React.ReactNode }> {
  return function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient ?? createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Creates a test QueryClient with default options.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: false, // Disable retry for faster tests
      },
      mutations: {
        retry: false, // Disable retry for faster tests
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
}

describe("useCreateTask", () => {
  const mockCreatedTask: TaskRecord = {
    id: "task-1",
    content: "New task content",
    lock_ids: [],
    created_at: "2025-02-04T10:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    version: 0,
  };

  const mockTaskResponse = {
    id: "task-1",
    content: "New task content",
    lock_ids: [],
    created_at: "2025-02-04T10:00:00Z",
    updated_at: "2025-02-04T10:00:00Z",
    version: 0,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initially returns idle state with no error", () => {
    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("creates a task successfully via mutate", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskResponse,
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    // Initially not loading
    expect(result.current.isLoading).toBe(false);

    // Trigger mutation
    result.current.mutate({ content: "New task content" });

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();

    // Verify fetch was called correctly
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "New task content", lock_ids: [] }),
    });
  });

  it("creates a task with lock IDs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskResponse,
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      content: "Locked task content",
      lockIds: ["lock_1", "lock_2"],
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();

    // Verify fetch was called with lock_ids
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Locked task content", lock_ids: ["lock_1", "lock_2"] }),
    });
  });

  it("creates a task successfully via mutateAsync and returns data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskResponse,
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    // Trigger mutation and wait for result
    const createdTask = await result.current.mutateAsync({ content: "New task content" });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(createdTask).toEqual(mockCreatedTask);
  });

  it("handles API error and sets error state", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Invalid content" }),
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ content: "" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain("Failed to create task");
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ content: "New task" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain("Network error");
  });

  it("invalidates tasks query cache on success", async () => {
    const queryClient = createTestQueryClient();

    // Populate the cache with tasks query
    queryClient.setQueryData(["tasks", { limit: 100, offset: 0 }], {
      total: 0,
      limit: 100,
      offset: 0,
      tasks: [],
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskResponse,
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ content: "New task" });

    // Verify invalidateQueries was called with tasks query key
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });

  it("sets isLoading to true during mutation", async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    mockFetch.mockReturnValue(fetchPromise);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ content: "Delayed task" });

    // Wait for loading state to be set (React Query updates state asynchronously)
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    // Resolve the fetch
    resolveFetch!({
      ok: true,
      json: async () => mockTaskResponse,
    } as Response);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("mutateAsync throws on error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    } as Response);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync({ content: "Bad task" })).rejects.toThrow();

    // After mutateAsync throws, the mutation is complete
    expect(result.current.isLoading).toBe(false);
  });
});
