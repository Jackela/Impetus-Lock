export type LLMProviderName = "openai" | "anthropic" | "gemini";

export interface LLMConfig {
  provider: LLMProviderName;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = "impetus.llmConfig";

export const PROVIDER_METADATA: Record<LLMProviderName, { label: string; defaultModel: string }> = {
  openai: { label: "OpenAI", defaultModel: "gpt-4o-mini" },
  anthropic: { label: "Anthropic Claude", defaultModel: "claude-3-5-haiku-latest" },
  gemini: { label: "Google Gemini", defaultModel: "gemini-2.0-flash-lite" },
};

function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

function readStorage(): string | null {
  const win = safeWindow();
  if (!win) return null;
  try {
    return win.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function loadLLMConfig(): LLMConfig | null {
  const raw = readStorage();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "provider" in parsed &&
      "model" in parsed &&
      "apiKey" in parsed
    ) {
      const provider = (parsed as LLMConfig).provider;
      if (provider === "openai" || provider === "anthropic" || provider === "gemini") {
        return {
          provider,
          model: String((parsed as LLMConfig).model || PROVIDER_METADATA[provider].defaultModel),
          apiKey: String((parsed as LLMConfig).apiKey || ""),
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function saveLLMConfig(config: LLMConfig): void {
  const win = safeWindow();
  if (!win) return;
  try {
    const payload: LLMConfig = {
      provider: config.provider,
      model: config.model.trim() || PROVIDER_METADATA[config.provider].defaultModel,
      apiKey: config.apiKey.trim(),
    };
    win.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota/security errors
  }
}

export function clearLLMConfig(): void {
  const win = safeWindow();
  if (!win) return;
  try {
    win.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore removal failures
  }
}

export function getRecommendedModel(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].defaultModel;
}

export function getProviderLabel(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].label;
}

export const getStoredLLMConfig = loadLLMConfig;
