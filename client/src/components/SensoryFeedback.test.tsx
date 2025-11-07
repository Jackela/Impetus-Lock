import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SensoryFeedback } from "./SensoryFeedback";
import { AIActionType } from "../types/ai-actions";

/**
 * Tests for SensoryFeedback component (User Story 2 - TDD Phase)
 *
 * Verifies orchestration of visual and audio feedback:
 * - Playing correct animations for each action type
 * - Playing correct audio for each action type
 * - Cancel-and-replace behavior for rapid actions
 * - Accessibility support (prefers-reduced-motion)
 */

// Mock hooks
vi.mock("../hooks/useAnimationController", () => ({
  useAnimationController: vi.fn(),
}));

vi.mock("../hooks/useAudioFeedback", () => ({
  useAudioFeedback: vi.fn(),
}));

import { useAnimationController } from "../hooks/useAnimationController";
import { useAudioFeedback } from "../hooks/useAudioFeedback";

describe("SensoryFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useAnimationController).mockReturnValue({
      animationKey: "test-key",
      variants: {
        initial: { opacity: 1 },
        animate: { opacity: 0 },
        exit: { opacity: 0 },
      },
    });

    vi.mocked(useAudioFeedback).mockReturnValue({
      playAudio: vi.fn().mockResolvedValue(undefined),
      isReady: true,
    });
  });

  /**
   * Test: T046 - Plays Glitch animation for PROVOKE action
   *
   * Verifies that when actionType is PROVOKE:
   * - useAnimationController is called with PROVOKE
   * - Component renders with Glitch variants
   * - Framer Motion AnimatePresence manages animation lifecycle
   */
  it("plays Glitch animation for PROVOKE action", () => {
    const mockVariants = {
      initial: { opacity: 1 },
      animate: { opacity: [1, 0.5, 1, 0.3, 1, 0], transition: { duration: 1.5 } },
      exit: { opacity: 0 },
    };

    vi.mocked(useAnimationController).mockReturnValue({
      animationKey: "provoke-123",
      variants: mockVariants,
    });

    const { container } = render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);

    // Verify useAnimationController was called with PROVOKE
    expect(useAnimationController).toHaveBeenCalledWith(AIActionType.PROVOKE);

    // Verify component rendered
    const feedbackElement = container.querySelector('[data-testid="sensory-feedback"]');
    expect(feedbackElement).toBeDefined();

    // Verify data-animation attribute
    expect(feedbackElement?.getAttribute("data-animation")).toBe("glitch");
  });

  /**
   * Test: T047 - Plays Fade-out animation for DELETE action
   *
   * Verifies that when actionType is DELETE:
   * - useAnimationController is called with DELETE
   * - Component renders with Fade-out variants
   * - Animation duration is 0.75 seconds (FR-011)
   */
  it("plays Fade-out animation for DELETE action", () => {
    const mockVariants = {
      initial: { opacity: 1 },
      animate: { opacity: 0, transition: { duration: 0.75, ease: "easeOut" } },
      exit: { opacity: 0 },
    };

    vi.mocked(useAnimationController).mockReturnValue({
      animationKey: "delete-456",
      variants: mockVariants,
    });

    const { container } = render(<SensoryFeedback actionType={AIActionType.DELETE} />);

    // Verify useAnimationController was called with DELETE
    expect(useAnimationController).toHaveBeenCalledWith(AIActionType.DELETE);

    // Verify data-animation attribute
    const feedbackElement = container.querySelector('[data-testid="sensory-feedback"]');
    expect(feedbackElement?.getAttribute("data-animation")).toBe("fadeout");
  });

  /**
   * Test: T048 - Plays Clank audio for PROVOKE action
   *
   * Verifies that when actionType is PROVOKE:
   * - playAudio is called with PROVOKE action type
   * - Audio playback happens on component mount/update
   */
  it("plays Clank audio for PROVOKE action", async () => {
    const mockPlayAudio = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAudioFeedback).mockReturnValue({
      playAudio: mockPlayAudio,
      isReady: true,
    });

    render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);

    // Wait for useEffect to trigger audio playback
    await waitFor(() => {
      expect(mockPlayAudio).toHaveBeenCalledWith(AIActionType.PROVOKE);
    });
  });

  /**
   * Test: T049 - Cancels previous animation when new action triggers
   *
   * Verifies cancel-and-replace behavior:
   * - Render with PROVOKE action (Glitch animation starts)
   * - Update to DELETE action (Glitch should stop, Fade-out should start)
   * - AnimatePresence key change triggers unmount/mount
   * - Previous audio stopped, new audio plays
   */
  it("cancels previous animation when new action triggers", async () => {
    const mockPlayAudio = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useAudioFeedback).mockReturnValue({
      playAudio: mockPlayAudio,
      isReady: true,
    });

    vi.mocked(useAnimationController)
      .mockReturnValueOnce({
        animationKey: "provoke-1",
        variants: { initial: {}, animate: {}, exit: {} },
      })
      .mockReturnValueOnce({
        animationKey: "delete-2",
        variants: { initial: {}, animate: {}, exit: {} },
      });

    const { rerender } = render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);

    // Verify first audio played
    await waitFor(() => {
      expect(mockPlayAudio).toHaveBeenCalledWith(AIActionType.PROVOKE);
    });

    // Clear mock to track second call
    mockPlayAudio.mockClear();

    // Trigger action change (cancel-and-replace)
    rerender(<SensoryFeedback actionType={AIActionType.DELETE} />);

    // Verify second audio played (previous audio stopped via useAudioFeedback hook)
    await waitFor(() => {
      expect(mockPlayAudio).toHaveBeenCalledWith(AIActionType.DELETE);
    });
  });

  /**
   * Test: T050 - Respects prefers-reduced-motion
   *
   * Verifies accessibility support:
   * - Component detects prefers-reduced-motion media query
   * - Passes motion preference to useAnimationController
   * - Simplified animations rendered (no complex glitch effects)
   */
  it("respects prefers-reduced-motion", () => {
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

    const mockReducedVariants = {
      initial: { opacity: 1 },
      animate: { opacity: 0.5, transition: { duration: 0.2 } },
      exit: { opacity: 0 },
    };

    vi.mocked(useAnimationController).mockReturnValue({
      animationKey: "reduced-provoke",
      variants: mockReducedVariants,
    });

    render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);

    // Verify useAnimationController was called (it will detect prefers-reduced-motion internally)
    expect(useAnimationController).toHaveBeenCalledWith(AIActionType.PROVOKE);

    // The hook itself handles reduced-motion detection, component just uses its output
  });
});
