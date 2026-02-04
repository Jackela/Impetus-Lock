import type { FC } from "react";
import { Toast, type ToastProps } from "./Toast";

export interface ToastItem {
  id: string;
  type: ToastProps["type"];
  message: string;
}

/**
 * Props for the ToastContainer component.
 */
export interface ToastContainerProps {
  /** Array of toast items to display */
  toasts: ToastItem[];
  /** Callback when a toast is dismissed */
  onDismiss: (id: string) => void;
}

/**
 * Container for toast notifications positioned in top-right corner.
 *
 * Manages the layout and animation of multiple toast notifications.
 * Toasts stack vertically with spacing between them.
 *
 * @example
 * ```tsx
 * <ToastContainer
 *   toasts={[{ id: '1', type: 'success', message: 'Done!' }]}
 *   onDismiss={(id) => removeToast(id)}
 * />
 * ```
 */
export const ToastContainer: FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="toast-container"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};
