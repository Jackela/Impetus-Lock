/**
 * Telemetry Service
 *
 * Client-side telemetry for LLM usage tracking.
 * Provides opt-in telemetry with localStorage persistence.
 *
 * @module services/telemetry
 */

import { getVaultCache } from "./llmKeyVault";
import { createLogger } from "../utils/logger";

/**
 * Telemetry event structure.
 */
export interface TelemetryEvent {
  /** Event type/name */
  event: string;
  /** ISO timestamp (auto-generated if not provided) */
  timestamp?: string;
  /** LLM provider (for LLM-related events) */
  provider?: string;
  /** Event payload */
  payload?: Record<string, unknown>;
}

const STORAGE_KEY = "impetus.telemetry.enabled";
const telemetryLogger = createLogger("Telemetry");

/**
 * Check if telemetry is enabled.
 *
 * Reads from localStorage. Respects VITE_TELEMETRY_DEFAULT env var.
 *
 * @returns True if telemetry is enabled
 *
 * @example
 * ```ts
 * if (isTelemetryEnabled()) {
 *   emitTelemetry({ event: 'button_click' });
 * }
 * ```
 */
export function isTelemetryEnabled(): boolean {
  if (import.meta.env.VITE_TELEMETRY_DEFAULT === "on") {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/**
 * Enable or disable telemetry.
 *
 * Persists setting to localStorage.
 *
 * @param enabled - Whether to enable telemetry
 *
 * @example
 * ```ts
 * setTelemetryEnabled(true);  // Opt-in
 * setTelemetryEnabled(false); // Opt-out
 * ```
 */
export function setTelemetryEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

/**
 * Emit a telemetry event.
 *
 * Only logs if telemetry is enabled. Auto-generates timestamp.
 *
 * @param event - Telemetry event to emit
 *
 * @example
 * ```ts
 * emitTelemetry({
 *   event: 'llm_request',
 *   provider: 'openai',
 *   payload: { model: 'gpt-4o-mini' }
 * });
 * ```
 */
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

/**
 * Emit LLM configuration selection event.
 *
 * Convenience function that reads current LLM config and emits telemetry.
 *
 * @example
 * ```ts
 * import { emitLLMSelection } from './services/telemetry';
 *
 * // After user selects LLM provider
 * emitLLMSelection();
 * ```
 */
export function emitLLMSelection(): void {
  const config = getVaultCache();
  if (!config) return;
  emitTelemetry({
    event: "llm_config",
    provider: config.provider,
    payload: { model: config.model },
  });
}
