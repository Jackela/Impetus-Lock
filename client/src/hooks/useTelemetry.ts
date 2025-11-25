import { useCallback, useState } from "react";

import {
  emitTelemetry as emitTelemetryEvent,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../services/telemetry";
import type { TelemetryEvent } from "../services/telemetry";

export function useTelemetry() {
  const [enabled, setEnabled] = useState<boolean>(() => isTelemetryEnabled());

  const updateEnabled = useCallback((next: boolean) => {
    setTelemetryEnabled(next);
    setEnabled(next);
  }, []);

  const toggleTelemetry = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setTelemetryEnabled(next);
      return next;
    });
  }, []);

  const emitTelemetry = useCallback((event: TelemetryEvent) => {
    emitTelemetryEvent(event);
  }, []);

  return {
    enabled,
    setEnabled: updateEnabled,
    toggleTelemetry,
    emitTelemetry,
  };
}
