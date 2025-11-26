import { useMemo } from "react";
import { emitTelemetry as emitTelemetryService } from "../services/telemetry";

export function useTelemetry() {
  return useMemo(
    () => ({
      emitTelemetry: emitTelemetryService,
    }),
    []
  );
}
