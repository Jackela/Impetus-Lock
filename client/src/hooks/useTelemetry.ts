/**
 * Telemetry Hook
 *
 * React hook for managing telemetry state and emitting events.
 * Provides toggle control and event emission functionality.
 *
 * @module hooks/useTelemetry
 */

import { useCallback, useEffect, useState } from "react";
import {
  emitTelemetry as emitTelemetryService,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../services/telemetry";

/**
 * Hook return type for telemetry management.
 */
export interface UseTelemetryReturn {
  /** Whether telemetry is currently enabled */
  enabled: boolean;
  /** Toggle telemetry on/off */
  toggleTelemetry: () => void;
  /** Emit a telemetry event */
  emitTelemetry: (event: import("../services/telemetry").TelemetryEvent) => void;
}

/**
 * React hook for managing telemetry state.
 *
 * Provides reactive telemetry state with toggle control.
 * Reads initial state from localStorage on mount.
 *
 * @returns Telemetry state and control functions
 *
 * @example
 * ```tsx
 * function TelemetryToggle() {
 *   const { enabled, toggleTelemetry, emitTelemetry } = useTelemetry();
 *
 *   const handleClick = () => {
 *     emitTelemetry({ event: 'button_click', payload: { button: 'test' } });
 *   };
 *
 *   return (
 *     <button onClick={toggleTelemetry}>
 *       Telemetry: {enabled ? 'ON' : 'OFF'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTelemetry(): UseTelemetryReturn {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return isTelemetryEnabled();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setEnabled(isTelemetryEnabled());
    } catch {
      setEnabled(false);
    }
  }, []);

  const toggleTelemetry = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setTelemetryEnabled(next);
      return next;
    });
  }, []);

  const emitTelemetry = useCallback(emitTelemetryService, []);

  return { enabled, toggleTelemetry, emitTelemetry };
}
