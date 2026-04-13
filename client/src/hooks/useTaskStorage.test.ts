/**
 * Unit tests for useTaskStorage hook
 * @module hooks/useTaskStorage.test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskStorage } from "./useTaskStorage";
import type { TaskStorage, StoredTask } from "../types/task";

const STORAGE_KEY = "impetus_tasks_v1";

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

describe("useTaskStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "localStorage", { value: mockLocalStorage, writable: true });
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: vi.fn(() => `uuid-${Date.now()}`) },
      writable: true,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  describe("initial load", () => {
    it("returns empty array when localStorage is empty", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(result.current.tasks).toEqual([]);
      expect(result.current.currentTaskId).toBeNull();
    });

    it("parses valid data from localStorage", async () => {
      const stored: TaskStorage = {
        version: 1,
        tasks: [
          { id: "t1", title: "Test", content: "# Test", lockIds: [], createdAt: 1, updatedAt: 2 },
        ],
        currentTaskId: "t1",
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(stored));
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.currentTaskId).toBe("t1");
    });

    it("clears and returns empty when version mismatches", async () => {
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify({ version: 2, tasks: [], currentTaskId: null })
      );
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(result.current.tasks).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("handles JSON parse error gracefully", async () => {
      mockLocalStorage.getItem.mockReturnValue("invalid");
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(result.current.tasks).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe("CRUD operations", () => {
    beforeEach(() => mockLocalStorage.getItem.mockReturnValue(null));

    it("addTask creates task with correct properties", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      let newTask: StoredTask | undefined;
      act(() => {
        newTask = result.current.actions.addTask("# Title\nBody", ["lock1"]);
      });
      expect(result.current.tasks).toHaveLength(1);
      expect(newTask!.title).toBe("# Title");
      expect(newTask!.content).toBe("# Title\nBody");
      expect(newTask!.lockIds).toEqual(["lock1"]);
    });

    it("persists to localStorage after debounce", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      act(() => result.current.actions.addTask("Save Me"));
      await waitFor(() => expect(mockLocalStorage.setItem).toHaveBeenCalled(), { timeout: 1000 });
      const saved = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(saved.version).toBe(1);
      expect(saved.tasks[0].title).toBe("Save Me");
    });

    it("updateTask modifies task and updates updatedAt", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      let taskId: string;
      act(() => {
        taskId = result.current.actions.addTask("Original").id;
      });
      const before = Date.now();
      act(() => result.current.actions.updateTask(taskId, { title: "Updated" }));
      const updated = result.current.tasks.find((t) => t.id === taskId);
      expect(updated!.title).toBe("Updated");
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it("deleteTask removes task from list", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      let taskId: string;
      act(() => {
        taskId = result.current.actions.addTask("Delete Me").id;
      });
      expect(result.current.tasks).toHaveLength(1);
      act(() => result.current.actions.deleteTask(taskId));
      expect(result.current.tasks).toHaveLength(0);
    });

    it("setCurrentTask updates currentTaskId", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      act(() => result.current.actions.setCurrentTask("task123"));
      expect(result.current.currentTaskId).toBe("task123");
    });
  });

  describe("edge cases", () => {
    beforeEach(() => mockLocalStorage.getItem.mockReturnValue(null));

    it("ignores update for non-existent task id", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      act(() => result.current.actions.addTask("Existing"));
      const before = result.current.tasks;
      act(() => result.current.actions.updateTask("missing", { title: "New" }));
      expect(result.current.tasks).toEqual(before);
    });

    it("resets currentTaskId to null when current task is deleted", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      let taskId: string;
      act(() => {
        taskId = result.current.actions.addTask("Current").id;
      });
      act(() => result.current.actions.setCurrentTask(taskId));
      expect(result.current.currentTaskId).toBe(taskId);
      act(() => result.current.actions.deleteTask(taskId));
      expect(result.current.currentTaskId).toBeNull();
    });

    it("extracts title from first line of content", async () => {
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("ready"));
      let task: StoredTask | undefined;
      act(() => {
        task = result.current.actions.addTask("Line1\nLine2");
      });
      expect(task!.title).toBe("Line1");
    });
  });

  describe("error handling", () => {
    it("sets error status when localStorage is disabled", async () => {
      Object.defineProperty(window, "localStorage", { value: undefined, writable: true });
      const { result } = renderHook(() => useTaskStorage());
      await waitFor(() => expect(result.current.status).toBe("error"));
      expect(result.current.error).not.toBeNull();
    });
  });
});
