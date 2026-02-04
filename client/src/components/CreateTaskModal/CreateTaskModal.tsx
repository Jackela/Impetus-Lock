import { useCallback, useEffect, useState } from "react";
import { useCreateTask } from "../../hooks/useCreateTask";
import "./CreateTaskModal.css";

/**
 * CreateTaskModal - Modal for creating new tasks.
 *
 * Provides a form with a title input and confirm/cancel buttons.
 * Integrates with useCreateTask hook for API calls and includes
 * validation, error display, and success handling with refetch.
 *
 * **Features**:
 * - Title input with non-empty validation
 * - Confirm and cancel buttons
 * - Error display for API failures
 * - Loading state during submission
 * - Success callback integration with refetch
 * - Keyboard shortcuts (Escape to close, Enter to submit)
 * - Click outside to close
 *
 * **Accessibility**:
 * - `role="dialog"` and `aria-modal` for screen readers
 * - Focus management on input when opened
 * - Escape key closes modal
 * - Enter key submits form (when input has content)
 *
 * @param props - Component props
 * @param props.open - Whether the modal is open
 * @param props.onClose - Callback when modal is closed
 * @param props.onSuccess - Optional callback after successful task creation
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * const { refetch } = useTasks();
 *
 * <CreateTaskModal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => refetch()}
 * />
 * ```
 */
export function CreateTaskModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: (task: { id: string; title: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutate, isLoading: isCreating } = useCreateTask();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setTitle("");
      setError(null);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setTitle("");
      setError(null);
      onClose();
    }
  }, [isCreating, onClose]);

  const handleSubmit = useCallback(() => {
    const trimmedTitle = title.trim();

    // Validation: title must not be empty
    if (!trimmedTitle) {
      setError("Please enter a task title");
      return;
    }

    // Clear any previous errors
    setError(null);

    // Call the mutation
    mutate(
      { content: trimmedTitle },
      {
        onSuccess: (task) => {
          setTitle("");
          setError(null);
          onClose();
          // onSuccess callback can trigger refetch
          onSuccess?.({ id: task.id, title: trimmedTitle });
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to create task");
        },
      }
    );
  }, [title, mutate, onClose, onSuccess]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        const input = document.getElementById("create-task-title");
        input?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // Handle Enter key to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && title.trim() && !isCreating) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [title, isCreating, handleSubmit]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="create-task-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title-label"
      data-testid="create-task-modal"
    >
      <div className="create-task-modal">
        <h2 id="create-task-title-label">Create New Task</h2>

        <div className="create-task-form">
          <div className="form-group">
            <label htmlFor="create-task-title">Task Title *</label>
            <input
              id="create-task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                // Clear error when user starts typing
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              placeholder="Enter task title..."
              maxLength={200}
              aria-invalid={error !== null}
              aria-describedby={error ? "create-task-error" : undefined}
              data-testid="create-task-input"
            />
            <span className="char-count">{title.length}/200</span>
          </div>

          {error && (
            <div
              className="create-task-error"
              role="alert"
              id="create-task-error"
              data-testid="create-task-error"
            >
              {error}
            </div>
          )}
        </div>

        <div className="create-task-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={handleClose}
            disabled={isCreating}
            data-testid="create-task-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-button"
            onClick={handleSubmit}
            disabled={isCreating || !title.trim()}
            data-testid="create-task-confirm"
          >
            {isCreating ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
