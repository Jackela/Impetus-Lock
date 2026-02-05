import { useState, useCallback } from "react";

/**
 * Error types that can be handled by the error handler.
 */
export type ErrorType = "network" | "timeout" | "server" | "client" | "unknown";

/**
 * Categorized error information.
 */
export interface ErrorInfo {
  /** The error message */
  message: string;
  /** The type of error */
  type: ErrorType;
  /** Whether the error is retryable */
  retryable: boolean;
  /** The original error object */
  originalError: Error | null;
}

/**
 * Result from the useErrorHandler hook.
 */
export interface ErrorHandlerResult {
  /** Current error info, or null if no error */
  error: ErrorInfo | null;
  /** Clear the current error */
  clearError: () => void;
  /** Handle an error and categorize it */
  handleError: (error: unknown) => void;
  /** Set a custom error message */
  setError: (message: string, type?: ErrorType) => void;
}

/**
 * Categorize an error into a specific error type.
 *
 * @param err - The error to categorize
 * @returns The error type and whether it's retryable
 */
function categorizeError(err: unknown): { type: ErrorType; retryable: boolean } {
  // Network errors (fetch, axios, etc.)
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return { type: "network", retryable: true };
  }

  // AbortError indicates timeout/abort
  if (err instanceof DOMException && err.name === "AbortError") {
    return { type: "timeout", retryable: true };
  }

  // Response with status code (for fetch errors)
  // Only check if err is an object with status property
  if (err && typeof err === "object") {
    const responseErr = err as { status?: number; statusCode?: number };
    const status = responseErr.status !== undefined ? responseErr.status : responseErr.statusCode;

    if (typeof status === "number") {
      // 5xx errors - server errors, retryable
      if (status >= 500) {
        return { type: "server", retryable: true };
      }
      // 4xx errors - client errors, not retryable (except 408, 429)
      if (status >= 400 && status < 500) {
        if (status === 408) {
          return { type: "timeout", retryable: true };
        }
        if (status === 429) {
          return { type: "server", retryable: true };
        }
        return { type: "client", retryable: false };
      }
    }
  }

  // Error objects with messages
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Check for network-related keywords
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("connection")
    ) {
      return { type: "network", retryable: true };
    }

    // Check for timeout-related keywords
    if (message.includes("timeout") || message.includes("timed out") || message.includes("abort")) {
      return { type: "timeout", retryable: true };
    }
  }

  return { type: "unknown", retryable: false };
}

/**
 * Extract a human-readable error message from an error.
 *
 * @param err - The error to extract message from
 * @returns A human-readable error message
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object" && "message" in err) {
    return String(err.message);
  }

  return "An unexpected error occurred";
}

/**
 * Hook for handling errors in a consistent way across the application.
 *
 * Provides error state management and categorization for API and other errors.
 * Automatically categorizes errors into network, timeout, server, client, or unknown types.
 *
 * @example
 * ```tsx
 * const { error, clearError, handleError } = useErrorHandler();
 *
 * try {
 *   await fetchData();
 * } catch (err) {
 *   handleError(err);
 * }
 *
 * return (
 *   <>
 *     {error && (
 *       <div className="error">
 *         {error.message}
 *         <button onClick={clearError}>Dismiss</button>
 *       </div>
 *     )}
 *   </>
 * );
 * ```
 */
export function useErrorHandler(): ErrorHandlerResult {
  const [error, setError] = useState<ErrorInfo | null>(null);

  const handleError = useCallback((err: unknown): void => {
    const message = extractErrorMessage(err);
    const { type, retryable } = categorizeError(err);

    setError({
      message,
      type,
      retryable,
      originalError: err instanceof Error ? err : null,
    });
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const setCustomError = useCallback((message: string, type: ErrorType = "unknown"): void => {
    setError({
      message,
      type,
      retryable: type !== "client",
      originalError: null,
    });
  }, []);

  return {
    error,
    clearError,
    handleError,
    setError: setCustomError,
  };
}
