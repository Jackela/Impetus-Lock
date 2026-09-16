/**
 * Characterization tests for utils/logger.
 *
 * These tests pin the module's ACTUAL semantics, including three quirks
 * callers must not accidentally regress:
 * - The namespace gate is snapshotted when createLogger() runs; later
 *   configureLogger() calls only affect loggers created afterwards.
 * - The level threshold is read dynamically on every log call.
 * - event() bypasses the level threshold entirely.
 *
 * Order independence: the module-level config has no reset API, so the
 * "default configuration" describe re-imports a pristine module instance
 * per test via vi.resetModules() + dynamic import. The statically imported
 * instance every other describe uses is unaffected — resetModules only
 * influences future imports — so this file tolerates --sequence.shuffle.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { createLogger, configureLogger, LogLevel } from "./logger";

describe("utils/logger", () => {
  let debugSpy: MockInstance<typeof console.debug>;
  let infoSpy: MockInstance<typeof console.info>;
  let warnSpy: MockInstance<typeof console.warn>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    // Silence real console output; tests assert through the spies.
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("default configuration (pristine module state)", () => {
    /**
     * Import a pristine logger module instance. Default-state assertions
     * need an unmutated module-level config, which has no reset API —
     * clearing the registry and re-importing yields a fresh one no matter
     * when this test runs relative to the configureLogger() calls below.
     */
    const importPristineLogger = async (): Promise<typeof import("./logger")> => {
      vi.resetModules();
      return import("./logger");
    };

    it("enables every namespace at DEBUG level under import.meta.env.DEV", async () => {
      // Vitest runs with DEV=true, so the module default is enableAll + DEBUG.
      expect(import.meta.env.DEV).toBe(true);

      const { createLogger: createFreshLogger } = await importPristineLogger();
      const logger = createFreshLogger("DefaultNS");

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(debugSpy).toHaveBeenCalledWith("[DefaultNS]", "d");
      expect(infoSpy).toHaveBeenCalledWith("[DefaultNS]", "i");
      expect(warnSpy).toHaveBeenCalledWith("[DefaultNS]", "w");
      expect(errorSpy).toHaveBeenCalledWith("[DefaultNS]", "e");
    });

    it("emits structured events by default", async () => {
      const { createLogger: createFreshLogger } = await importPristineLogger();

      createFreshLogger("DefaultNS").event("boot");

      expect(infoSpy).toHaveBeenCalledOnce();
    });
  });

  describe("LogLevel", () => {
    it("defines the severity ladder consumed by level gating", () => {
      // Assert the forward mapping only; TS enums also carry reverse mappings.
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.NONE).toBe(4);
    });
  });

  describe("createLogger", () => {
    it("exposes all five logging methods", () => {
      const logger = createLogger("SurfaceNS");

      for (const method of ["debug", "info", "warn", "error", "event"] as const) {
        expect(typeof logger[method]).toBe("function");
      }
    });
  });

  describe("message routing and format", () => {
    it("routes each method to its matching console method with the data argument verbatim", () => {
      configureLogger({ enableAll: true, level: LogLevel.DEBUG });
      const logger = createLogger("RouteNS");
      const data = { lockId: "lock_001" };

      logger.debug("debug message", data);
      logger.info("info message", data);
      logger.warn("warn message", data);
      logger.error("error message", data);

      expect(debugSpy).toHaveBeenCalledWith("[RouteNS]", "debug message", data);
      expect(infoSpy).toHaveBeenCalledWith("[RouteNS]", "info message", data);
      expect(warnSpy).toHaveBeenCalledWith("[RouteNS]", "warn message", data);
      expect(errorSpy).toHaveBeenCalledWith("[RouteNS]", "error message", data);
    });

    it("omits the data argument when none is passed", () => {
      configureLogger({ enableAll: true, level: LogLevel.DEBUG });

      createLogger("BareNS").info("bare message");

      expect(infoSpy).toHaveBeenCalledWith("[BareNS]", "bare message");
    });
  });

  describe("configureLogger namespace gating", () => {
    it("enables namespaces included by prefix match", () => {
      configureLogger({ enableAll: false, namespaces: ["Editor"], level: LogLevel.DEBUG });

      createLogger("EditorCore").info("included");

      expect(infoSpy).toHaveBeenCalledWith("[EditorCore]", "included");
    });

    it("suppresses namespaces not covered by the configured list", () => {
      configureLogger({ enableAll: false, namespaces: ["Core"], level: LogLevel.DEBUG });

      createLogger("EditorCore").error("suppressed");

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("suppresses everything when namespaces is empty and enableAll is false", () => {
      configureLogger({ enableAll: false, namespaces: [], level: LogLevel.DEBUG });

      createLogger("Anything").error("suppressed");

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("re-enables all namespaces via enableAll regardless of the configured list", () => {
      configureLogger({ enableAll: false, namespaces: ["Other"], level: LogLevel.INFO });
      configureLogger({ enableAll: true });

      createLogger("AnyNS").info("enabled");

      expect(infoSpy).toHaveBeenCalledWith("[AnyNS]", "enabled");
    });
  });

  describe("configureLogger level gating", () => {
    it("suppresses methods below the configured level and emits at/above it", () => {
      configureLogger({ enableAll: true, level: LogLevel.WARN });
      const logger = createLogger("LevelNS");

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith("[LevelNS]", "w");
      expect(errorSpy).toHaveBeenCalledWith("[LevelNS]", "e");
    });

    it("suppresses every console method at LogLevel.NONE", () => {
      configureLogger({ enableAll: true, level: LogLevel.NONE });
      const logger = createLogger("NoneNS");

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("gating timing quirks", () => {
    it("snapshots the namespace gate at createLogger time; later re-gating only affects new loggers", () => {
      configureLogger({ enableAll: false, namespaces: ["SnapNS"], level: LogLevel.INFO });
      const existing = createLogger("SnapNS");
      configureLogger({ enableAll: false, namespaces: [], level: LogLevel.INFO });
      const fresh = createLogger("SnapNS");

      existing.info("still enabled");
      fresh.info("gated off");

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith("[SnapNS]", "still enabled");
    });

    it("reads the level threshold dynamically on each call", () => {
      configureLogger({ enableAll: true, level: LogLevel.DEBUG });
      const logger = createLogger("DynamicNS");

      logger.debug("before");
      configureLogger({ level: LogLevel.ERROR });
      logger.debug("after");
      logger.error("err");

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith("[DynamicNS]", "before");
      expect(errorSpy).toHaveBeenCalledWith("[DynamicNS]", "err");
    });
  });

  describe("event emission", () => {
    it("emits structured events via console.info with a JSON payload", () => {
      configureLogger({ enableAll: true, level: LogLevel.DEBUG });

      createLogger("EvtNS").event("doc-changed", { docVersion: 5, reason: "input" });

      expect(infoSpy).toHaveBeenCalledOnce();
      const [prefix, json] = infoSpy.mock.calls[0] as [string, string];
      expect(prefix).toBe("[EvtNS]");
      const entry = JSON.parse(json) as Record<string, unknown>;
      expect(entry).toMatchObject({
        namespace: "EvtNS",
        event: "doc-changed",
        docVersion: 5,
        reason: "input",
      });
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("emits payload-less events with namespace/event/timestamp only", () => {
      configureLogger({ enableAll: true, level: LogLevel.DEBUG });

      createLogger("EvtNS").event("tick");

      const entry = JSON.parse(infoSpy.mock.calls[0][1] as string) as Record<string, unknown>;
      expect(Object.keys(entry).sort()).toEqual(["event", "namespace", "timestamp"]);
    });

    it("bypasses the level threshold (the namespace gate is the only check)", () => {
      configureLogger({ enableAll: true, level: LogLevel.NONE });

      createLogger("EvtNS").event("leveled");

      expect(infoSpy).toHaveBeenCalledOnce();
    });
  });
});
