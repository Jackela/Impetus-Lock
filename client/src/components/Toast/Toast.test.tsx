import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "./Toast";

describe("Toast Component", () => {
  it("renders success toast with correct styling and icon", () => {
    render(<Toast id="test-1" type="success" message="Success message" onDismiss={vi.fn()} />);

    const toast = screen.getByTestId("toast-test-1");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("toast", "toast-success");

    const icon = screen.getByText("✓");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("toast-icon");
  });

  it("renders error toast with correct styling and icon", () => {
    render(<Toast id="test-2" type="error" message="Error message" onDismiss={vi.fn()} />);

    const toast = screen.getByTestId("toast-test-2");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("toast", "toast-error");

    const icon = toast.querySelector(".toast-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent("✕");
  });

  it("renders info toast with correct styling and icon", () => {
    render(<Toast id="test-3" type="info" message="Info message" onDismiss={vi.fn()} />);

    const toast = screen.getByTestId("toast-test-3");
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveClass("toast", "toast-info");

    const icon = screen.getByText("ℹ");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("toast-icon");
  });

  it("displays the message correctly", () => {
    render(<Toast id="test-4" type="info" message="Test message content" onDismiss={vi.fn()} />);

    const message = screen.getByText("Test message content");
    expect(message).toBeInTheDocument();
    expect(message).toHaveClass("toast-message");
  });

  it("calls onDismiss when close button is clicked", () => {
    const onDismiss = vi.fn();
    render(<Toast id="test-5" type="info" message="Test message" onDismiss={onDismiss} />);

    const closeButton = screen.getByTestId("toast-close-test-5");
    closeButton.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith("test-5");
  });

  it("has correct ARIA attributes for success toast", () => {
    render(<Toast id="test-6" type="success" message="Success" onDismiss={vi.fn()} />);

    const toast = screen.getByTestId("toast-test-6");
    expect(toast).toHaveAttribute("role", "status");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("has correct ARIA attributes for error toast", () => {
    render(<Toast id="test-7" type="error" message="Error" onDismiss={vi.fn()} />);

    const toast = screen.getByTestId("toast-test-7");
    expect(toast).toHaveAttribute("role", "alert");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("close button has correct accessibility label", () => {
    render(<Toast id="test-8" type="info" message="Test" onDismiss={vi.fn()} />);

    const closeButton = screen.getByLabelText("Dismiss notification");
    expect(closeButton).toBeInTheDocument();
  });
});
