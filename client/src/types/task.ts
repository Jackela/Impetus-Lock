/**
 * Task-related types.
 *
 * This module exports task types for use in components and services.
 * Includes both API task types and local storage task types.
 */

import type { TaskRecord } from "../services/api/taskClient";

export type { TaskRecord };

/**
 * Task categories for organizing work.
 */
export enum TaskCategory {
  WRITING = "WRITING",
  PLANNING = "PLANNING",
  RESEARCH = "RESEARCH",
  REVIEW = "REVIEW",
}

/**
 * Task priorities for focus management.
 */
export enum TaskPriority {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

/**
 * Task stored in localStorage.
 *
 * Enhanced version with Sprint 2 fields (category, priority, due_date).
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
  /** Task category */
  category: TaskCategory;
  /** Task priority */
  priority: TaskPriority;
  /** Due date (ISO string, null if none) */
  dueDate: string | null;
  /** Word count */
  wordCount: number;
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
 * Task filter criteria for API queries.
 */
export interface TaskFilter {
  /** Filter by categories (OR logic within list) */
  categories?: TaskCategory[];
  /** Filter by priorities (OR logic within list) */
  priorities?: TaskPriority[];
  /** Filter tasks due before this date (ISO string) */
  dueBefore?: string;
  /** Filter tasks due after this date (ISO string) */
  dueAfter?: string;
  /** Filter to only overdue tasks */
  overdueOnly?: boolean;
  /** Full-text search in title/content */
  searchQuery?: string;
}

/**
 * Task sort configuration.
 */
export interface TaskSort {
  /** Field to sort by */
  field: "created_at" | "updated_at" | "due_date" | "priority";
  /** Sort direction */
  order: "asc" | "desc";
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

/**
 * Helper to get display name for category.
 */
export function getCategoryDisplayName(category: TaskCategory): string {
  const names: Record<TaskCategory, string> = {
    [TaskCategory.WRITING]: "Writing",
    [TaskCategory.PLANNING]: "Planning",
    [TaskCategory.RESEARCH]: "Research",
    [TaskCategory.REVIEW]: "Review",
  };
  return names[category];
}

/**
 * Helper to get color class for category.
 */
export function getCategoryColor(category: TaskCategory): string {
  const colors: Record<TaskCategory, string> = {
    [TaskCategory.WRITING]: "blue",
    [TaskCategory.PLANNING]: "purple",
    [TaskCategory.RESEARCH]: "amber",
    [TaskCategory.REVIEW]: "green",
  };
  return colors[category];
}

/**
 * Helper to get display name for priority.
 */
export function getPriorityDisplayName(priority: TaskPriority): string {
  const names: Record<TaskPriority, string> = {
    [TaskPriority.HIGH]: "High",
    [TaskPriority.MEDIUM]: "Medium",
    [TaskPriority.LOW]: "Low",
  };
  return names[priority];
}

/**
 * Helper to get color class for priority.
 */
export function getPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    [TaskPriority.HIGH]: "red",
    [TaskPriority.MEDIUM]: "yellow",
    [TaskPriority.LOW]: "gray",
  };
  return colors[priority];
}

/**
 * Check if a task is overdue.
 */
export function isTaskOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/**
 * Check if a task is due soon (within 24 hours).
 */
export function isTaskDueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
}
