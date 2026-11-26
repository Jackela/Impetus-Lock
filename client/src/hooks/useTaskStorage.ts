/**
 * Task Storage Hook
 *
 * React hook for localStorage-based task persistence.
 * Provides CRUD operations with automatic serialization.
 *
 * @module hooks/useTaskStorage
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { StoredTask, TaskStorageState, TaskStorageActions } from "../types/task";
import { StorageError, TaskCategory, TaskPriority } from "../types/task";

const STORAGE_KEY = "impetus_tasks_v1";
const SAVE_DEBOUNCE_MS = 500;

/**
 * Extract title from content (first line).
 *
 * @param content - Task content to extract the title from
 * @returns The trimmed first line, or "Untitled" when empty
 */
function extractTitle(content: string): string {
  return content.split("\n")[0]?.trim() || "Untitled";
}

type TaskStorageSnapshot = Omit<TaskStorageState, "actions">;

function emptyStorage(): TaskStorageSnapshot {
  return { tasks: [], currentTaskId: null, status: "loading", error: null };
}

function readStorage(): TaskStorageSnapshot {
  const ready: TaskStorageSnapshot = { ...emptyStorage(), status: "ready" };
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      throw new StorageError("unavailable", "localStorage is not available");
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return ready;

    let data: unknown;
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return ready;
    }
    if (
      typeof data === "object" &&
      data !== null &&
      "version" in data &&
      "tasks" in data &&
      "currentTaskId" in data
    ) {
      if (data.version !== 1) {
        localStorage.removeItem(STORAGE_KEY);
        return ready;
      }
      return {
        ...ready,
        tasks: data.tasks as StoredTask[],
        currentTaskId: data.currentTaskId as string | null,
      };
    }
    return ready;
  } catch (err) {
    const error =
      err instanceof StorageError
        ? err
        : new StorageError("unknown", err instanceof Error ? err.message : "Unknown error");
    return { ...emptyStorage(), status: "error", error };
  }
}

function createTaskStorage() {
  const initial = emptyStorage();
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(patch: Partial<TaskStorageSnapshot>) {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * React hook for task localStorage persistence.
 *
 * @returns Task storage state and actions
 */
export function useTaskStorage(): TaskStorageState {
  const [storage] = useState(createTaskStorage);
  const { tasks, currentTaskId, status, error } = useSyncExternalStore(
    storage.subscribe,
    storage.getSnapshot,
    storage.getServerSnapshot
  );

  useEffect(() => {
    storage.update(readStorage());
  }, [storage]);

  // Persist to localStorage on changes (debounced)
  useEffect(() => {
    if (status !== "ready") return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks, currentTaskId }));
      } catch (err) {
        const type =
          err instanceof Error && err.name === "QuotaExceededError" ? "quota_exceeded" : "unknown";
        storage.update({
          error: new StorageError(type, err instanceof Error ? err.message : "Save failed"),
          status: "error",
        });
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [storage, tasks, currentTaskId, status]);

  const addTask = useCallback(
    (content: string, lockIds?: string[]): StoredTask => {
      const now = Date.now();
      const newTask: StoredTask = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(36).slice(2)}`,
        title: extractTitle(content),
        content,
        lockIds: lockIds ?? [],
        category: TaskCategory.WRITING,
        priority: TaskPriority.MEDIUM,
        dueDate: null,
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      storage.update({ tasks: [newTask, ...storage.getSnapshot().tasks] });
      return newTask;
    },
    [storage]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<StoredTask, "id" | "createdAt">>): void => {
      storage.update({
        tasks: storage
          .getSnapshot()
          .tasks.map((task) =>
            task.id === id ? { ...task, ...updates, updatedAt: Date.now() } : task
          ),
      });
    },
    [storage]
  );

  const deleteTask = useCallback(
    (id: string): void => {
      const current = storage.getSnapshot();
      storage.update({
        tasks: current.tasks.filter((task) => task.id !== id),
        currentTaskId: current.currentTaskId === id ? null : current.currentTaskId,
      });
    },
    [storage]
  );

  const setCurrentTask = useCallback(
    (id: string | null): void => {
      storage.update({ currentTaskId: id });
    },
    [storage]
  );

  const actions: TaskStorageActions = {
    addTask,
    updateTask,
    deleteTask,
    setCurrentTask,
  };

  return { tasks, currentTaskId, status, error, actions };
}
