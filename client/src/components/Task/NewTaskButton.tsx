/**
 * NewTaskButton Component
 *
 * Button for creating new tasks with optional inline title input.
 *
 * @module components/Task/NewTaskButton
 */

import { useState, useRef, useCallback } from "react";
import styles from "./NewTaskButton.module.css";

/** Props for NewTaskButton component. */
interface NewTaskButtonProps {
  /** Callback when a new task should be created */
  onCreate: (title: string) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * NewTaskButton - Creates new tasks with inline input.
 *
 * @param props - Component props
 * @returns New task button JSX element
 */
export function NewTaskButton({ onCreate, disabled = false }: NewTaskButtonProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExpand = useCallback((): void => {
    if (disabled) return;
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [disabled]);

  const handleCollapse = useCallback((): void => {
    setIsExpanded(false);
    setTitle("");
  }, []);

  const handleSubmit = useCallback((): void => {
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      onCreate(trimmedTitle);
      handleCollapse();
    }
  }, [title, onCreate, handleCollapse]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        handleCollapse();
      }
    },
    [handleSubmit, handleCollapse]
  );

  const handleBlur = useCallback((): void => {
    if (!title.trim()) {
      handleCollapse();
    }
  }, [title, handleCollapse]);

  return (
    <div
      className={`${styles.container} ${isExpanded ? styles.expanded : ""}`}
      data-testid="new-task-button-container"
    >
      {!isExpanded ? (
        <button
          type="button"
          className={styles.button}
          onClick={handleExpand}
          disabled={disabled}
          aria-label="创建新任务"
          data-testid="new-task-button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ) : (
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder="输入任务标题..."
            aria-label="新任务标题"
            data-testid="new-task-input"
          />
          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleSubmit}
            disabled={!title.trim()}
            aria-label="创建任务"
            data-testid="confirm-create-task"
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
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
