import { AIActionType } from "../types/ai-actions";

/**
 * Configuration for sensory feedback (animations + audio) per AI action type.
 *
 * Defines the visual animation type, audio file, and duration for each AI action.
 * This configuration drives the `SensoryFeedback` component and related hooks.
 */
export interface SensoryFeedbackConfig {
  /** Type of animation to play (glitch, fadeout, shake, error-flash) */
  animationType: "glitch" | "fadeout" | "shake" | "error-flash";

  /** Path to audio file (relative to /assets/audio/) */
  audioFile: string;

  /** Duration of the animation in milliseconds */
  duration: number;
}

/**
 * Sensory feedback configuration map.
 *
 * Maps each AI action type to its corresponding animation and audio feedback:
 * - PROVOKE (Muse mode): Glitch effect + metallic clank sound
 * - DELETE (Loki mode): Fade-out effect + wind whoosh sound
 * - REJECT (Lock enforcement): Shake effect + impact bonk sound
 * - ERROR (API failure): Red flash effect + urgent buzz sound (P3 US3)
 *
 * **Requirements**:
 * - FR-006 to FR-009: Provoke action must display Glitch animation and play Clank sound
 * - FR-010 to FR-013: Delete action must display Fade-out animation and play Whoosh sound
 * - FR-017: Rejection feedback must match P1 implementation (Shake + Bonk)
 *
 * **Performance Targets**:
 * - SC-007: Animation timing 95%+ consistent (Glitch ~1.5s, Fade-out ~0.75s)
 * - SC-008: Audio-visual sync <100ms lag
 *
 * @example
 * ```typescript
 * const config = FEEDBACK_CONFIG[AIActionType.PROVOKE];
 * console.log(config.animationType); // 'glitch'
 * console.log(config.audioFile); // '/assets/audio/clank.mp3'
 * console.log(config.duration); // 1500 (milliseconds)
 * ```
 */
export const FEEDBACK_CONFIG: Record<AIActionType, SensoryFeedbackConfig> = {
  [AIActionType.PROVOKE]: {
    animationType: "glitch",
    audioFile: "/src/assets/audio/clank.mp3",
    duration: 1500, // 1.5 seconds (FR-007: complete within 1-2s)
  },
  [AIActionType.REWRITE]: {
    animationType: "glitch",
    audioFile: "/src/assets/audio/clank.mp3",
    duration: 1500,
  },

  [AIActionType.DELETE]: {
    animationType: "fadeout",
    audioFile: "/src/assets/audio/whoosh.mp3",
    duration: 750, // 0.75 seconds (FR-011: 0.5-1 second)
  },

  [AIActionType.REJECT]: {
    animationType: "shake",
    audioFile: "/src/assets/audio/bonk.mp3",
    duration: 500, // 0.5 seconds (P1 implementation timing)
  },

  [AIActionType.ERROR]: {
    animationType: "error-flash",
    audioFile: "/src/assets/audio/buzz.mp3",
    duration: 500, // 0.5 seconds (P3 US3: FR-005, FR-006)
  },
  [AIActionType.CHAOS]: {
    animationType: "glitch",
    audioFile: "/src/assets/audio/whoosh.mp3",
    duration: 1000,
  },
};
