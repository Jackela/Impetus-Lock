/**
 * Telemetry Hook
 *
 * React hook for managing telemetry state and emitting events.
 * Provides toggle control and event emission functionality.
 *
 * @module hooks/useTelemetry
 */

import { useCallback, useState } from "react";
import {
  emitTelemetry as emitTelemetryService,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../services/telemetry";

function readTelemetryPreference(): boolean {
  try {
    return isTelemetryEnabled();
  } catch {
    return false;
  }
}

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
  const [enabled, setEnabled] = useState(readTelemetryPreference);

  const toggleTelemetry = useCallback(() => {
    const next = !readTelemetryPreference();
    setTelemetryEnabled(next);
    setEnabled(next);
  }, []);

  return { enabled, toggleTelemetry, emitTelemetry: emitTelemetryService };
}
