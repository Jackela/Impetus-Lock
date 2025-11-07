import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAnimationController } from "./useAnimationController";
import { AIActionType } from "../types/ai-actions";

/**
 * Tests for useAnimationController hook (User Story 2 - TDD Phase)
 *
 * Verifies animation control functionality:
 * - Generating unique keys for cancel-and-replace behavior
 * - Providing correct Framer Motion variants for each action type
 * - Respecting prefers-reduced-motion user preference
 * - Handling action type changes (cancel previous animation)
 */

describe("useAnimationController", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset matchMedia to default (no reduced motion)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    // Restore original matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
  });

  /**
   * Test: T040 - Generates unique key for each action type
   *
   * Verifies that the hook returns a unique animation key that:
   * - Changes when action type changes
   * - Remains stable for the same action type
   * - Enables Framer Motion's cancel-and-replace via AnimatePresence
   */
  it("generates unique key for each action type", () => {
    const { result, rerender } = renderHook(
      ({ actionType }) => useAnimationController(actionType),
      { initialProps: { actionType: AIActionType.PROVOKE } }
    );

    const firstKey = result.current.animationKey;
    expect(firstKey).toContain("provoke");

    // Change action type to DELETE
    rerender({ actionType: AIActionType.DELETE });
    const secondKey = result.current.animationKey;

    // Key should change
    expect(secondKey).not.toBe(firstKey);
    expect(secondKey).toContain("delete");

    // Change back to PROVOKE
    rerender({ actionType: AIActionType.PROVOKE });
    const thirdKey = result.current.animationKey;

    // Key should change again (includes timestamp or counter)
    expect(thirdKey).not.toBe(firstKey);
    expect(thirdKey).toContain("provoke");
  });

  /**
   * Test: T041 - Returns Glitch variants for PROVOKE
   *
   * Verifies that PROVOKE action returns Glitch animation variants:
   * - Opacity keyframes: [1, 0.5, 1, 0.3, 1, 0]
   * - Duration: 1.5 seconds (FR-007)
   * - Easing: linear (for digital glitch effect)
   */
  it("returns Glitch variants for PROVOKE", () => {
    const { result } = renderHook(() => useAnimationController(AIActionType.PROVOKE));

    const variants = result.current.variants;

    // Verify Glitch animation properties
    expect(variants.animate).toBeDefined();
    expect(variants.animate.opacity).toEqual([1, 0.5, 1, 0.3, 1, 0]);
    expect(variants.animate.transition.duration).toBe(1.5);
    expect(variants.animate.transition.ease).toBe("linear");
  });

  /**
   * Test: T042 - Returns Fade-out variants for DELETE
   *
   * Verifies that DELETE action returns Fade-out animation variants:
   * - Final opacity: 0
   * - Duration: 0.75 seconds (FR-011)
   * - Easing: easeOut (smooth fade)
   */
  it("returns Fade-out variants for DELETE", () => {
    const { result } = renderHook(() => useAnimationController(AIActionType.DELETE));

    const variants = result.current.variants;

    // Verify Fade-out animation properties
    expect(variants.animate).toBeDefined();
    expect(variants.animate.opacity).toBe(0);
    expect(variants.animate.transition.duration).toBe(0.75);
    expect(variants.animate.transition.ease).toBe("easeOut");
  });

  /**
   * Test: T043 - Uses reduced-motion variants when prefers-reduced-motion is set
   *
   * Verifies accessibility support for users with motion sensitivity:
   * - Detects prefers-reduced-motion media query
   * - Returns simplified animation variants (opacity change only)
   * - No complex glitch/shake effects
   */
  it("uses reduced-motion variants when prefers-reduced-motion is set", () => {
    // Mock matchMedia to return prefers-reduced-motion: true
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { result } = renderHook(() => useAnimationController(AIActionType.PROVOKE));

    const variants = result.current.variants;

    // Reduced-motion variant should be simple opacity change
    expect(variants.animate.opacity).toBeDefined();
    expect(variants.animate.transition.duration).toBeLessThanOrEqual(0.3);

    // No complex keyframes for reduced-motion
    expect(Array.isArray(variants.animate.opacity)).toBe(false);
  });

  /**
   * Test: T044 - Changes key when action type changes (cancel-and-replace)
   *
   * Verifies that changing action type:
   * - Generates new animation key
   * - Triggers AnimatePresence to unmount previous animation
   * - Mounts new animation with different variants
   */
  it("changes key when action type changes (cancel-and-replace)", () => {
    const { result, rerender } = renderHook(
      ({ actionType }) => useAnimationController(actionType),
      { initialProps: { actionType: AIActionType.PROVOKE } }
    );

    const provokeKey = result.current.animationKey;
    const provokeVariants = result.current.variants;

    // Verify PROVOKE animation (Glitch)
    expect(provokeVariants.animate.opacity).toEqual([1, 0.5, 1, 0.3, 1, 0]);

    // Change to DELETE
    rerender({ actionType: AIActionType.DELETE });

    const deleteKey = result.current.animationKey;
    const deleteVariants = result.current.variants;

    // Key should change (triggers cancel-and-replace)
    expect(deleteKey).not.toBe(provokeKey);

    // Variants should change to Fade-out
    expect(deleteVariants.animate.opacity).toBe(0);
    expect(deleteVariants.animate.transition.duration).toBe(0.75);
  });
});
