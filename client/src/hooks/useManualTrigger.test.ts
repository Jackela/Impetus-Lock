import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useManualTrigger } from "./useManualTrigger";

// Mock the intervention client
vi.mock("../services/api/interventionClient", () => ({
  triggerMuseIntervention: vi.fn(),
}));

import { triggerMuseIntervention } from "../services/api/interventionClient";

describe("useManualTrigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls triggerProvoke API on trigger()", async () => {
    const mockProvoke = vi.mocked(triggerMuseIntervention).mockResolvedValue(undefined);

    const { result } = renderHook(() => useManualTrigger());

    await result.current.trigger();

    expect(mockProvoke).toHaveBeenCalledOnce();
  });

  it("sets isLoading to true during API call", async () => {
    vi.mocked(triggerMuseIntervention).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    const { result } = renderHook(() => useManualTrigger());

    expect(result.current.isLoading).toBe(false);

    const promise = result.current.trigger();

    // Should be loading immediately after trigger
    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await promise;

    // Should stop loading after completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("debounces calls (2-second cooldown)", async () => {
    vi.useFakeTimers();
    const mockProvoke = vi.mocked(triggerMuseIntervention).mockResolvedValue(undefined);

    const { result } = renderHook(() => useManualTrigger());

    // First call - should execute
    await result.current.trigger();
    expect(mockProvoke).toHaveBeenCalledTimes(1);

    // Second call immediately - should be ignored (within cooldown)
    await result.current.trigger();
    expect(mockProvoke).toHaveBeenCalledTimes(1); // Still 1

    // Advance time by 2 seconds
    vi.advanceTimersByTime(2000);

    // Third call after cooldown - should execute
    await result.current.trigger();
    expect(mockProvoke).toHaveBeenCalledTimes(2); // Now 2
  });
});
