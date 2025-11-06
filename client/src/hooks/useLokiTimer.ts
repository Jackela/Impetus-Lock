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

import { useEffect, useRef, useCallback, useState } from "react";
import type { AgentMode } from "../types/mode";

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

// Timer configuration constants
const MIN_INTERVAL = 30000; // 30 seconds
const MAX_INTERVAL = 120000; // 120 seconds

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
  const randomFloat = randomBuffer[0] / (0xffffffff + 1); // Normalize to [0, 1)
  return Math.floor(randomFloat * (max - min + 1)) + min;
}

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

  // Store current interval for testing
  const [currentInterval, setCurrentInterval] = useState<number>(0);

  // Store timer ID for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Store callback reference to avoid stale closures
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  /**
   * Schedule next random timer.
   *
   * Generates a random interval and schedules the next trigger.
   * Recursively reschedules after each trigger for continuous chaos.
   */
  const scheduleNextTimer = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Generate random interval
    const interval = getRandomInterval(MIN_INTERVAL, MAX_INTERVAL);
    setCurrentInterval(interval);

    // Schedule timer
    timerRef.current = setTimeout(() => {
      // Trigger callback
      onTriggerRef.current();

      // Recursively schedule next timer
      scheduleNextTimer();
    }, interval);
  }, []);

  /**
   * Manual trigger function for demo mode.
   *
   * Fires the onTrigger callback immediately without affecting
   * the scheduled timer.
   */
  const manualTrigger = useCallback(() => {
    onTriggerRef.current();
  }, []);

  // Effect: Start/stop timer based on mode
  useEffect(() => {
    if (mode === "loki") {
      // Start timer
      scheduleNextTimer();
    } else {
      // Stop timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCurrentInterval(0);
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, scheduleNextTimer]);

  return {
    currentInterval,
    manualTrigger,
  };
}
