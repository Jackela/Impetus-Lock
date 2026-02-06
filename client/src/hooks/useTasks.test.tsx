/**
 * useTasks Hook Tests
 *
 * Test suite for useTasks hook that fetches task list from the API using React Query.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written before implementation
 * - Article V (Documentation): Complete JSDoc comments
 *
 * @module hooks/useTasks.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTasks } from "./useTasks";
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
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
}

describe("useTasks", () => {
  const mockTasks: TaskRecord[] = [
    {
      id: "task-1",
      content: "First task content",
      lock_ids: ["lock_1"],
      created_at: "2025-02-04T10:00:00Z",
      updated_at: "2025-02-04T10:00:00Z",
      version: 1,
    },
    {
      id: "task-2",
      content: "Second task content",
      lock_ids: [],
      created_at: "2025-02-04T09:00:00Z",
      updated_at: "2025-02-04T09:00:00Z",
      version: 0,
    },
  ];

  const mockTaskListResponse = {
    total: 2,
    limit: 100,
    offset: 0,
    tasks: mockTasks,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("initially returns loading state with empty data", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fetches tasks successfully and returns data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskListResponse,
    } as Response);

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockTasks);
    expect(result.current.error).toBeNull();
    expect(result.current.total).toBe(2);

    // Verify fetch was called correctly (includes query params)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/tasks/?limit=100");
  });

  it("handles API error and sets error state", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal server error" }),
    } as Response);

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBeTruthy();
  });

  it("handles network error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toContain("Network error");
  });

  it("returns empty array when API returns empty list", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 0,
        limit: 100,
        offset: 0,
        tasks: [],
      }),
    } as Response);

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.total).toBe(0);
  });

  it("provides refetch function to reload tasks", async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: async () => mockTaskListResponse,
      } as Response);
    });

    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(queryClient),
    });

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(callCount).toBe(1);

    // Call refetch
    await result.current.refetch();

    expect(callCount).toBe(2);
    expect(result.current.data).toEqual(mockTasks);
  });

  it("uses different query keys for different limit/offset values", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTaskListResponse,
    } as Response);

    const queryClient = createTestQueryClient();
    const wrapper = createWrapper(queryClient);

    // First hook with default params
    const { result: result1 } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
    });

    // Second hook with different params
    const { result: result2 } = renderHook(() => useTasks({ limit: 10, offset: 20 }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false);
    });

    // Both hooks should have their own data
    expect(result1.current.limit).toBe(100);
    expect(result2.current.limit).toBe(10);
    expect(result2.current.offset).toBe(20);
  });
});
