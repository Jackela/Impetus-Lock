/**
 * Error types for Impetus Lock application.
 *
 * Provides structured error types for consistent error handling
 * across the application.
 *
 * @module types/errors
 */

/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export class AppError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;

  /** HTTP status code (if applicable) */
  readonly statusCode?: number;

  /** Additional error context */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;

    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Error for API-related failures.
 */
export class APIError extends AppError {
  constructor(message: string, statusCode: number, context?: Record<string, unknown>) {
    super(message, "API_ERROR", statusCode, context);
    this.name = "APIError";
  }
}

/**
 * Error for network-related failures.
 */
export class NetworkError extends AppError {
  constructor(message: string = "Network request failed", context?: Record<string, unknown>) {
    super(message, "NETWORK_ERROR", 0, context);
    this.name = "NetworkError";
  }
}

/**
 * Error for validation failures.
 */
export class ValidationError extends AppError {
  /** Field-specific validation errors */
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    fieldErrors?: Record<string, string>,
    context?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", 422, context);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Error for editor-related failures.
 */
export class EditorError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "EDITOR_ERROR", undefined, context);
    this.name = "EditorError";
  }
}

/**
 * Error for lock-related failures.
 */
export class LockError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "LOCK_ERROR", undefined, context);
    this.name = "LockError";
  }
}

/**
 * Type guard to check if error is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is an APIError.
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Extract error message from unknown error type.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * Extract error code from unknown error type.
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}
