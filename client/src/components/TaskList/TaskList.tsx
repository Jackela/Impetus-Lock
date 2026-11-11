import { memo } from "react";
import type { TaskRecord } from "../../types/task";
import { Button } from "../ui";
import { TaskItem } from "./TaskItem";
import "./TaskList.css";

/** Props for the task sidebar list. */
export interface TaskListProps {
  /** Tasks to display. */
  tasks: TaskRecord[];
  /** Called when a task row is activated. */
  onTaskClick?: (task: TaskRecord) => void;
  /** Id of the task currently open in the editor. */
  selectedTaskId?: string;
  /** Called from the empty-state call to action. */
  onCreateTask?: () => void;
}

/**
 * TaskList component for displaying a list of tasks.
 *
 * Shows task title (truncated content), creation time, and lock status.
 * Each task can be clicked to navigate to the task detail view.
 *
 * The list owns its empty state only: loading and error states belong to the
 * sidebar so exactly one of "loading", "error", and "no tasks" is on screen.
 *
 * Memoized on its props so header, menu, and save-state updates in
 * `AppLayout` do not re-render the sidebar rows.
 *
 * @param props - Component props
 * @param props.tasks - Array of tasks to display
 * @param props.onTaskClick - Optional callback when a task is clicked
 * @param props.selectedTaskId - Optional ID of the currently selected task
 * @param props.onCreateTask - Optional callback for the empty-state CTA
 * @returns The rendered task list, or an empty-state notice
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
export const TaskList = memo(function TaskList({
  tasks,
  onTaskClick,
  selectedTaskId,
  onCreateTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="task-list-empty" data-testid="task-list-empty">
        <h3 className="task-list-empty__title">No tasks yet</h3>
        <p className="task-list-empty__body">
          Start a piece here and it will show up in this list.
        </p>
        {onCreateTask && (
          <Button variant="primary" size="sm" onClick={onCreateTask}>
            Create your first task
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="task-list" data-testid="task-list">
      <ul className="task-list-items" role="list">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            selected={task.id === selectedTaskId}
            onSelect={onTaskClick}
          />
        ))}
      </ul>
    </div>
  );
});
