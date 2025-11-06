/**
 * Unit tests for useWritingState hook.
 *
 * Tests the writing state machine that detects STUCK state for Muse interventions.
 * State transitions: WRITING → IDLE (5s) → STUCK (60s)
 *
 * Constitutional Compliance:
 * - Article III (TDD): Critical state machine tests (RED phase)
 * - Article V (Documentation): Complete JSDoc for all tests
 *
 * Success Criteria:
 * - SC-002: STUCK detection accuracy ≥95%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWritingState } from "../../src/hooks/useWritingState";

describe("useWritingState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should initialize in WRITING state", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    expect(result.current.state).toBe("WRITING");
  });

  it("should transition to IDLE after 5 seconds of inactivity", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    // Simulate user typing
    act(() => {
      result.current.onInput();
    });
    expect(result.current.state).toBe("WRITING");

    // Wait 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.state).toBe("IDLE");
  });

  it("should transition to STUCK after 60 seconds of inactivity", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    // Simulate user typing
    act(() => {
      result.current.onInput();
    });

    // Wait 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.state).toBe("STUCK");
  });

  it("should call onStuck callback when transitioning to STUCK state", () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "muse", onStuck }));

    // Simulate user typing
    act(() => {
      result.current.onInput();
    });

    // Wait for STUCK threshold (60s)
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(onStuck).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("STUCK");
  });

  it("should return to WRITING when user resumes typing from STUCK", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    // Get to STUCK state
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.state).toBe("STUCK");

    // User starts typing again
    act(() => {
      result.current.onInput();
    });

    expect(result.current.state).toBe("WRITING");
  });

  it("should return to WRITING when user resumes typing from IDLE", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    // Get to IDLE state
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.state).toBe("IDLE");

    // User starts typing again
    act(() => {
      result.current.onInput();
    });

    expect(result.current.state).toBe("WRITING");
  });

  it('should disable state machine when mode is "off"', () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "off", onStuck }));

    // Simulate typing and waiting
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should remain in WRITING, never transition
    expect(result.current.state).toBe("WRITING");
    expect(onStuck).not.toHaveBeenCalled();
  });

  it('should disable state machine when mode is "loki"', () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "loki", onStuck }));

    // Simulate typing and waiting
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Loki mode uses random timer, not STUCK detection
    expect(result.current.state).toBe("WRITING");
    expect(onStuck).not.toHaveBeenCalled();
  });

  it("should reset timer when receiving multiple rapid inputs", () => {
    const { result } = renderHook(() => useWritingState({ mode: "muse" }));

    // Rapid typing simulation
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(4000); // 4s (still in WRITING)
    });
    act(() => {
      result.current.onInput(); // Reset timer
    });
    act(() => {
      vi.advanceTimersByTime(4000); // Another 4s
    });

    // Total 8s elapsed, but timer reset at 4s mark
    // Should be WRITING (not IDLE which requires 5s)
    expect(result.current.state).toBe("WRITING");
  });

  it("should only trigger onStuck once per STUCK transition", () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "muse", onStuck }));

    // Get to STUCK
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onStuck).toHaveBeenCalledTimes(1);

    // Wait more time in STUCK state
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Should not call again while still STUCK
    expect(onStuck).toHaveBeenCalledTimes(1);
  });

  it("should allow re-triggering STUCK after returning to WRITING", () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "muse", onStuck }));

    // First STUCK cycle
    act(() => {
      result.current.onInput();
    });
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onStuck).toHaveBeenCalledTimes(1);

    // Return to WRITING
    act(() => {
      result.current.onInput();
    });

    // Second STUCK cycle
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onStuck).toHaveBeenCalledTimes(2);
  });

  it("should cleanup timers on unmount", () => {
    const { unmount } = renderHook(() => useWritingState({ mode: "muse" }));

    // Start the state machine
    act(() => {
      unmount();
    });

    // Advance time after unmount - should not throw errors
    expect(() => {
      vi.advanceTimersByTime(60000);
    }).not.toThrow();
  });

  it("should expose manual trigger for demo mode", () => {
    const onStuck = vi.fn();
    const { result } = renderHook(() => useWritingState({ mode: "muse", onStuck }));

    // Manual trigger (for Demo button in US4)
    expect(result.current.manualTrigger).toBeDefined();

    act(() => {
      result.current.manualTrigger();
    });

    expect(result.current.state).toBe("STUCK");
    expect(onStuck).toHaveBeenCalledTimes(1);
  });
});
