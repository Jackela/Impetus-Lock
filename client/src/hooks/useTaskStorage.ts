/**
 * Task Storage Hook
 *
 * React hook for localStorage-based task persistence.
 * Provides CRUD operations with automatic serialization.
 *
 * @module hooks/useTaskStorage
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  StoredTask,
  StorageStatus,
  TaskStorageState,
  TaskStorageActions,
} from "../types/task";
import { StorageError } from "../types/task";

const STORAGE_KEY = "impetus_tasks_v1";
const SAVE_DEBOUNCE_MS = 500;

/** Extract title from content (first line). */
function extractTitle(content: string): string {
  return content.split("\n")[0]?.trim() || "Untitled";
}

/**
 * React hook for task localStorage persistence.
 *
 * @returns Task storage state and actions
 */
export function useTaskStorage(): TaskStorageState {
  const [tasks, setTasks] = useState<StoredTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<StorageStatus>("loading");
  const [error, setError] = useState<StorageError | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        throw new StorageError("unavailable", "localStorage is not available");
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("ready");
        return;
      }

      let data: unknown;
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setStatus("ready");
        return;
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "version" in data &&
        "tasks" in data &&
        "currentTaskId" in data
      ) {
        const storage = data as { version: number; tasks: unknown[]; currentTaskId: unknown };
        if (storage.version !== 1) {
          localStorage.removeItem(STORAGE_KEY);
          setStatus("ready");
          return;
        }
        setTasks(storage.tasks as StoredTask[]);
        setCurrentTaskId(storage.currentTaskId as string | null);
      }
      setStatus("ready");
    } catch (err) {
      const storageError =
        err instanceof StorageError
          ? err
          : new StorageError("unknown", err instanceof Error ? err.message : "Unknown error");
      setError(storageError);
      setStatus("error");
    }
  }, []);

  // Persist to localStorage on changes (debounced)
  useEffect(() => {
    if (status !== "ready") return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks, currentTaskId }));
      } catch (err) {
        const type =
          err instanceof Error && err.name === "QuotaExceededError" ? "quota_exceeded" : "unknown";
        setError(new StorageError(type, err instanceof Error ? err.message : "Save failed"));
        setStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [tasks, currentTaskId, status]);

  const addTask = useCallback((content: string, lockIds?: string[]): StoredTask => {
    const now = Date.now();
    const newTask: StoredTask = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${now}-${Math.random().toString(36).slice(2)}`,
      title: extractTitle(content),
      content,
      lockIds: lockIds ?? [],
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  }, []);

  const updateTask = useCallback(
    (id: string, updates: Partial<Omit<StoredTask, "id" | "createdAt">>): void => {
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, ...updates, updatedAt: Date.now() } : task))
      );
    },
    []
  );

  const deleteTask = useCallback((id: string): void => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    setCurrentTaskId((prev) => (prev === id ? null : prev));
  }, []);

  const setCurrentTask = useCallback((id: string | null): void => {
    setCurrentTaskId(id);
  }, []);

  const actions: TaskStorageActions = {
    addTask,
    updateTask,
    deleteTask,
    setCurrentTask,
  };

  return { tasks, currentTaskId, status, error, actions };
}
