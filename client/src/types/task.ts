/**
 * Task-related types.
 *
 * This module exports task types for use in components and services.
 * Includes both API task types and local storage task types.
 */

import type { TaskRecord } from "../services/api/taskClient";

export type { TaskRecord };

/**
 * Task stored in localStorage.
 *
 * Simplified version of TaskRecord for frontend persistence.
 * Uses camelCase and number timestamps for JSON serialization.
 */
export interface StoredTask {
  /** Unique task identifier */
  id: string;
  /** Task title (first line of content) */
  title: string;
  /** Markdown content of the task */
  content: string;
  /** Lock IDs applied to task content */
  lockIds: string[];
  /** Unix timestamp of task creation */
  createdAt: number;
  /** Unix timestamp of last update */
  updatedAt: number;
}

/**
 * Root structure stored in localStorage.
 *
 * @example
 * localStorage key: "impetus_tasks_v1"
 * {
 *   version: 1,
 *   tasks: [...],
 *   currentTaskId: "task_123"
 * }
 */
export interface TaskStorage {
  /** Storage schema version for migration detection */
  version: 1;
  /** Array of stored tasks */
  tasks: StoredTask[];
  /** Currently selected task ID (null if none) */
  currentTaskId: string | null;
}

/**
 * Error types for storage operations.
 */
export type StorageErrorType =
  | "quota_exceeded"
  | "version_mismatch"
  | "parse_error"
  | "unavailable"
  | "unknown";

/**
 * Error class for storage operations.
 */
export class StorageError extends Error {
  /**
   * Creates a new StorageError.
   *
   * @param type - Error type classification
   * @param message - Human-readable error message
   */
  constructor(
    public type: StorageErrorType,
    message: string
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Status of storage initialization and operations.
 */
export type StorageStatus = "loading" | "ready" | "error";

/**
 * Actions returned by useTaskStorage hook.
 *
 * Bundled into a single object to keep hook return value <= 5 properties.
 */
export interface TaskStorageActions {
  /** Add a new task */
  addTask: (content: string, lockIds?: string[]) => StoredTask;
  /** Update an existing task */
  updateTask: (id: string, updates: Partial<Omit<StoredTask, "id" | "createdAt">>) => void;
  /** Delete a task by ID */
  deleteTask: (id: string) => void;
  /** Set the current active task */
  setCurrentTask: (id: string | null) => void;
}

/**
 * Return value of useTaskStorage hook.
 */
export interface TaskStorageState {
  /** Array of stored tasks, sorted by updatedAt desc */
  tasks: StoredTask[];
  /** Currently selected task ID */
  currentTaskId: string | null;
  /** Storage initialization status */
  status: StorageStatus;
  /** Error info if status is 'error' */
  error: StorageError | null;
  /** Task operations */
  actions: TaskStorageActions;
}
