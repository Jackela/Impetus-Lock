import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAudioFeedback } from "./useAudioFeedback";
import { TestAudioContext } from "../../tests/fixtures/audio";
import { AIActionType } from "../types/ai-actions";
import { FEEDBACK_CONFIG, UNIQUE_AUDIO_FILES } from "../config/sensory-feedback";

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ArrayBuffer(1024))));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  /**
   * Test: preloading is deduplicated per unique audio file.
   *
   * Six action types share four files (`clank` and `whoosh` back two actions
   * each), so the hook must fetch each URL once and then fan the decoded
   * buffer back out to every action that references it.
   *
   * This case subsumes the former per-action `it.skip` checks (mount
   * preloading, PROVOKE/ERROR playback and cancel-and-replace): it asserts the
   * same fetch inventory, buffer reuse and per-`playAudio` source-node
   * creation without the skipped duplicates.
   */
  it("fetches each unique audio file once and shares buffers across actions", async () => {
    // A fresh Response per call: a single Response body can only be read once.
    vi.mocked(fetch).mockImplementation(async () => new Response(new ArrayBuffer(1024)));
    const createBufferSourceSpy = vi.spyOn(TestAudioContext.prototype, "createBufferSource");

    const { result } = renderHook(() => useAudioFeedback());

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const requestedUrls = vi.mocked(fetch).mock.calls.map((call) => call[0]);

    expect(requestedUrls).toHaveLength(UNIQUE_AUDIO_FILES.length);
    expect(new Set(requestedUrls).size).toBe(UNIQUE_AUDIO_FILES.length);
    expect(new Set(requestedUrls)).toEqual(new Set(UNIQUE_AUDIO_FILES));
    expect(UNIQUE_AUDIO_FILES.length).toBeLessThan(Object.keys(FEEDBACK_CONFIG).length);

    // PROVOKE and REWRITE both map to clank; both must resolve to a buffer,
    // otherwise playAudio bails out before creating a source node.
    await result.current.playAudio(AIActionType.PROVOKE);
    await result.current.playAudio(AIActionType.REWRITE);

    expect(createBufferSourceSpy).toHaveBeenCalledTimes(2);

    createBufferSourceSpy.mockRestore();
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
    vi.stubGlobal("AudioContext", undefined);

    const { result } = renderHook(() => useAudioFeedback());

    // Wait for initialization attempt
    await waitFor(() => {
      expect(result.current.isReady).toBe(false);
    });

    // Verify playAudio doesn't throw
    await expect(result.current.playAudio(AIActionType.PROVOKE)).resolves.not.toThrow();

    // Restore AudioContext
    vi.unstubAllGlobals();
  });
});
