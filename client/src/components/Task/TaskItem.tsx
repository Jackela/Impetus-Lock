/**
 * TaskItem Component
 *
 * Individual task card displaying task title, relative update time,
 * and delete functionality. Supports selected state styling.
 *
 * @module components/Task/TaskItem
 */

import styles from "./TaskItem.module.css";
import type { StoredTask } from "../../types/task";

/**
 * Props for TaskItem component.
 */
interface TaskItemProps {
  /** Task data to display */
  task: StoredTask;
  /** Whether this task is currently selected */
  isSelected: boolean;
  /** Callback when task is clicked */
  onClick: (task: StoredTask) => void;
  /** Callback when delete is confirmed */
  onDelete: (id: string) => void;
}

/**
 * Extract title from task content (first line or first 50 chars).
 *
 * @param content - Task markdown content
 * @returns Extracted title
 */
function extractTitle(content: string): string {
  const firstLine = content.split("\n")[0] || "";
  const cleanTitle = firstLine.replace(/^#+\s*/, "").trim();
  return cleanTitle || "Untitled Task";
}

/**
 * Format timestamp to relative time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "刚刚", "5分钟前", "昨天")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;

  return new Date(timestamp).toLocaleDateString("zh-CN");
}

/**
 * TaskItem - Single task card component.
 *
 * Displays task title, relative update time, and provides
 * selection and deletion functionality.
 *
 * @param props - Component props
 * @returns Task item JSX element
 *
 * @example
 * ```tsx
 * <TaskItem
 *   task={task}
 *   isSelected={currentTaskId === task.id}
 *   onClick={(t) => setCurrentTask(t.id)}
 *   onDelete={(id) => deleteTask(id)}
 * />
 * ```
 */
export function TaskItem({ task, isSelected, onClick, onDelete }: TaskItemProps): JSX.Element {
  /**
   * Handle delete button click with confirmation.
   */
  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (window.confirm("确定要删除这个任务吗？此操作不可撤销。")) {
      onDelete(task.id);
    }
  };

  const title = extractTitle(task.content);
  const relativeTime = formatRelativeTime(task.updatedAt);

  return (
    <div
      className={`${styles.taskItem} ${isSelected ? styles.selected : ""}`}
      onClick={() => onClick(task)}
      role="listitem"
      aria-selected={isSelected}
      data-testid={`task-item-${task.id}`}
    >
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <time className={styles.time} dateTime={new Date(task.updatedAt).toISOString()}>
          {relativeTime}
        </time>
      </div>

      <button
        type="button"
        className={styles.deleteButton}
        onClick={handleDelete}
        aria-label={`删除任务: ${title}`}
        data-testid={`delete-task-${task.id}`}
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
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>
    </div>
  );
}
