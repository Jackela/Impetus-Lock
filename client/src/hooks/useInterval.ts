/**
 * Generic interval hook for React components.
 *
 * Provides a declarative way to manage setInterval with automatic cleanup
 * on unmount or dependency changes. Supports both immediate and delayed start.
 *
 * Constitutional Compliance:
 * - Article I (Simplicity): Native setInterval, no external dependencies
 * - Article V (Documentation): Complete JSDoc with examples
 *
 * @module hooks/useInterval
 */

import { useEffect, useRef, useCallback } from "react";

/**
 * Configuration options for useInterval hook.
 */
export interface UseIntervalOptions {
  /**
   * Callback function to execute on each interval tick.
   */
  callback: () => void;

  /**
   * Interval duration in milliseconds.
   * If null or undefined, the interval is paused.
   */
  delay: number | null | undefined;

  /**
   * Whether to start the interval immediately on mount.
   * @default true
   */
  immediate?: boolean;
}

/**
 * Return value from useInterval hook.
 */
export interface UseIntervalReturn {
  /**
   * Start the interval timer.
   * If already running, this is a no-op.
   */
  start: () => void;

  /**
   * Stop the interval timer.
   * Safe to call even if not running.
   */
  stop: () => void;

  /**
   * Restart the interval timer with the current delay.
   * Useful for resetting the timer after user activity.
   */
  restart: () => void;

  /**
   * Dynamically update the interval delay.
   * If the interval is currently running, it will be stopped and restarted
   * with the new delay. If delay is null/undefined, the interval is stopped.
   *
   * @param newDelay - The new interval delay in milliseconds, or null to pause
   */
  setDelay: (newDelay: number | null | undefined) => void;
}

/**
 * Generic interval hook for managing recurring callbacks.
 *
 * Features:
 * - Automatic cleanup on unmount
 * - Pause/resume by setting delay to null
 * - Ref-safe callback (no stale closures)
 * - Manual control via start/stop/restart functions
 *
 * @param options - Configuration options
 * @returns Control functions for the interval
 *
 * @example
 * ```tsx
 * // Basic usage - tick every second
 * useInterval({
 *   callback: () => console.log('tick'),
 *   delay: 1000
 * });
 *
 * // Conditional interval
 * const [count, setCount] = useState(0);
 * useInterval({
 *   callback: () => setCount(c => c + 1),
 *   delay: isActive ? 1000 : null
 * });
 *
 * // Manual control
 * const { start, stop, restart } = useInterval({
 *   callback: () => console.log('tick'),
 *   delay: 5000,
 *   immediate: false // Don't start automatically
 * });
 * ```
 */
export function useInterval(options: UseIntervalOptions): UseIntervalReturn {
  const { callback, delay, immediate = true } = options;

  // Store callback in ref to avoid stale closures
  const callbackRef = useRef(callback);

  // Store current delay in ref to allow dynamic updates via setDelay
  const delayRef = useRef(delay);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clear interval helper
  const clearIntervalRef = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  // Internal start function that uses delayRef
  const startWithDelay = useCallback((d: number | null | undefined) => {
    if (intervalIdRef.current || d === null || d === undefined) {
      return;
    }
    intervalIdRef.current = setInterval(() => {
      callbackRef.current();
    }, d);
  }, []);

  // Start interval (uses initial delay)
  const start = useCallback(() => {
    startWithDelay(delay);
  }, [delay, startWithDelay]);

  // Stop interval
  const stop = useCallback(() => {
    clearIntervalRef();
  }, [clearIntervalRef]);

  // Restart interval
  const restart = useCallback(() => {
    clearIntervalRef();
    startWithDelay(delayRef.current);
  }, [clearIntervalRef, startWithDelay]);

  // Dynamically update delay and restart interval if running
  const setDelay = useCallback(
    (newDelay: number | null | undefined) => {
      const wasRunning = intervalIdRef.current !== null;
      if (wasRunning) {
        clearIntervalRef();
      }
      delayRef.current = newDelay;
      if (newDelay !== null && newDelay !== undefined) {
        startWithDelay(newDelay);
      }
    },
    [clearIntervalRef, startWithDelay]
  );

  // Main effect: start/stop based on delay changes
  useEffect(() => {
    if (immediate && delay !== null && delay !== undefined) {
      start();
    }

    return () => {
      clearIntervalRef();
    };
  }, [delay, immediate, start, clearIntervalRef]);

  return {
    start,
    stop,
    restart,
    setDelay,
  };
}
