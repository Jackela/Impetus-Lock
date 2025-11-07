import { useState, useEffect, useRef, useCallback } from "react";
import { AIActionType } from "../types/ai-actions";
import { FEEDBACK_CONFIG } from "../config/sensory-feedback";

/**
 * Hook for audio feedback using Web Audio API.
 *
 * Preloads audio buffers on mount and provides a playAudio function
 * that implements cancel-and-replace behavior (stops previous audio
 * before playing new sound).
 *
 * **Requirements**:
 * - FR-006: Play Clank sound (metallic lock) for Provoke actions (1.5s duration)
 * - FR-010: Play Whoosh sound (wind/swoosh) for Delete actions (0.75s duration)
 * - FR-014: Play Bonk sound (impact) for Reject actions (0.5s duration)
 * - FR-015: Gracefully handle browsers without Web Audio API support
 * - FR-019: Cancel previous audio playback when new action triggers
 *
 * @returns Object containing playAudio function and isReady state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { playAudio, isReady } = useAudioFeedback();
 *
 *   const handleProvoke = () => {
 *     playAudio(AIActionType.PROVOKE); // Plays clank.mp3
 *   };
 *
 *   return <button onClick={handleProvoke} disabled={!isReady}>Trigger</button>;
 * }
 * ```
 */
export function useAudioFeedback() {
  const [isReady, setIsReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Map<AIActionType, AudioBuffer>>(new Map());
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Preload audio buffers on mount
  useEffect(() => {
    let isMounted = true;

    const initAudio = async () => {
      try {
        // Check if AudioContext is supported (FR-015)
        const AudioContextConstructor =
          globalThis.AudioContext ||
          (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
        if (!AudioContextConstructor) {
          console.warn("Web Audio API not supported in this browser");
          setIsReady(false);
          return;
        }

        // Create AudioContext (use global AudioContext from vitest.setup.ts in tests)
        audioContextRef.current = new AudioContextConstructor();

        // Fetch and decode all audio files
        const audioPromises = Object.entries(FEEDBACK_CONFIG).map(async ([actionType, config]) => {
          try {
            const response = await fetch(config.audioFile);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

            if (isMounted) {
              audioBuffersRef.current.set(actionType as AIActionType, audioBuffer);
            }
          } catch (error) {
            console.error(`Failed to load audio: ${config.audioFile}`, error);
          }
        });

        await Promise.all(audioPromises);

        if (isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        console.error("Failed to initialize audio context:", error);
        if (isMounted) {
          setIsReady(false);
        }
      }
    };

    initAudio();

    return () => {
      isMounted = false;

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /**
   * Play audio for the given action type.
   *
   * Implements cancel-and-replace: stops any currently playing audio
   * before starting the new sound (FR-019).
   *
   * @param actionType - AI action type (PROVOKE/DELETE/REJECT)
   */
  const playAudio = useCallback(
    async (actionType: AIActionType) => {
      // Graceful no-op if audio not ready (FR-015)
      if (!isReady || !audioContextRef.current) {
        return;
      }

      try {
        // FR-019: Stop previous audio before playing new sound (cancel-and-replace)
        if (currentSourceRef.current) {
          try {
            currentSourceRef.current.stop();
            currentSourceRef.current.disconnect();
          } catch {
            // Ignore errors if source already stopped (source may have completed naturally)
          }
          currentSourceRef.current = null;
        }

        const buffer = audioBuffersRef.current.get(actionType);
        if (!buffer) {
          console.warn(`No audio buffer found for action type: ${actionType}`);
          return;
        }

        // Create and configure audio source
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);

        // Store reference for cancel-and-replace
        currentSourceRef.current = source;

        // Start playback
        source.start(0);

        // Clear reference when playback completes
        source.onended = () => {
          if (currentSourceRef.current === source) {
            currentSourceRef.current = null;
          }
        };
      } catch (error) {
        console.error("Failed to play audio:", error);
      }
    },
    [isReady]
  );

  return { playAudio, isReady };
}
