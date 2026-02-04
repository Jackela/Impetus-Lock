import type { TaskRecord } from "../../types/task";
import "./TaskList.css";

/**
 * TaskList component for displaying a list of tasks.
 *
 * Shows task title (truncated content), creation time, and lock status.
 * Each task can be clicked to navigate to the task detail view.
 *
 * @param props - Component props
 * @param props.tasks - Array of tasks to display
 * @param props.onTaskClick - Optional callback when a task is clicked
 * @param props.selectedTaskId - Optional ID of the currently selected task
 *
 * @example
 * ```tsx
 * <TaskList
 *   tasks={tasks}
 *   onTaskClick={(task) => console.log('Clicked', task.id)}
 *   selectedTaskId="task-123"
 * />
 * ```
 */
export function TaskList({
  tasks,
  onTaskClick,
  selectedTaskId,
}: {
  tasks: TaskRecord[];
  onTaskClick?: (task: TaskRecord) => void;
  selectedTaskId?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="task-list-empty" data-testid="task-list-empty">
        <p>No tasks yet. Create your first task to get started!</p>
      </div>
    );
  }

  // Get title from content (first line or first 100 chars)
  const getTaskTitle = (content: string): string => {
    const lines = content.split("\n");
    const firstLine = lines[0] || "Untitled Task";
    return firstLine.length > 100 ? firstLine.slice(0, 100) + "..." : firstLine;
  };

  // Format date to relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="task-list" data-testid="task-list">
      <ul className="task-list-items" role="list">
        {tasks.map((task) => {
          const isSelected = task.id === selectedTaskId;
          const hasLocks = task.lock_ids.length > 0;
          const title = getTaskTitle(task.content);

          return (
            <li key={task.id} className="task-list-item">
              <button
                type="button"
                className={`task-list-item-button ${isSelected ? "selected" : ""}`}
                onClick={() => onTaskClick?.(task)}
                aria-selected={isSelected}
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
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
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
        })}
      </ul>
    </div>
  );
}
