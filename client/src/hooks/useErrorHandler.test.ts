import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useErrorHandler } from "./useErrorHandler";

describe("useErrorHandler", () => {
  it("returns null error initially", () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error).toBeNull();
  });

  it("handles Error objects", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error("Test error"));
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Test error");
  });

  it("handles string errors", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError("String error message");
    });

    expect(result.current.error?.message).toBe("String error message");
  });

  it("handles objects with message property", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError({ message: "Object error" });
    });

    expect(result.current.error?.message).toBe("Object error");
  });

  it("handles unknown errors with default message", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(null);
    });

    expect(result.current.error?.message).toBe("An unexpected error occurred");
  });

  it("categorizes network errors correctly", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new TypeError("Failed to fetch"));
    });

    expect(result.current.error?.type).toBe("network");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("categorizes timeout errors correctly", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      const err = new DOMException("Aborted", "AbortError");
      result.current.handleError(err);
    });

    expect(result.current.error?.type).toBe("timeout");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("categorizes server errors (5xx) correctly", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError({ status: 500, message: "Internal Server Error" });
    });

    expect(result.current.error?.type).toBe("server");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("categorizes client errors (4xx) correctly", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError({ status: 404, message: "Not Found" });
    });

    expect(result.current.error?.type).toBe("client");
    expect(result.current.error?.retryable).toBe(false);
  });

  it("categorizes 408 Request Timeout as timeout error", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError({ status: 408, message: "Request Timeout" });
    });

    expect(result.current.error?.type).toBe("timeout");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("categorizes 429 Too Many Requests as server error", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError({ status: 429, message: "Too Many Requests" });
    });

    expect(result.current.error?.type).toBe("server");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("clears error when clearError is called", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error("Test error"));
    });

    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("sets custom error with setError", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError("Custom error message", "network");
    });

    expect(result.current.error?.message).toBe("Custom error message");
    expect(result.current.error?.type).toBe("network");
    expect(result.current.error?.retryable).toBe(true);
  });

  it("defaults to unknown type when setError type is not provided", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.setError("Some error");
    });

    expect(result.current.error?.type).toBe("unknown");
  });

  it("detects network errors from error message keywords", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error("Network request failed"));
    });

    expect(result.current.error?.type).toBe("network");
  });

  it("detects timeout errors from error message keywords", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError(new Error("Request timed out"));
    });

    expect(result.current.error?.type).toBe("timeout");
  });

  it("preserves original error in ErrorInfo", () => {
    const { result } = renderHook(() => useErrorHandler());
    const originalError = new Error("Original error");

    act(() => {
      result.current.handleError(originalError);
    });

    expect(result.current.error?.originalError).toBe(originalError);
  });

  it("does not preserve original error for non-Error objects", () => {
    const { result } = renderHook(() => useErrorHandler());

    act(() => {
      result.current.handleError("String error");
    });

    expect(result.current.error?.originalError).toBeNull();
  });
});
