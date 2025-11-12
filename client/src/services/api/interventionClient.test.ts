import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateIntervention } from "./interventionClient";
import { saveLLMConfig, clearLLMConfig } from "../llmConfigStore";

const baseRequest = {
  context: "test",
  mode: "muse" as const,
  client_meta: { doc_version: 1, selection_from: 0, selection_to: 0 },
};

describe("generateIntervention", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearLLMConfig();
  });

  it("attaches BYOK headers when config present", async () => {
    saveLLMConfig({ provider: "gemini", model: "gemini-2.0-flash-lite", apiKey: "AI-KEY" });

    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          action: "provoke",
          content: "hello",
          lock_id: "lock",
          anchor: { type: "pos", from: 0 },
          action_id: "act",
          issued_at: new Date().toISOString(),
          source: "muse",
        }),
      status: 200,
    } as Response;

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await generateIntervention(baseRequest, { idempotencyKey: "fixed" });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toMatchObject({
      "X-LLM-Provider": "gemini",
      "X-LLM-Model": "gemini-2.0-flash-lite",
      "X-LLM-Api-Key": "AI-KEY",
    });
  });

  it("maps provider errors to InterventionAPIError", async () => {
    clearLLMConfig();

    const mockResponse = {
      ok: false,
      status: 503,
      json: () => Promise.resolve({ code: "llm_not_configured", message: "LLM unavailable" }),
    } as Response;

    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse);

    await expect(
      generateIntervention(baseRequest, { idempotencyKey: "err" })
    ).rejects.toMatchObject({
      errorCode: "llm_not_configured",
      message: "LLM unavailable",
    });
  });
});
