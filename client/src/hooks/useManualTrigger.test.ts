import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useManualTrigger } from "./useManualTrigger";

describe("useManualTrigger", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles loading state for the cooldown window", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useManualTrigger());

    let triggerPromise: Promise<void> | undefined;
    await act(async () => {
      triggerPromise = result.current.trigger();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await triggerPromise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores additional triggers during cooldown", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useManualTrigger());

    let activePromise: Promise<void> | undefined;
    await act(async () => {
      activePromise = result.current.trigger();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      const suppressed = result.current.trigger();
      await suppressed;
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await activePromise;
    });
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      activePromise = result.current.trigger();
    });
    expect(result.current.isLoading).toBe(true);
  });
});
