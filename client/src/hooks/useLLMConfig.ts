import { useCallback, useState } from "react";
import type { LLMConfig } from "../services/llmConfigStore";
import { clearLLMConfig, loadLLMConfig, saveLLMConfig } from "../services/llmConfigStore";

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
