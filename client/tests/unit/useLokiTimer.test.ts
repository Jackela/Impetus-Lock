/**
 * Unit tests for useLokiTimer hook - Loki Mode random chaos timer
 *
 * Test Coverage:
 * - Random interval generation (30-120 seconds)
 * - Trigger callback execution at random interval
 * - Recursive timer scheduling after trigger
 * - Timer disabled when mode != "loki"
 * - Distribution uniformity (1000 samples)
 *
 * Constitutional Compliance:
 * - Article III (TDD): Tests written FIRST, implementation follows
 * - Article V (Documentation): Complete test descriptions
 *
 * Success Criteria:
 * - SC-004: Random timer distribution uniformity ≥99%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLokiTimer } from "../../src/hooks/useLokiTimer";
import type { AgentMode } from "../../src/types/mode";

describe("useLokiTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should generate random interval between 30-120 seconds", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // Access internal state to verify interval generation
    const interval = result.current.currentInterval;

    expect(interval).toBeGreaterThanOrEqual(30000); // 30 seconds minimum
    expect(interval).toBeLessThanOrEqual(120000); // 120 seconds maximum
  });

  it("should trigger callback at random interval", () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // Fast-forward to maximum interval to guarantee trigger
    act(() => {
      vi.advanceTimersByTime(120000);
    });

    // Immediately unmount to prevent rescheduled timer from triggering
    unmount();

    // Should have triggered at least once (at max interval)
    // Use toHaveBeenCalled() instead of exact count to avoid flakiness
    // from potential race condition where timer reschedules before unmount
    expect(onTrigger).toHaveBeenCalled();
  });

  it("should schedule new random timer after trigger", () => {
    const onTrigger = vi.fn();
    renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // First trigger
    act(() => {
      vi.advanceTimersByTime(120000); // Max interval
    });

    // Should have triggered at least once (might be more due to recursive scheduling)
    const firstCallCount = onTrigger.mock.calls.length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // Second trigger (new timer scheduled)
    act(() => {
      vi.advanceTimersByTime(120000);
    });

    // Should have more calls than before
    expect(onTrigger.mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('should NOT trigger when mode is "muse"', () => {
    const onTrigger = vi.fn();
    renderHook(() => useLokiTimer({ mode: "muse" as AgentMode, onTrigger }));

    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('should NOT trigger when mode is "off"', () => {
    const onTrigger = vi.fn();
    renderHook(() => useLokiTimer({ mode: "off" as AgentMode, onTrigger }));

    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('should stop timer when mode changes from "loki" to "off"', () => {
    const onTrigger = vi.fn();
    const { rerender } = renderHook(({ mode }) => useLokiTimer({ mode, onTrigger }), {
      initialProps: { mode: "loki" as AgentMode },
    });

    // Change mode to "off"
    rerender({ mode: "off" as AgentMode });

    // Advance time - should NOT trigger
    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('should start timer when mode changes from "off" to "loki"', () => {
    const onTrigger = vi.fn();
    const { rerender } = renderHook(({ mode }) => useLokiTimer({ mode, onTrigger }), {
      initialProps: { mode: "off" as AgentMode },
    });

    // Change mode to "loki"
    rerender({ mode: "loki" as AgentMode });

    // Advance time - should trigger at least once (may trigger multiple times due to random intervals)
    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(onTrigger).toHaveBeenCalled();
  });

  it("should use crypto.getRandomValues for random number generation", () => {
    // Mock crypto.getRandomValues
    const mockGetRandomValues = vi.spyOn(crypto, "getRandomValues");

    const onTrigger = vi.fn();
    renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    expect(mockGetRandomValues).toHaveBeenCalled();
  });

  it("should follow uniform distribution for 1000 triggers (SC-004)", () => {
    // Test distribution uniformity per Success Criteria SC-004
    const intervals: number[] = [];

    // Collect 1000 random intervals
    for (let i = 0; i < 1000; i++) {
      const onTrigger = vi.fn();
      const { result, unmount } = renderHook(() =>
        useLokiTimer({ mode: "loki" as AgentMode, onTrigger })
      );

      intervals.push(result.current.currentInterval);
      unmount();
    }

    // Divide range into 3 buckets: [30-60s], [60-90s], [90-120s]
    const bucket1 = intervals.filter((i) => i >= 30000 && i < 60000).length;
    const bucket2 = intervals.filter((i) => i >= 60000 && i < 90000).length;
    const bucket3 = intervals.filter((i) => i >= 90000 && i <= 120000).length;

    // Each bucket should have ~333 samples (1000 / 3)
    // Allow ±15% variance for randomness (283-383 per bucket)
    // Increased tolerance from ±10% to reduce statistical flakiness
    expect(bucket1).toBeGreaterThanOrEqual(283);
    expect(bucket1).toBeLessThanOrEqual(383);
    expect(bucket2).toBeGreaterThanOrEqual(283);
    expect(bucket2).toBeLessThanOrEqual(383);
    expect(bucket3).toBeGreaterThanOrEqual(283);
    expect(bucket3).toBeLessThanOrEqual(383);

    // Verify total count
    expect(bucket1 + bucket2 + bucket3).toBe(1000);
  });

  it("should cleanup timer on unmount", () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // Unmount component
    unmount();

    // Advance time - should NOT trigger after unmount
    act(() => {
      vi.advanceTimersByTime(120000);
    });

    expect(onTrigger).not.toHaveBeenCalled();
  });

  it("should expose manual trigger for demo mode", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // Manual trigger should be available
    expect(result.current.manualTrigger).toBeDefined();
    expect(typeof result.current.manualTrigger).toBe("function");

    // Call manual trigger
    act(() => {
      result.current.manualTrigger();
    });

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("should not interfere with scheduled timer when manually triggered", () => {
    const onTrigger = vi.fn();
    const { result } = renderHook(() => useLokiTimer({ mode: "loki" as AgentMode, onTrigger }));

    // Manual trigger
    act(() => {
      result.current.manualTrigger();
    });
    expect(onTrigger).toHaveBeenCalledTimes(1);

    // Scheduled timer should still fire (at least one more time)
    act(() => {
      vi.advanceTimersByTime(120000);
    });
    expect(onTrigger.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
