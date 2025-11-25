import { useCallback, useEffect, useState } from "react";
import {
  clearVault,
  getVaultCache,
  getVaultMetadata,
  getVaultMode,
  isVaultLocked,
  loadVaultConfig,
  lockVault,
  saveVaultConfig,
  setVaultMode,
  setVaultPassphrase,
  subscribeVault,
} from "../services/llmKeyVault";
import {
  PROVIDER_METADATA,
  getProviderLabel,
  getRecommendedModel,
  getProviderDocUrl,
  getProviderPricingHint,
} from "../services/llmConfigStore";
import type { VaultMetadata, VaultMode } from "../services/llmKeyVault";
import type { LLMConfig, LLMProviderName } from "../services/llmConfigStore";

export function useLLMConfig() {
  const [config, setConfig] = useState<LLMConfig | null>(() => getVaultCache());
  const [mode, setModeState] = useState<VaultMode>(getVaultMode());
  const [locked, setLocked] = useState<boolean>(isVaultLocked());
  const [metadata, setMetadata] = useState<VaultMetadata>(getVaultMetadata());

  useEffect(() => {
    let mounted = true;
    loadVaultConfig().then((value) => {
      if (!mounted) return;
      setConfig(value);
      setLocked(isVaultLocked());
      setMetadata(getVaultMetadata());
    });

    const unsubscribe = subscribeVault(() => {
      setModeState(getVaultMode());
      setLocked(isVaultLocked());
      setMetadata(getVaultMetadata());
      setConfig(getVaultCache());
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const save = useCallback(async (next: LLMConfig) => {
    await saveVaultConfig(next);
    setConfig(getVaultCache());
  }, []);

  const clear = useCallback(async () => {
    await clearVault();
    setConfig(null);
  }, []);

  const changeMode = useCallback(async (next: VaultMode) => {
    await setVaultMode(next);
    await loadVaultConfig();
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    await setVaultPassphrase(passphrase);
    const value = await loadVaultConfig();
    setConfig(value);
    setLocked(isVaultLocked());
  }, []);

  const lock = useCallback(() => {
    lockVault();
    setConfig(getVaultCache());
    setLocked(isVaultLocked());
  }, []);

  return {
    config,
    isConfigured: Boolean(config?.apiKey),
    saveConfig: save,
    clearConfig: clear,
    mode,
    setMode: changeMode,
    locked,
    unlock,
    lock,
    metadata,
  } as const;
}

export type { LLMConfig, LLMProviderName };

export function getLLMProviderLabel(provider: LLMProviderName): string {
  return getProviderLabel(provider);
}

export function getLLMRecommendedModel(provider: LLMProviderName): string {
  return getRecommendedModel(provider);
}

export function getLLMProviderDocs(provider: LLMProviderName): string {
  return getProviderDocUrl(provider);
}

export function getLLMProviderPricing(provider: LLMProviderName): string {
  return getProviderPricingHint(provider);
}
