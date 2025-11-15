import { getVaultCache } from "./llmKeyVault";
import { createLogger } from "../utils/logger";

export interface TelemetryEvent {
  event: string;
  timestamp?: string;
  provider?: string;
  payload?: Record<string, unknown>;
}

const STORAGE_KEY = "impetus.telemetry.enabled";
const telemetryLogger = createLogger("Telemetry");

export function isTelemetryEnabled(): boolean {
  if (import.meta.env.VITE_TELEMETRY_DEFAULT === "on") {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setTelemetryEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export function emitTelemetry(event: TelemetryEvent): void {
  if (!isTelemetryEnabled()) return;
  const entry = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  telemetryLogger.event(event.event, {
    provider: event.provider,
    ...event.payload,
    timestamp: entry.timestamp,
  });
}

export function emitLLMSelection(): void {
  const config = getVaultCache();
  if (!config) return;
  emitTelemetry({
    event: "llm_config",
    provider: config.provider,
    payload: { model: config.model },
  });
}
