/**
 * LLM Configuration Store
 *
 * LocalStorage-based storage for LLM provider configuration.
 * Handles provider metadata and config persistence.
 *
 * @module services/llmConfigStore
 */

/**
 * Supported LLM provider names.
 */
export type LLMProviderName = "openai" | "anthropic" | "gemini";

/**
 * LLM provider configuration.
 */
export interface LLMConfig {
  /** Provider name */
  provider: LLMProviderName;
  /** Model identifier */
  model: string;
  /** API key for the provider */
  apiKey: string;
}

/**
 * Provider metadata including display info and defaults.
 */
export interface ProviderMetadata {
  /** Human-readable provider name */
  label: string;
  /** Recommended model for this provider */
  defaultModel: string;
  /** URL to provider documentation */
  docUrl: string;
  /** Pricing information hint */
  pricingHint: string;
}

const STORAGE_KEY = "impetus.llmConfig";

/**
 * Metadata for all supported LLM providers.
 */
export const PROVIDER_METADATA: Record<
  LLMProviderName,
  ProviderMetadata
> = {
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    docUrl: "https://platform.openai.com/docs/overview",
    pricingHint: "Pay-as-you-go (~$5 per 1M input tokens)",
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-haiku-latest",
    docUrl: "https://docs.anthropic.com/claude/docs/intro-to-the-api",
    pricingHint: "Usage-based (~$3 per 1M input tokens)",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash-lite",
    docUrl: "https://ai.google.dev/gemini-api/docs",
    pricingHint: "Generous free tier then per-token",
  },
};

/**
 * Get window object or null if not available.
 *
 * @returns Window object or null (SSR-safe)
 */
function safeWindow(): Window | null {
  return typeof window === "undefined" ? null : window;
}

/**
 * Read config from localStorage.
 *
 * @returns Stored config JSON string or null
 */
function readStorage(): string | null {
  const win = safeWindow();
  if (!win) return null;
  try {
    return win.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Load LLM configuration from localStorage.
 *
 * Validates the stored config before returning.
 *
 * @returns LLM config or null if not found/invalid
 *
 * @example
 * ```ts
 * const config = loadLLMConfig();
 * if (config) {
 *   console.log('Provider:', config.provider);
 * }
 * ```
 */
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

/**
 * Save LLM configuration to localStorage.
 *
 * Trims model and API key. Uses default model if model is empty.
 *
 * @param config - Config to save
 *
 * @example
 * ```ts
 * saveLLMConfig({
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   apiKey: 'sk-...'
 * });
 * ```
 */
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

/**
 * Clear LLM configuration from localStorage.
 *
 * @example
 * ```ts
 * clearLLMConfig(); // Remove stored config
 * ```
 */
export function clearLLMConfig(): void {
  const win = safeWindow();
  if (!win) return;
  try {
    win.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore removal failures
  }
}

/**
 * Get recommended model for a provider.
 *
 * @param provider - Provider name
 * @returns Recommended model ID
 *
 * @example
 * ```ts
 * getRecommendedModel('openai'); // "gpt-4o-mini"
 * ```
 */
export function getRecommendedModel(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].defaultModel;
}

/**
 * Get human-readable label for a provider.
 *
 * @param provider - Provider name
 * @returns Provider label
 *
 * @example
 * ```ts
 * getProviderLabel('openai'); // "OpenAI"
 * ```
 */
export function getProviderLabel(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].label;
}

/**
 * Get documentation URL for a provider.
 *
 * @param provider - Provider name
 * @returns Documentation URL
 *
 * @example
 * ```ts
 * getProviderDocUrl('openai'); // "https://platform.openai.com/docs/overview"
 * ```
 */
export function getProviderDocUrl(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].docUrl;
}

/**
 * Get pricing hint for a provider.
 *
 * @param provider - Provider name
 * @returns Pricing hint string
 *
 * @example
 * ```ts
 * getProviderPricingHint('openai'); // "Pay-as-you-go (~$5 per 1M input tokens)"
 * ```
 */
export function getProviderPricingHint(provider: LLMProviderName): string {
  return PROVIDER_METADATA[provider].pricingHint;
}

/**
 * Alias for loadLLMConfig for backwards compatibility.
 */
export const getStoredLLMConfig = loadLLMConfig;
