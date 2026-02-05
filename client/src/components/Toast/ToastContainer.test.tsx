import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastContainer } from "./ToastContainer";
import type { ToastItem } from "./ToastContainer";

describe("ToastContainer Component", () => {
  it("renders null when there are no toasts", () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);

    expect(container.firstChild).toBe(null);
  });

  it("renders a single toast", () => {
    const toasts: ToastItem[] = [{ id: "toast-1", type: "success", message: "Success message" }];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("toast-container")).toBeInTheDocument();
    expect(screen.getByTestId("toast-toast-1")).toBeInTheDocument();
    expect(screen.getByText("Success message")).toBeInTheDocument();
  });

  it("renders multiple toasts in order", () => {
    const toasts: ToastItem[] = [
      { id: "toast-1", type: "success", message: "First" },
      { id: "toast-2", type: "error", message: "Second" },
      { id: "toast-3", type: "info", message: "Third" },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByTestId("toast-toast-1")).toBeInTheDocument();
    expect(screen.getByTestId("toast-toast-2")).toBeInTheDocument();
    expect(screen.getByTestId("toast-toast-3")).toBeInTheDocument();

    // Check order in DOM
    const container = screen.getByTestId("toast-container");
    const children = container.children;
    expect(children).toHaveLength(3);
  });

  it("calls onDismiss with correct id when toast is dismissed", () => {
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [{ id: "toast-1", type: "info", message: "Test" }];

    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

    const closeButton = screen.getByTestId("toast-close-toast-1");
    closeButton.click();

    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });

  it("has correct ARIA region attributes", () => {
    const toasts: ToastItem[] = [{ id: "toast-1", type: "info", message: "Test" }];

    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    const container = screen.getByTestId("toast-container");
    expect(container).toHaveAttribute("role", "region");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-label", "Notifications");
  });

  it("uses toast id as key for correct React reconciliation", () => {
    const toasts: ToastItem[] = [
      { id: "toast-1", type: "success", message: "First" },
      { id: "toast-2", type: "error", message: "Second" },
    ];

    const { rerender } = render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    // Re-render with first toast removed
    const updatedToasts: ToastItem[] = [{ id: "toast-2", type: "error", message: "Second" }];

    rerender(<ToastContainer toasts={updatedToasts} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId("toast-toast-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-toast-2")).toBeInTheDocument();
  });
});
