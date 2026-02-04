import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// A component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for expected error logs
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Child component")).toBeInTheDocument();
  });

  it("catches errors and displays fallback UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays error details when an error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error details")).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls onError callback when an error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.stringContaining("ThrowError"),
      })
    );
  });

  it("resets error state when reset button is clicked", () => {
    // Use a stateful component that can stop throwing after reset
    let shouldThrowValue = true;
    function StatefulThrowError() {
      if (shouldThrowValue) {
        throw new Error("Test error");
      }
      return <div>No error</div>;
    }

    const setErrorState = () => {
      shouldThrowValue = false;
    };

    const TestWrapper = () => (
      <ErrorBoundary>
        <StatefulThrowError key={shouldThrowValue ? "error" : "ok"} />
      </ErrorBoundary>
    );

    render(<TestWrapper />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Click reset button and clear error state
    const resetButton = screen.getByText("Try again");
    act(() => {
      setErrorState();
      resetButton.click();
    });

    // After reset and error cleared, the alert should be gone
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has proper ARIA attributes for accessibility", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
