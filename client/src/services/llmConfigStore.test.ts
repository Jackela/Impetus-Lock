import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLLMConfig,
  saveLLMConfig,
  clearLLMConfig,
  getRecommendedModel,
} from "./llmConfigStore";

describe("llmConfigStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing stored", () => {
    expect(loadLLMConfig()).toBeNull();
  });

  it("persists and retrieves config", () => {
    saveLLMConfig({ provider: "anthropic", model: " custom ", apiKey: " sk-ant " });
    const stored = loadLLMConfig();
    expect(stored).toEqual({
      provider: "anthropic",
      model: "custom",
      apiKey: "sk-ant",
    });
  });

  it("falls back to recommended model when empty", () => {
    saveLLMConfig({ provider: "gemini", model: "  ", apiKey: "AI-123" });
    const stored = loadLLMConfig();
    expect(stored?.model).toBe(getRecommendedModel("gemini"));
  });

  it("clears stored config", () => {
    saveLLMConfig({ provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test" });
    clearLLMConfig();
    expect(loadLLMConfig()).toBeNull();
  });
});
