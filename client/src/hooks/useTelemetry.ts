import { useCallback, useEffect, useState } from "react";
import {
  emitTelemetry as emitTelemetryService,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../services/telemetry";

export function useTelemetry() {
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
