/**
 * Audio asset wiring for sensory feedback.
 *
 * The configuration used to hard-code `/src/assets/audio/*.mp3`, which only resolves
 * on the Vite dev server: a built bundle 404s every sound. The files are now imported
 * as static assets so the bundler emits hashed URLs, and the six actions share four
 * files, so the unique list is the preloading contract (4 loads, not 6).
 */

import { describe, expect, it } from "vitest";
import { AIActionType } from "../types/ai-actions";
import { AUDIO_ASSETS, FEEDBACK_CONFIG, UNIQUE_AUDIO_FILES } from "./sensory-feedback";

const ACTION_TYPES = Object.values(AIActionType);

describe("sensory feedback audio configuration", () => {
  it("resolves every action to a bundled audio asset", () => {
    expect(ACTION_TYPES).toHaveLength(6);
    const assets = new Set<string>(Object.values(AUDIO_ASSETS));
    for (const action of ACTION_TYPES) {
      const audioFile = FEEDBACK_CONFIG[action].audioFile;
      expect(typeof audioFile).toBe("string");
      expect(audioFile).toMatch(/\.mp3$/);
      expect(assets.has(audioFile)).toBe(true);
    }
  });

  it("shares four distinct files across the six actions", () => {
    expect(Object.values(AUDIO_ASSETS)).toHaveLength(4);
    expect(new Set(Object.values(AUDIO_ASSETS)).size).toBe(4);

    const used = new Set(ACTION_TYPES.map((action) => FEEDBACK_CONFIG[action].audioFile));
    expect(used.size).toBe(4);
    // The two shared sounds keep the action count above the file count.
    expect(FEEDBACK_CONFIG[AIActionType.PROVOKE].audioFile).toBe(
      FEEDBACK_CONFIG[AIActionType.REWRITE].audioFile
    );
    expect(FEEDBACK_CONFIG[AIActionType.DELETE].audioFile).toBe(
      FEEDBACK_CONFIG[AIActionType.CHAOS].audioFile
    );
  });

  it("exports the deduplicated preload list consumers must iterate", () => {
    expect(UNIQUE_AUDIO_FILES).toHaveLength(4);
    expect(new Set(UNIQUE_AUDIO_FILES).size).toBe(4);
    expect([...UNIQUE_AUDIO_FILES].sort()).toEqual(
      [...new Set(Object.values(AUDIO_ASSETS))].sort()
    );
  });
});
