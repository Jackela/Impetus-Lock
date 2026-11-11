import { memo } from "react";
import type { TaskRecord } from "../../types/task";
import { LockIcon } from "../ui";

/**
 * Derives a display title from raw task content.
 *
 * @param content - Markdown content of the task
 * @returns The first line, truncated to 100 characters
 */
function getTaskTitle(content: string): string {
  const lines = content.split("\n");
  const firstLine = lines[0] || "Untitled Task";
  return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;
}

/**
 * Formats a timestamp as a short relative age.
 *
 * @param dateString - ISO timestamp to format
 * @returns Relative age (e.g. "2h ago"), or a locale date beyond one week
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

/** Props for a single row in the task sidebar. */
export interface TaskItemProps {
  /** Task rendered by this row. */
  task: TaskRecord;
  /** Whether this row is the task currently open in the editor. */
  selected: boolean;
  /** Called when the row's button is activated. */
  onSelect?: (task: TaskRecord) => void;
}

/**
 * One task row in the sidebar list.
 *
 * Memoized so a sidebar re-render (menu toggles, refetches, saving state) only
 * re-renders rows whose own task or selection actually changed.
 *
 * @param props - Component props
 * @param props.task - Task rendered by this row
 * @param props.selected - Whether this row is the selected task
 * @param props.onSelect - Called when the row's button is activated
 * @returns The rendered list row
 */
export const TaskItem = memo(function TaskItem({ task, selected, onSelect }: TaskItemProps) {
  const hasLocks = task.lock_ids.length > 0;
  const title = getTaskTitle(task.content);

  return (
    <li className="task-list-item">
      <button
        type="button"
        className={`task-list-item-button ${selected ? "selected" : ""}`}
        onClick={() => onSelect?.(task)}
        aria-current={selected ? "true" : undefined}
        data-testid={`task-item-${task.id}`}
        data-task-id={task.id}
      >
        <div className="task-item-header">
          <h3 className="task-item-title">{title}</h3>
          {hasLocks && (
            <span
              className="task-item-lock-badge"
              aria-label={`${task.lock_ids.length} locked section${task.lock_ids.length > 1 ? "s" : ""}`}
              title={`${task.lock_ids.length} locked section${task.lock_ids.length > 1 ? "s" : ""}`}
            >
              <LockIcon size={16} />
              <span className="lock-count">{task.lock_ids.length}</span>
            </span>
          )}
        </div>
        <div className="task-item-meta">
          <time
            className="task-item-time"
            dateTime={task.created_at}
            title={new Date(task.created_at).toLocaleString()}
          >
            {formatRelativeTime(task.created_at)}
          </time>
          {task.version > 1 && (
            <span className="task-item-version" title={`Version ${task.version}`}>
              v{task.version}
            </span>
          )}
        </div>
      </button>
    </li>
  );
});
