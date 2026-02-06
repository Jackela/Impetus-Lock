import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast } from "./useToast";

describe("useToast Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty toasts array initially", () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it("shows success toast with correct type and message", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("Success message");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toEqual({
      id: expect.stringMatching(/^toast-\d+-0$/),
      type: "success",
      message: "Success message",
    });
  });

  it("shows error toast with correct type and message", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showError("Error message");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: "error",
      message: "Error message",
    });
  });

  it("shows info toast with correct type and message", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showInfo("Info message");
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: "info",
      message: "Info message",
    });
  });

  it("returns unique id for each toast", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("First");
      result.current.showSuccess("Second");
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it("dismisses toast by id", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("First");
      result.current.showSuccess("Second");
    });

    expect(result.current.toasts).toHaveLength(2);

    const idToRemove = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(idToRemove);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Second");
  });

  it("dismisses all toasts", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("First");
      result.current.showError("Second");
      result.current.showInfo("Third");
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.dismissAll();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses toast after default duration", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("Auto-dismiss");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses toast after custom duration", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("Quick toast", 1000);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("does not auto-dismiss when duration is 0", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("Persistent toast", 0);
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it("cancels auto-dismiss when manually dismissed", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showSuccess("Test toast");
    });

    const id = result.current.toasts[0].id;

    // Manually dismiss before auto-dismiss
    act(() => {
      result.current.dismiss(id);
    });

    expect(result.current.toasts).toHaveLength(0);

    // Advance timers past auto-dismiss time
    act(() => {
      vi.runAllTimers();
    });

    // Should still be 0 (no error from trying to remove already removed toast)
    expect(result.current.toasts).toHaveLength(0);
  });

  it("respects custom default duration", () => {
    const { result } = renderHook(() => useToast(2000));

    act(() => {
      result.current.showSuccess("Custom default");
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("returns toast id from show methods", () => {
    const { result } = renderHook(() => useToast());

    let id: string | undefined;

    act(() => {
      id = result.current.showSuccess("Test");
    });

    expect(id).toBeDefined();
    expect(id).toMatch(/^toast-\d+-\d+$/);
    expect(result.current.toasts[0].id).toBe(id);
  });
});
