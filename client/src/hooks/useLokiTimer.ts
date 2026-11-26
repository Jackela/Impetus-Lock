/**
 * Loki Mode Random Chaos Timer Hook
 *
 * Implements random interval timer for Loki mode interventions.
 * Uses crypto.getRandomValues() for uniform distribution.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Native Crypto API, no dependencies
 * - Article III (TDD): Tests written first, implementation follows
 * - Article V (Documentation): Complete JSDoc with examples
 *
 * Success Criteria:
 * - SC-004: Random timer distribution uniformity ≥99%
 *
 * @module hooks/useLokiTimer
 */

import { useLayoutEffect, useRef, useCallback, useState, useSyncExternalStore } from "react";
import type { AgentMode } from "../types/mode";
import { LOKI_MIN_INTERVAL_MS, LOKI_MAX_INTERVAL_MS } from "../config/animation";

/**
 * Configuration options for useLokiTimer hook.
 */
export interface UseLokiTimerOptions {
  /** Current agent mode (timer only active when mode === 'loki') */
  mode: AgentMode;

  /** Callback triggered when random timer fires */
  onTrigger: () => void;
}

/**
 * Return value from useLokiTimer hook.
 */
export interface UseLokiTimerReturn {
  /** Current random interval in milliseconds (for testing) */
  currentInterval: number;

  /** Manually trigger intervention (for demo mode) */
  manualTrigger: () => void;
}

// Timer configuration constants (from centralized config)
const MIN_INTERVAL = LOKI_MIN_INTERVAL_MS;
const MAX_INTERVAL = LOKI_MAX_INTERVAL_MS;

/**
 * Generate cryptographically random interval between min and max.
 *
 * Uses crypto.getRandomValues() for uniform distribution.
 *
 * @param min - Minimum interval in milliseconds
 * @param max - Maximum interval in milliseconds
 * @returns Random interval in milliseconds
 */
function getRandomInterval(min: number, max: number): number {
  // Use crypto.getRandomValues for cryptographically strong randomness
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);

  // Convert to range [min, max]
  const randomFloat = (randomBuffer[0] ?? 0) / (0xffffffff + 1); // Normalize to [0, 1)
  return Math.floor(randomFloat * (max - min + 1)) + min;
}

function createLokiTimer() {
  let interval = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => interval,
    subscribe(onIntervalChange: () => void) {
      listeners.add(onIntervalChange);
      return () => {
        listeners.delete(onIntervalChange);
      };
    },
    start(onTrigger: () => void) {
      let timeout: ReturnType<typeof setTimeout>;
      let stopped = false;

      function schedule() {
        interval = getRandomInterval(MIN_INTERVAL, MAX_INTERVAL);
        timeout = setTimeout(() => {
          try {
            onTrigger();
          } finally {
            if (!stopped) schedule();
          }
        }, interval);
        for (const onIntervalChange of listeners) onIntervalChange();
      }

      schedule();
      return () => {
        stopped = true;
        clearTimeout(timeout);
        interval = 0;
      };
    },
  };
}

const getServerInterval = () => 0;

/**
 * Loki Mode random chaos timer hook.
 *
 * Schedules interventions at random intervals between 30-120 seconds.
 * Uses crypto.getRandomValues() for cryptographically strong randomness
 * and uniform distribution.
 *
 * @param options - Configuration options
 * @returns Timer state and manual trigger function
 *
 * @example
 * ```tsx
 * function EditorCore() {
 *   const handleLokiTrigger = useCallback(async () => {
 *     // Trigger Loki intervention (provoke or delete)
 *     const response = await triggerLokiIntervention();
 *     if (response.action === 'provoke') {
 *       injectLockedBlock(response.content, response.lock_id);
 *     } else if (response.action === 'delete') {
 *       deleteContentAtAnchor(response.anchor);
 *     }
 *   }, []);
 *
 *   const { manualTrigger } = useLokiTimer({
 *     mode: 'loki',
 *     onTrigger: handleLokiTrigger
 *   });
 *
 *   return <Editor mode="loki" />;
 * }
 * ```
 */
export function useLokiTimer(options: UseLokiTimerOptions): UseLokiTimerReturn {
  const { mode, onTrigger } = options;

  const [timer] = useState(createLokiTimer);

  // Store callback reference to avoid stale closures
  const onTriggerRef = useRef(onTrigger);
  useLayoutEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  /**
   * Manual trigger function for demo mode.
   *
   * Fires the onTrigger callback immediately without affecting
   * the scheduled timer.
   */
  const manualTrigger = useCallback(() => {
    onTriggerRef.current();
  }, []);

  // Stop the old timeout during the mode commit, before passive effects run.
  useLayoutEffect(() => {
    if (mode === "loki") return timer.start(manualTrigger);
  }, [mode, timer, manualTrigger]);

  const currentInterval = useSyncExternalStore(
    timer.subscribe,
    timer.getSnapshot,
    getServerInterval
  );

  return {
    currentInterval: mode === "loki" ? currentInterval : 0,
    manualTrigger,
  };
}
