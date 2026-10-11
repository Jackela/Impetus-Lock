import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCreateTask } from "../../hooks/useCreateTask";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useOptionalAuth } from "../../contexts/AuthContext";
import type { TaskRecord } from "../../types/task";
import { useModalFormRecovery } from "../../hooks/useModalFormRecovery";
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
 * - Focus trap keeps Tab key cycling within modal
 * - Focus moves to first focusable element when opened
 * - Focus returns to trigger element when closed
 * - Escape key closes modal
 * - Enter key submits form (when input has content)
 *
 * @param props - Component props
 * @param props.open - Whether the modal is open
 * @param props.onClose - Callback when modal is closed
 * @param props.onSuccess - Optional callback after successful task creation
 * @returns The rendered modal dialog, or `null` when closed
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
  const latestTitle = useRef(title);
  latestTitle.current = title;
  const [error, setError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const {
    mutate,
    isLoading: isCreating,
    error: recoveryError,
    creationUncertain,
    pendingAttempt,
    pendingAttempts,
    checkCreation,
    adoptCreation,
    selectAttempt,
    retryRecovery,
    isCheckingCreation,
    recoveryReadFailed,
  } = useCreateTask();
  const [candidates, setCandidates] = useState<TaskRecord[] | null>(null);
  const [creatingAnother, setCreatingAnother] = useState(false);
  const auth = useOptionalAuth();
  const viewSession = auth?.session;
  const ownerId = auth?.user?.id;
  const remoteEnabled = auth === undefined || auth.remoteEnabled;
  const formOwner = useRef(ownerId);
  const ownsTitle = formOwner.current === ownerId;
  const pendingSnapshot = useRef(pendingAttempt);
  pendingSnapshot.current = pendingAttempt;
  const currentView = useRef(viewSession);
  currentView.current = viewSession;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = isCreating || isCheckingCreation;
  const unconfirmed = creationUncertain && !creatingAnother;
  const {
    drafts: formRecoveries,
    error: formRecoveryError,
    preserveTitle,
    retryRecovery: retryFormRecovery,
  } = useModalFormRecovery({
    open,
    ownerId: formOwner.current,
    titleRef: latestTitle,
    unsubmitted: !busy && !unconfirmed,
    separateFrom: creatingAnother ? pendingAttempt?.draftId : undefined,
  });
  const visibleError =
    error ??
    formRecoveryError ??
    (creationUncertain && !creatingAnother
      ? "Task creation could not be confirmed. The attempted content is retained below. Recheck before creating again."
      : recoveryReadFailed
        ? (recoveryError?.message ?? null)
        : null);
  const isExitingRef = useRef(false);
  const { ref: focusTrapRef } = useFocusTrap<HTMLDivElement>({ active: open });

  // Initialize ownership before the form becomes interactive. A session
  // generation change keeps this account's input because ownerId is unchanged.
  useLayoutEffect(() => {
    if (open) {
      setIsExiting(false);
      isExitingRef.current = false;
      formOwner.current = ownerId;
      setTitle(pendingSnapshot.current?.content ?? "");
      setError(null);
      setCandidates(null);
      setCreatingAnother(false);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, ownerId]);
  const handleRestoreTitle = (draft: (typeof formRecoveries)[number]) => {
    if (!ownerId || busy) return;
    try {
      if (ownsTitle && title && title !== draft.content && (!creationUncertain || creatingAnother))
        preserveTitle();
      if (draft.workingCopyOf) selectAttempt(draft.workingCopyOf);
      formOwner.current = ownerId;
      setTitle(draft.content);
      setCreatingAnother(creationUncertain);
      setCandidates(null);
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The current title could not be retained. Keep this form open and retry."
      );
    }
  };

  const handleClose = useCallback(() => {
    if (!busy && !isExitingRef.current) {
      isExitingRef.current = true;
      setIsExiting(true);
      // Wait for exit animation to complete before closing
      closeTimer.current = setTimeout(() => {
        setTitle("");
        setError(null);
        onClose();
      }, 150);
    }
  }, [busy, onClose]);

  const handleSubmit = useCallback(() => {
    if (!ownsTitle || !remoteEnabled || busy || unconfirmed || isExitingRef.current) return;
    const trimmedTitle = title.trim();

    // Validation: title must not be empty
    if (!trimmedTitle) {
      setError("Please enter a task title");
      return;
    }

    // Clear any previous errors
    setError(null);

    // This explicit submission consumes the editable separate form.
    setCreatingAnother(false);
    mutate(
      { content: trimmedTitle, ...(creatingAnother ? { allowDuplicate: true } : {}) },
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
  }, [
    title,
    mutate,
    onClose,
    onSuccess,
    busy,
    unconfirmed,
    creatingAnother,
    remoteEnabled,
    ownsTitle,
  ]);

  const handleRecheck = async () => {
    if (!remoteEnabled) return;
    const captured = viewSession;
    setError(null);
    setCandidates(null);
    try {
      const found = await checkCreation();
      if (currentView.current === captured) setCandidates(found);
    } catch (failure) {
      if (currentView.current === captured && (!captured || captured.isCurrent()))
        setError(
          failure instanceof Error ? failure.message : "Creation check failed. Please retry."
        );
    }
  };
  const handleAdopt = async (taskId: string) => {
    if (!remoteEnabled) return;
    const captured = viewSession;
    setError(null);
    try {
      const task = await adoptCreation(taskId);
      if (currentView.current !== captured || (captured && !captured.isCurrent())) return;
      setTitle("");
      setError(null);
      onSuccess?.({ id: task.id, title: task.content });
      onClose();
    } catch (failure) {
      if (currentView.current === captured && (!captured || captured.isCurrent()))
        setError(
          failure instanceof Error
            ? failure.message
            : "The task could not be selected. Please recheck."
        );
    }
  };
  const exportAttempt = () => {
    if (!pendingAttempt) return;
    const anchor = document.createElement("a");
    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(pendingAttempt))}`;
    anchor.download = "unconfirmed-task-creation.json";
    anchor.click();
  };

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !isExitingRef.current) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // Handle Enter key to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && title.trim() && !busy && !unconfirmed) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [title, busy, unconfirmed, handleSubmit]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className={`create-task-modal-overlay${isExiting ? " modal-exit" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !isExitingRef.current) {
          handleClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title-label"
      data-testid="create-task-modal"
    >
      <div ref={focusTrapRef} className="create-task-modal">
        <h2 id="create-task-title-label">Create New Task</h2>

        <div className="create-task-form">
          <div className="form-group">
            <label htmlFor="create-task-title">Task Title *</label>
            <input
              id="create-task-title"
              type="text"
              value={ownsTitle ? title : ""}
              onChange={(e) => {
                latestTitle.current = e.target.value;
                setTitle(e.target.value);
                // Clear error when user starts typing
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={busy || unconfirmed}
              placeholder="Enter task title..."
              maxLength={200}
              aria-invalid={error !== null}
              aria-describedby={visibleError ? "create-task-error" : undefined}
              data-testid="create-task-input"
            />
            <span className="char-count">{ownsTitle ? title.length : 0}/200</span>
          </div>

          {!remoteEnabled && (
            <p role="status">
              Task creation is paused while your account is checked. Your unsubmitted title remains
              editable.
            </p>
          )}
          {visibleError && (
            <div
              className="create-task-error"
              role="alert"
              id="create-task-error"
              data-testid="create-task-error"
            >
              {visibleError}
            </div>
          )}
        </div>

        {formRecoveries.length > 0 && (
          <details className="create-task-recovery">
            <summary>Saved unsubmitted task titles</summary>
            <p>
              These inputs belong to this account. Restore a title explicitly before submitting it.
            </p>
            {formRecoveries.map((draft) => (
              <div key={draft.draftId}>
                <pre aria-label="Saved unsubmitted title" tabIndex={0}>
                  {draft.content}
                </pre>
                <button type="button" disabled={busy} onClick={() => handleRestoreTitle(draft)}>
                  Restore unsubmitted title
                </button>
              </div>
            ))}
          </details>
        )}
        {pendingAttempt && (
          <section className="create-task-recovery" aria-label="Unconfirmed task creation recovery">
            <h3>Unconfirmed task creation</h3>
            <p>
              The server may already have created this task. Closing or refreshing keeps this
              attempt. A new task may duplicate it.
            </p>
            {pendingAttempts.length > 1 && (
              <label>
                Retained attempt
                <select
                  aria-label="Retained attempt"
                  value={pendingAttempt.draftId}
                  disabled={busy || creatingAnother}
                  onChange={(event) => {
                    const attempt = pendingAttempts.find(
                      (item) => item.draftId === event.target.value
                    );
                    selectAttempt(event.target.value);
                    if (attempt) setTitle(attempt.content);
                    setCreatingAnother(false);
                    setCandidates(null);
                  }}
                >
                  {pendingAttempts.map((attempt) => (
                    <option key={attempt.draftId} value={attempt.draftId}>
                      {attempt.content.slice(0, 60)} ({attempt.draftId.slice(-8)})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <pre aria-label="Attempted task content" tabIndex={0}>
              {pendingAttempt.content}
            </pre>
            <p className="create-task-attempt-locks">
              Locks: {pendingAttempt.lockIds.length ? pendingAttempt.lockIds.join(", ") : "none"}
            </p>
            <div className="create-task-recovery-actions">
              <button type="button" onClick={exportAttempt} disabled={busy}>
                Export attempted content
              </button>
              <button
                type="button"
                onClick={() => void handleRecheck()}
                disabled={!remoteEnabled || busy || creatingAnother}
              >
                {isCheckingCreation ? "Checking..." : "Recheck creation"}
              </button>
              {!creatingAnother && (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingAnother(true);
                    setTitle(pendingAttempt.content);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Create another task
                </button>
              )}
            </div>
            {candidates !== null && (
              <div role="status">
                {candidates.length === 0
                  ? "No matching task was found. This does not prove that the earlier creation failed. You can recheck again or explicitly create another task."
                  : "Matching tasks found. Choose the task you want to use; no task is selected automatically."}
              </div>
            )}
            {candidates?.map((task) => (
              <button
                className="create-task-candidate"
                key={task.id}
                type="button"
                aria-label={`Use task ${task.id}`}
                disabled={!remoteEnabled || busy || creatingAnother}
                onClick={() => void handleAdopt(task.id)}
              >
                Use task: {task.title || task.content} ({task.id})
              </button>
            ))}
            {creatingAnother && (
              <p role="status">
                Creating another task may create a duplicate. The original attempt will remain
                available for recovery.
              </p>
            )}
          </section>
        )}
        {formRecoveryError && (
          <button type="button" className="create-task-retry" onClick={retryFormRecovery}>
            Retry title recovery
          </button>
        )}
        {recoveryReadFailed && (
          <button type="button" className="create-task-retry" onClick={retryRecovery}>
            Retry recovery
          </button>
        )}

        <div className="create-task-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={handleClose}
            disabled={busy}
            data-testid="create-task-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-button"
            onClick={handleSubmit}
            disabled={
              !ownsTitle ||
              !remoteEnabled ||
              busy ||
              unconfirmed ||
              recoveryReadFailed ||
              !title.trim()
            }
            data-testid="create-task-confirm"
          >
            {isCreating
              ? "Creating..."
              : creatingAnother
                ? "Create another task anyway"
                : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
