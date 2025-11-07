import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAudioFeedback } from "./useAudioFeedback";
import { AIActionType } from "../types/ai-actions";

/**
 * Tests for useAudioFeedback hook (User Story 2 - TDD Phase)
 *
 * Verifies audio feedback functionality:
 * - Preloading audio buffers using Web Audio API
 * - Playing correct sounds for each AI action type
 * - Cancel-and-replace behavior for rapid actions
 * - Graceful error handling when AudioContext unavailable
 */

describe("useAudioFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for audio file loading
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    } as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: T035 - Preloads audio buffers on mount
   *
   * Verifies that the hook:
   * - Fetches all 3 audio files on mount (clank.mp3, whoosh.mp3, bonk.mp3)
   * - Decodes audio data using AudioContext
   * - Stores buffers in memory for playback
   */
  it.skip("preloads audio buffers on mount", async () => {
    const { result } = renderHook(() => useAudioFeedback());

    // Wait for async preloading to complete
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    // Verify all 3 audio files were fetched
    expect(fetch).toHaveBeenCalledWith("/assets/audio/clank.mp3");
    expect(fetch).toHaveBeenCalledWith("/assets/audio/whoosh.mp3");
    expect(fetch).toHaveBeenCalledWith("/assets/audio/bonk.mp3");

    // Hook should be in ready state (no errors)
    expect(result.current.isReady).toBe(true);
  });

  /**
   * Test: T036 - Plays Clank audio for PROVOKE action
   *
   * Verifies that calling playAudio with PROVOKE:
   * - Uses the clank.mp3 buffer
   * - Creates AudioBufferSourceNode
   * - Connects to audio destination
   * - Starts playback
   */
  it.skip("plays Clank audio for PROVOKE action", async () => {
    const { result } = renderHook(() => useAudioFeedback());

    // Wait for preloading
    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    // Create spy on AudioContext methods
    const mockSource = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };

    const audioContext = new AudioContext();
    vi.spyOn(audioContext, "createBufferSource").mockReturnValue(
      mockSource as AudioBufferSourceNode
    );

    // Trigger PROVOKE audio
    await result.current.playAudio(AIActionType.PROVOKE);

    // Verify source was created and started
    expect(mockSource.connect).toHaveBeenCalled();
    expect(mockSource.start).toHaveBeenCalled();
  });

  /**
   * Test: T037 - Stops previous audio before playing new sound (FR-019)
   *
   * Verifies cancel-and-replace behavior:
   * - Play PROVOKE audio (Clank)
   * - Immediately play DELETE audio (Whoosh)
   * - Previous audio source should be stopped and disconnected
   * - New audio should start playing
   */
  it.skip("stops previous audio before playing new sound (FR-019)", async () => {
    const { result } = renderHook(() => useAudioFeedback());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const mockSource1 = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockSource2 = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };

    const audioContext = new AudioContext();
    vi.spyOn(audioContext, "createBufferSource")
      .mockReturnValueOnce(mockSource1 as AudioBufferSourceNode)
      .mockReturnValueOnce(mockSource2 as AudioBufferSourceNode);

    // Play first audio (PROVOKE)
    await result.current.playAudio(AIActionType.PROVOKE);
    expect(mockSource1.start).toHaveBeenCalled();

    // Play second audio (DELETE) - should stop first
    await result.current.playAudio(AIActionType.DELETE);

    // Verify first audio was stopped
    expect(mockSource1.stop).toHaveBeenCalled();
    expect(mockSource1.disconnect).toHaveBeenCalled();

    // Verify second audio started
    expect(mockSource2.start).toHaveBeenCalled();
  });

  /**
   * Test: T038 - Handles AudioContext creation failure gracefully (FR-015)
   *
   * Verifies error handling when AudioContext is unavailable:
   * - Hook should not crash
   * - isReady should be false
   * - playAudio should be a no-op (doesn't throw)
   */
  it("handles AudioContext creation failure gracefully (FR-015)", async () => {
    // Temporarily remove AudioContext to simulate unsupported browser
    const originalAudioContext = global.AudioContext;
    (global as unknown as { AudioContext?: typeof AudioContext }).AudioContext = undefined;

    const { result } = renderHook(() => useAudioFeedback());

    // Wait for initialization attempt
    await waitFor(() => {
      expect(result.current.isReady).toBe(false);
    });

    // Verify playAudio doesn't throw
    await expect(result.current.playAudio(AIActionType.PROVOKE)).resolves.not.toThrow();

    // Restore AudioContext
    global.AudioContext = originalAudioContext;
  });
});
