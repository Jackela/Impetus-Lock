/**
 * useLokiTimer Hook Tests
 *
 * Test suite for Loki mode random chaos timer.
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written before implementation verification
 * - Article V (Documentation): Test names describe behavior
 *
 * @module hooks/useLokiTimer.test
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLokiTimer } from "./useLokiTimer";

describe("useLokiTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock crypto.getRandomValues for deterministic tests
    // Returns value that produces ~75s interval (middle of 30-120s range)
    vi.stubGlobal("crypto", {
      getRandomValues: (buffer: Uint32Array) => {
        buffer[0] = 0x7fffffff; // ~50% of max, yields ~75s
        return buffer;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts timer when mode is 'loki'", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

    // Timer should be scheduled with non-zero interval
    expect(result.current.currentInterval).toBeGreaterThan(0);
    expect(result.current.currentInterval).toBeGreaterThanOrEqual(30000);
    expect(result.current.currentInterval).toBeLessThanOrEqual(120000);
  });

  it("does not start timer when mode is not 'loki'", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "muse", onTrigger }));

    // Timer should not be scheduled
    expect(result.current.currentInterval).toBe(0);
  });

  it("stops timer when mode changes from 'loki'", () => {
    const onTrigger = vi.fn();
    const { result, rerender } = renderHook(({ mode }) => useLokiTimer({ mode, onTrigger }), {
      initialProps: { mode: "loki" as const },
    });

    // Timer should be active
    expect(result.current.currentInterval).toBeGreaterThan(0);

    // Change mode to 'off'
    rerender({ mode: "off" as const });

    // Timer should stop
    expect(result.current.currentInterval).toBe(0);
  });

  it("generates random interval within bounds (30s-120s)", () => {
    const onTrigger = vi.fn();

    // Test with different random values
    const testValues = [0x00000000, 0x7fffffff, 0xffffffff];
    const intervals: number[] = [];

    testValues.forEach((randomValue) => {
      vi.stubGlobal("crypto", {
        getRandomValues: (buffer: Uint32Array) => {
          buffer[0] = randomValue;
          return buffer;
        },
      });

      const { result, unmount } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

      intervals.push(result.current.currentInterval);
      unmount();
    });

    // All intervals should be within bounds
    intervals.forEach((interval) => {
      expect(interval).toBeGreaterThanOrEqual(30000);
      expect(interval).toBeLessThanOrEqual(120000);
    });
  });

  it("fires onTrigger callback when timer expires", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

    const interval = result.current.currentInterval;
    expect(onTrigger).not.toHaveBeenCalled();

    // Advance time to just before trigger
    act(() => {
      vi.advanceTimersByTime(interval - 1);
    });
    expect(onTrigger).not.toHaveBeenCalled();

    // Advance past trigger point
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("reschedules timer after each trigger", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

    const firstInterval = result.current.currentInterval;

    // Trigger first timer
    act(() => {
      vi.advanceTimersByTime(firstInterval);
    });
    expect(onTrigger).toHaveBeenCalledTimes(1);

    // New interval should be scheduled
    const secondInterval = result.current.currentInterval;
    expect(secondInterval).toBeGreaterThanOrEqual(30000);
    expect(secondInterval).toBeLessThanOrEqual(120000);

    // Trigger second timer
    act(() => {
      vi.advanceTimersByTime(secondInterval);
    });
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it("manualTrigger fires callback immediately without affecting scheduled timer", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

    const scheduledInterval = result.current.currentInterval;

    // Manual trigger should fire immediately
    act(() => {
      result.current.manualTrigger();
    });
    expect(onTrigger).toHaveBeenCalledTimes(1);

    // Scheduled timer should still fire at its time
    act(() => {
      vi.advanceTimersByTime(scheduledInterval);
    });
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it("cleans up timer on unmount", () => {
    const onTrigger = vi.fn();
    const { result, unmount } = renderHook(() => useLokiTimer({ mode: "loki", onTrigger }));

    const interval = result.current.currentInterval;

    // Unmount before timer fires
    unmount();

    // Advance time past when timer would have fired
    act(() => {
      vi.advanceTimersByTime(interval + 1000);
    });

    // Callback should not have been called
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("handles mode switching correctly", () => {
    const onTrigger = vi.fn();
    const { result, rerender } = renderHook(({ mode }) => useLokiTimer({ mode, onTrigger }), {
      initialProps: { mode: "off" as const },
    });

    // Initially off
    expect(result.current.currentInterval).toBe(0);

    // Switch to loki
    rerender({ mode: "loki" as const });
    expect(result.current.currentInterval).toBeGreaterThan(0);

    // Switch to muse
    rerender({ mode: "muse" as const });
    expect(result.current.currentInterval).toBe(0);

    // Switch back to loki
    rerender({ mode: "loki" as const });
    expect(result.current.currentInterval).toBeGreaterThan(0);
  });
});
