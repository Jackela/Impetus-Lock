import { describe, it, expect, vi, beforeEach } from "vitest";
import { emitTelemetry, emitLLMSelection, isTelemetryEnabled, setTelemetryEnabled } from "../telemetry";
import { saveVaultConfig, setVaultMode, clearVault } from "../llmKeyVault";
import { configureLogger, LogLevel } from "../../utils/logger";

const originalEnv = { ...import.meta.env };

describe("telemetry", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setVaultMode("local");
    await clearVault();
    Object.assign(import.meta.env, originalEnv);
    configureLogger({ namespaces: [], enableAll: false, level: LogLevel.ERROR });
  });

  it("respects opt-out by default", () => {
    expect(isTelemetryEnabled()).toBe(false);
  });

  it("emits to console when enabled", () => {
    configureLogger({ namespaces: ["Telemetry"], enableAll: false, level: LogLevel.INFO });
    setTelemetryEnabled(true);
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitTelemetry({ event: "test", timestamp: new Date().toISOString() });

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("never logs raw API keys when reporting BYOK status", async () => {
    configureLogger({ namespaces: ["Telemetry"], enableAll: false, level: LogLevel.INFO });
    setTelemetryEnabled(true);
    await saveVaultConfig({ provider: "openai", model: "gpt-4o-mini", apiKey: "sk-secret" });
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    emitLLMSelection();

    const callArgs = spy.mock.calls[0]?.join(" ") ?? "";
    expect(callArgs).not.toContain("sk-secret");
    spy.mockRestore();
  });
});
