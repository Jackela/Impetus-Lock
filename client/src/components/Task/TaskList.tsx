/**
 * Enhanced Task List Component
 *
 * Sprint 2: Task List with filtering, sorting, and metadata
 *
 * Displays tasks with category badges, priority indicators,
 * due dates, and inline actions.
 *
 * @module components/Task/TaskList
 */

import { useState, useMemo } from "react";
import type { StoredTask } from "../../types/task";
import {
  TaskCategory,
  TaskPriority,
  getCategoryDisplayName,
  getCategoryColor,
  getPriorityDisplayName,
  getPriorityColor,
  isTaskOverdue,
  isTaskDueSoon,
} from "../../types/task";

interface TaskListProps {
  /** Array of tasks to display */
  tasks: StoredTask[];
  /** Currently selected task ID */
  selectedId?: string | null;
  /** Callback when task is selected */
  onSelect: (task: StoredTask) => void;
  /** Callback when task is deleted */
  onDelete?: (taskId: string) => void;
  /** Callback when task completion is toggled */
  onToggleComplete?: (taskId: string, completed: boolean) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Enable compact view */
  compact?: boolean;
}

/**
 * Enhanced task list with filtering and sorting.
 *
 * Features:
 * - Category and priority badges
 * - Due date indicators (overdue, due soon)
 * - Sortable columns
 * - Inline actions
 * - Empty state
 * - Responsive design
 */
export function TaskList({
  tasks,
  selectedId,
  onSelect,
  onDelete,
  onToggleComplete,
  isLoading = false,
  emptyMessage = "No tasks yet. Create your first task!",
  compact = false,
}: TaskListProps) {
  const [sortBy, setSortBy] = useState<"updated" | "created" | "due" | "priority">("updated");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | null>(null);
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // Apply filters
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory);
    }
    if (filterPriority) {
      result = result.filter((t) => t.priority === filterPriority);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "created":
          return b.createdAt - a.createdAt;
        case "due":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "priority": {
          const priorityOrder = {
            [TaskPriority.HIGH]: 0,
            [TaskPriority.MEDIUM]: 1,
            [TaskPriority.LOW]: 2,
          };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        case "updated":
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return result;
  }, [tasks, sortBy, filterCategory, filterPriority]);

  if (isLoading) {
    return <TaskListSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="
            px-3 py-1.5 text-sm rounded-lg
            border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-700 dark:text-gray-300
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
          aria-label="Sort tasks"
        >
          <option value="updated">Sort by Updated</option>
          <option value="created">Sort by Created</option>
          <option value="due">Sort by Due Date</option>
          <option value="priority">Sort by Priority</option>
        </select>

        {/* Category filter */}
        <select
          value={filterCategory ?? ""}
          onChange={(e) =>
            setFilterCategory(e.target.value ? (e.target.value as TaskCategory) : null)
          }
          className="
            px-3 py-1.5 text-sm rounded-lg
            border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-700 dark:text-gray-300
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {Object.values(TaskCategory).map((cat) => (
            <option key={cat} value={cat}>
              {getCategoryDisplayName(cat)}
            </option>
          ))}
        </select>

        {/* Priority filter */}
        <select
          value={filterPriority ?? ""}
          onChange={(e) =>
            setFilterPriority(e.target.value ? (e.target.value as TaskPriority) : null)
          }
          className="
            px-3 py-1.5 text-sm rounded-lg
            border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-700 dark:text-gray-300
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
          aria-label="Filter by priority"
        >
          <option value="">All Priorities</option>
          {Object.values(TaskPriority).map((pri) => (
            <option key={pri} value={pri}>
              {getPriorityDisplayName(pri)}
            </option>
          ))}
        </select>

        {/* Clear filters */}
        {(filterCategory || filterPriority) && (
          <button
            type="button"
            onClick={() => {
              setFilterCategory(null);
              setFilterPriority(null);
            }}
            className="
              px-3 py-1.5 text-sm
              text-gray-600 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-gray-200
              transition-colors
            "
          >
            Clear filters
          </button>
        )}

        {/* Task count */}
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {filteredAndSortedTasks.length} task{filteredAndSortedTasks.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Task list */}
      {filteredAndSortedTasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <svg
            className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <ul className="space-y-2" role="listbox" aria-label="Tasks">
          {filteredAndSortedTasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              isSelected={task.id === selectedId}
              onSelect={() => onSelect(task)}
              onDelete={onDelete ? () => onDelete(task.id) : undefined}
              onToggleComplete={
                onToggleComplete ? (completed) => onToggleComplete(task.id, completed) : undefined
              }
              compact={compact}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Individual task list item.
 */
interface TaskListItemProps {
  task: StoredTask;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onToggleComplete?: (completed: boolean) => void;
  compact: boolean;
}

function TaskListItem({
  task,
  isSelected,
  onSelect,
  onDelete,
  onToggleComplete,
  compact,
}: TaskListItemProps) {
  const categoryColor = getCategoryColor(task.category);
  const priorityColor = getPriorityColor(task.priority);

  const isOverdue = task.dueDate ? isTaskOverdue(task.dueDate) : false;
  const isDueSoon = task.dueDate ? isTaskDueSoon(task.dueDate) : false;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <li>
      <div
        onClick={onSelect}
        className={`
          group flex items-center gap-3 p-3 rounded-lg cursor-pointer
          transition-colors
          ${
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }
        `}
        role="option"
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {/* Checkbox */}
        {onToggleComplete && (
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => {
              e.stopPropagation();
              onToggleComplete(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            aria-label={`Mark ${task.title} as complete`}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Title */}
            <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{task.title}</h4>

            {/* Badges */}
            {!compact && (
              <>
                {/* Category badge */}
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full
                    bg-${categoryColor}-100 dark:bg-${categoryColor}-900/30
                    text-${categoryColor}-700 dark:text-${categoryColor}-300
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-${categoryColor}-500`} />
                  {getCategoryDisplayName(task.category)}
                </span>

                {/* Priority badge */}
                <span
                  className={`
                    inline-flex items-center px-2 py-0.5 text-xs rounded-full
                    bg-${priorityColor}-100 dark:bg-${priorityColor}-900/30
                    text-${priorityColor}-700 dark:text-${priorityColor}-300
                  `}
                >
                  {getPriorityDisplayName(task.priority)}
                </span>
              </>
            )}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {/* Due date */}
            {task.dueDate && (
              <span
                className={`
                  inline-flex items-center gap-1
                  ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}
                  ${isDueSoon && !isOverdue ? "text-amber-600 dark:text-amber-400" : ""}
                `}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {formatDueDate(task.dueDate)}
                {isOverdue && " (Overdue)"}
              </span>
            )}

            {/* Word count */}
            <span className="inline-flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {task.wordCount} words
            </span>

            {/* Lock count */}
            {task.lockIds.length > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                {task.lockIds.length}
              </span>
            )}

            {/* Updated time */}
            <span>Updated {formatDate(task.updatedAt)}</span>
          </div>
        </div>

        {/* Actions */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="
              p-2 opacity-0 group-hover:opacity-100
              text-gray-400 hover:text-red-500
              hover:bg-red-50 dark:hover:bg-red-900/20
              rounded-lg transition-all
            "
            aria-label="Delete task"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Task list loading skeleton.
 */
function TaskListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="w-32 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="w-36 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="w-32 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>

      {/* Task items */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="flex-1">
            <div className="w-1/3 h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="w-1/4 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
