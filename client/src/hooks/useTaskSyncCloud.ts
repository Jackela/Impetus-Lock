/**
 * Cloud Task Sync Hook
 *
 * React Query based cloud synchronization for tasks.
 * Provides automatic syncing with optimistic updates.
 *
 * @module hooks/useTaskSyncCloud
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import type { StoredTask } from "../types/task";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface TaskApiResponse {
  id: string;
  title: string;
  content: string;
  lock_ids: string[];
  created_at: string;
  updated_at: string;
  version: number;
}

const tasksApi = {
  async list(): Promise<StoredTask[]> {
    const res = await fetch(`${API_URL}/tasks/`, {
      credentials: "include",
    });
    if (res.status === 401) {
      throw new Error("Unauthorized - Please login");
    }
    if (!res.ok) throw new Error("Failed to fetch tasks");
    const data = await res.json();
    return data.tasks.map((t: TaskApiResponse) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      lockIds: t.lock_ids,
      createdAt: new Date(t.created_at).getTime(),
      updatedAt: new Date(t.updated_at).getTime(),
    }));
  },

  async create(content: string, lockIds: string[]): Promise<StoredTask> {
    const res = await fetch(`${API_URL}/tasks/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content, lock_ids: lockIds }),
    });
    if (res.status === 401) {
      throw new Error("Unauthorized - Please login");
    }
    if (!res.ok) throw new Error("Failed to create task");
    const t = await res.json();
    return {
      id: t.id,
      title: t.title,
      content: t.content,
      lockIds: t.lock_ids,
      createdAt: new Date(t.created_at).getTime(),
      updatedAt: new Date(t.updated_at).getTime(),
    };
  },

  async update(id: string, updates: Partial<StoredTask>): Promise<void> {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        content: updates.content,
        lock_ids: updates.lockIds,
        version: 0, // TODO: proper versioning
      }),
    });
    if (res.status === 401) {
      throw new Error("Unauthorized - Please login");
    }
    if (!res.ok) throw new Error("Failed to update task");
  },

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 401) {
      throw new Error("Unauthorized - Please login");
    }
    if (!res.ok) throw new Error("Failed to delete task");
  },
};

const TASKS_QUERY_KEY = ["tasks"];

/**
 * Hook for cloud task synchronization with optimistic updates.
 */
export function useTaskSyncCloud() {
  const queryClient = useQueryClient();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: tasksApi.list,
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: ({ content, lockIds }: { content: string; lockIds: string[] }) =>
      tasksApi.create(content, lockIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StoredTask> }) =>
      tasksApi.update(id, updates),
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    },
  });

  const syncTask = useCallback(
    (id: string, updates: Partial<StoredTask>) => {
      // Debounce sync by 2 seconds
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        updateMutation.mutate({ id, updates });
      }, 2000);
    },
    [updateMutation]
  );

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    tasks,
    isLoading,
    error,
    createTask: createMutation.mutate,
    updateTask: syncTask,
    deleteTask: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
