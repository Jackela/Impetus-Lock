import { ENABLE_DEV_TIMINGS } from "./config";

interface Timings {
  first_screen_ready_ms?: number;
  action_feedback_ms?: number;
  action_committed_ms?: number;
}

let launched = 0;
let started = 0;
let enabled = false;
let result: Timings = {};

/** Enable an in-memory timing sample only in an expressly opted-in development build. */
export function markLaunch(): void {
  enabled = ENABLE_DEV_TIMINGS && wx.getAccountInfoSync().miniProgram.envVersion === "develop";
  launched = enabled ? Date.now() : 0;
  started = 0;
  result = {};
}

export function markReady(): void {
  if (enabled && result.first_screen_ready_ms === undefined) {
    result.first_screen_ready_ms = Math.max(0, Date.now() - launched);
  }
}

export function beginAction(): void {
  if (!enabled) return;
  started = Date.now();
  delete result.action_feedback_ms;
  delete result.action_committed_ms;
}

export function markFeedback(): void {
  if (enabled && started && result.action_feedback_ms === undefined) {
    result.action_feedback_ms = Math.max(0, Date.now() - started);
  }
}

export function markCommitted(): void {
  if (enabled && started && result.action_committed_ms === undefined) {
    result.action_committed_ms = Math.max(0, Date.now() - started);
    started = 0;
  }
}

export function getFirstStoryTimings(): Readonly<Timings> {
  return { ...result };
}
