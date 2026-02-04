import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastItem } from "../components/Toast";

const DEFAULT_DURATION = 5000; // 5 seconds

/**
 * State for toast notifications.
 */
interface ToastState {
  toasts: ToastItem[];
}

/**
 * Return type for useToast hook.
 */
export interface UseToastReturn {
  /** Current list of active toasts */
  toasts: ToastItem[];
  /** Show a success toast */
  showSuccess: (message: string, duration?: number) => string;
  /** Show an error toast */
  showError: (message: string, duration?: number) => string;
  /** Show an info toast */
  showInfo: (message: string, duration?: number) => string;
  /** Dismiss a toast by ID */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
}

/**
 * Hook for managing toast notifications.
 *
 * Provides methods to show success, error, and info toasts with auto-dismiss.
 * Each toast returns a unique ID that can be used to dismiss it programmatically.
 *
 * @param defaultDuration - Default auto-dismiss duration in milliseconds (0 = no auto-dismiss)
 * @returns Toast control methods and current toast list
 *
 * @example
 * ```tsx
 * const { showSuccess, showError, toasts, dismiss } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     showSuccess("Saved successfully!");
 *   } catch (err) {
 *     showError("Failed to save");
 *   }
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleSave}>Save</button>
 *     <ToastContainer toasts={toasts} onDismiss={dismiss} />
 *   </>
 * );
 * ```
 */
export function useToast(defaultDuration: number = DEFAULT_DURATION): UseToastReturn {
  const [state, setState] = useState<ToastState>({ toasts: [] });
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const idCounterRef = useRef(0);

  const clearTimeoutById = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimeoutById(id);
    setState((prev) => ({
      toasts: prev.toasts.filter((t) => t.id !== id),
    }));
  }, [clearTimeoutById]);

  const dismissAll = useCallback(() => {
    // Clear all timeouts
    for (const timeout of timeoutsRef.current.values()) {
      clearTimeout(timeout);
    }
    timeoutsRef.current.clear();
    setState({ toasts: [] });
  }, []);

  const show = useCallback(
    (type: ToastItem["type"], message: string, duration?: number): string => {
      const id = `toast-${Date.now()}-${idCounterRef.current++}`;
      const toastDuration = duration ?? defaultDuration;

      setState((prev) => ({
        toasts: [...prev.toasts, { id, type, message }],
      }));

      // Auto-dismiss after duration (if duration > 0)
      if (toastDuration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, toastDuration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [defaultDuration, dismiss]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number): string => {
      return show("success", message, duration);
    },
    [show]
  );

  const showError = useCallback(
    (message: string, duration?: number): string => {
      return show("error", message, duration);
    },
    [show]
  );

  const showInfo = useCallback(
    (message: string, duration?: number): string => {
      return show("info", message, duration);
    },
    [show]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeoutsMap = timeoutsRef.current;
    return () => {
      for (const timeout of timeoutsMap.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  return {
    toasts: state.toasts,
    showSuccess,
    showError,
    showInfo,
    dismiss,
    dismissAll,
  };
}
