/**
 * TaskList Component
 *
 * Displays a list of tasks with selection, creation, and deletion.
 * Integrates with useTaskStorage for state management.
 *
 * @module components/Task/TaskList
 */

import styles from "./TaskList.module.css";
import { TaskItem } from "./TaskItem";
import { NewTaskButton } from "./NewTaskButton";
import { useTaskStorage } from "../../hooks/useTaskStorage";
import type { StoredTask } from "../../types/task";

/**
 * Props for TaskList component.
 */
interface TaskListProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * TaskList - Main task list container component.
 *
 * Uses useTaskStorage hook to manage task state and provides
 * a sidebar interface for task management.
 *
 * @param props - Component props
 * @returns Task list JSX element
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <div className="app">
 *       <TaskList className="sidebar" />
 *       <Editor />
 *     </div>
 *   );
 * }
 * ```
 */
export function TaskList({ className = "" }: TaskListProps): JSX.Element {
  const { tasks, currentTaskId, status, error, actions } = useTaskStorage();

  /**
   * Handle task selection.
   */
  const handleTaskClick = (task: StoredTask): void => {
    actions.setCurrentTask(task.id);
  };

  /**
   * Handle task deletion.
   */
  const handleDeleteTask = (id: string): void => {
    actions.deleteTask(id);
  };

  /**
   * Handle new task creation.
   */
  const handleCreateTask = (title: string): void => {
    const content = `# ${title}\n\n`;
    const newTask = actions.addTask(content);
    actions.setCurrentTask(newTask.id);
  };

  // Sort tasks by update time (newest first)
  const sortedTasks = [...tasks].sort((a, b) => b.updatedAt - a.updatedAt);

  if (status === "loading") {
    return (
      <div className={`${styles.container} ${className}`} data-testid="task-list-loading">
        <div className={styles.loading}>加载中...</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`${styles.container} ${className}`} data-testid="task-list-error">
        <div className={styles.error}>
          <p>加载失败</p>
          <span>{error?.message || "未知错误"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} data-testid="task-list">
      <header className={styles.header}>
        <h2 className={styles.title}>任务列表</h2>
        <span className={styles.count}>{tasks.length}</span>
      </header>

      <div className={styles.scrollArea}>
        {sortedTasks.length === 0 ? (
          <div className={styles.empty}>
            <p>暂无任务</p>
            <span>点击下方按钮创建新任务</span>
          </div>
        ) : (
          <div className={styles.list} role="list" aria-label="任务列表">
            {sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                isSelected={task.id === currentTaskId}
                onClick={handleTaskClick}
                onDelete={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <NewTaskButton onCreate={handleCreateTask} disabled={status !== "ready"} />
      </footer>
    </div>
  );
}
