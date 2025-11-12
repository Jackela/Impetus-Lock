import { useCallback, useState } from "react";
import {
  clearLLMConfig,
  loadLLMConfig,
  saveLLMConfig,
  getProviderLabel,
  getRecommendedModel,
  PROVIDER_METADATA,
} from "../services/llmConfigStore";
import type { LLMConfig, LLMProviderName } from "../services/llmConfigStore";

export function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig | null>(() => loadLLMConfig());

  const persist = useCallback((next: LLMConfig) => {
    saveLLMConfig(next);
    setConfig(next);
  }, []);

  const reset = useCallback(() => {
    clearLLMConfig();
    setConfig(null);
  }, []);

  return {
    config,
    isConfigured: Boolean(config?.apiKey),
    saveConfig: persist,
    clearConfig: reset,
  } as const;
}

export type { LLMConfig, LLMProviderName };

export const LLM_PROVIDER_METADATA = PROVIDER_METADATA;

export function getLLMProviderLabel(provider: LLMProviderName): string {
  return getProviderLabel(provider);
}

export function getLLMRecommendedModel(provider: LLMProviderName): string {
  return getRecommendedModel(provider);
}
