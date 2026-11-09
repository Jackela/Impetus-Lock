import { useState, useEffect, useRef, useCallback } from "react";
import { AIActionType } from "../types/ai-actions";
import { FEEDBACK_CONFIG, UNIQUE_AUDIO_FILES } from "../config/sensory-feedback";
import { createLogger } from "../utils/logger";

const logger = createLogger("useAudioFeedback");

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
          logger.warn("Web Audio API not supported in this browser");
          setIsReady(false);
          return;
        }

        // Create AudioContext (use global AudioContext from vitest.setup.ts in tests)
        audioContextRef.current = new AudioContextConstructor();

        // Fetch and decode each *distinct* audio file exactly once.
        // Six actions share four files (clank/whoosh back two actions each), so
        // keying by URL avoids duplicate requests and duplicate decodes.
        const buffersByUrl = new Map<string, AudioBuffer>();

        const audioPromises = UNIQUE_AUDIO_FILES.map(async (audioFile) => {
          try {
            const response = await fetch(audioFile);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

            if (isMounted) {
              buffersByUrl.set(audioFile, audioBuffer);
            }
          } catch (error) {
            logger.error(`Failed to load audio: ${audioFile}`, error);
          }
        });

        await Promise.all(audioPromises);

        if (isMounted) {
          // Fan the decoded buffers back out to every action that uses the file.
          Object.entries(FEEDBACK_CONFIG).forEach(([actionType, config]) => {
            const audioBuffer = buffersByUrl.get(config.audioFile);
            if (audioBuffer) {
              audioBuffersRef.current.set(actionType as AIActionType, audioBuffer);
            }
          });
          setIsReady(true);
        }
      } catch (error) {
        logger.error("Failed to initialize audio context", error);
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
          logger.warn(`No audio buffer found for action type: ${actionType}`);
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
        logger.error("Failed to play audio", error);
      }
    },
    [isReady]
  );

  return { playAudio, isReady };
}
