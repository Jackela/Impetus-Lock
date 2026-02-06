import type { FC } from "react";

/**
 * Toast notification types.
 */
export type ToastType = "success" | "error" | "info";

/**
 * Props for the Toast component.
 */
export interface ToastProps {
  /** Unique identifier for the toast */
  id: string;
  /** Type of toast notification */
  type: ToastType;
  /** Message to display */
  message: string;
  /** Optional duration in milliseconds (0 = no auto-close) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss: (id: string) => void;
}

/**
 * Toast notification component for displaying transient messages.
 *
 * Shows success, error, or info messages with auto-dismiss capability.
 * Supports accessibility with ARIA live regions.
 *
 * @example
 * ```tsx
 * <Toast
 *   id="toast-1"
 *   type="success"
 *   message="Task created successfully"
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */
export const Toast: FC<ToastProps> = ({ id, type, message, onDismiss }) => {
  const handleClick = () => {
    onDismiss(id);
  };

  const getIcon = (): string => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "info":
        return "ℹ";
      default:
        return "";
    }
  };

  const getAriaRole = (): string => {
    return type === "error" ? "alert" : "status";
  };

  return (
    <div
      className={`toast toast-${type}`}
      role={getAriaRole()}
      aria-live="polite"
      data-testid={`toast-${id}`}
    >
      <span className="toast-icon" aria-hidden="true">
        {getIcon()}
      </span>
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={handleClick}
        aria-label="Dismiss notification"
        data-testid={`toast-close-${id}`}
      >
        ✕
      </button>
    </div>
  );
};
