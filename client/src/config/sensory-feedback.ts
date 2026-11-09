import { AIActionType } from "../types/ai-actions";
import bonkUrl from "../assets/audio/bonk.mp3";
import buzzUrl from "../assets/audio/buzz.mp3";
import clankUrl from "../assets/audio/clank.mp3";
import whooshUrl from "../assets/audio/whoosh.mp3";

/**
 * Configuration for sensory feedback (animations + audio) per AI action type.
 *
 * Defines the visual animation type, audio file, and duration for each AI action.
 * This configuration drives the `SensoryFeedback` component and related hooks.
 */
export interface SensoryFeedbackConfig {
  /** Type of animation to play (glitch, fadeout, shake, error-flash) */
  animationType: "glitch" | "fadeout" | "shake" | "error-flash";

  /** Bundled audio asset URL resolved by Vite (hashed and emitted at build time) */
  audioFile: string;

  /** Duration of the animation in milliseconds */
  duration: number;
}

/**
 * Canonical audio assets.
 *
 * Audio files are imported as Vite static assets so the bundler emits them with
 * content hashes under `assets/` and the URLs stay correct in dev, preview and
 * production. Hard-coded `/src/assets/...` paths only resolved on the dev server
 * and produced 404s in a built bundle.
 *
 * Exactly four files back six actions: `clank` and `whoosh` are shared by two
 * actions each, so consumers must load `UNIQUE_AUDIO_FILES` once per file instead
 * of once per action.
 */
export const AUDIO_ASSETS = {
  bonk: bonkUrl,
  buzz: buzzUrl,
  clank: clankUrl,
  whoosh: whooshUrl,
} as const;

/**
 * The distinct audio files that need to be loaded, in stable order.
 *
 * Iterate this list when preloading so a shared sound is fetched once
 * (`6 actions` -> `4 requests`).
 */
export const UNIQUE_AUDIO_FILES: readonly string[] = Object.freeze([
  ...new Set(Object.values(AUDIO_ASSETS)),
]);

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
 * console.log(config.audioFile); // '/assets/clank-D3f9a1.mp3'
 * console.log(config.duration); // 1500 (milliseconds)
 * ```
 */
export const FEEDBACK_CONFIG: Record<AIActionType, SensoryFeedbackConfig> = {
  [AIActionType.PROVOKE]: {
    animationType: "glitch",
    audioFile: AUDIO_ASSETS.clank,
    duration: 1500, // 1.5 seconds (FR-007: complete within 1-2s)
  },
  [AIActionType.REWRITE]: {
    animationType: "glitch",
    audioFile: AUDIO_ASSETS.clank,
    duration: 1500,
  },

  [AIActionType.DELETE]: {
    animationType: "fadeout",
    audioFile: AUDIO_ASSETS.whoosh,
    duration: 750, // 0.75 seconds (FR-011: 0.5-1 second)
  },

  [AIActionType.REJECT]: {
    animationType: "shake",
    audioFile: AUDIO_ASSETS.bonk,
    duration: 500, // 0.5 seconds (P1 implementation timing)
  },

  [AIActionType.ERROR]: {
    animationType: "error-flash",
    audioFile: AUDIO_ASSETS.buzz,
    duration: 500, // 0.5 seconds (P3 US3: FR-005, FR-006)
  },
  [AIActionType.CHAOS]: {
    animationType: "glitch",
    audioFile: AUDIO_ASSETS.whoosh,
    duration: 1000,
  },
};
