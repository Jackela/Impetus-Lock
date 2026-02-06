/**
 * LLM Config Hook
 *
 * React hook for managing LLM configuration and vault state.
 * Handles local, encrypted, and session storage modes.
 *
 * @module hooks/useLLMConfig
 */

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
  getProviderLabel,
  getRecommendedModel,
  getProviderDocUrl,
  getProviderPricingHint,
  PROVIDER_METADATA,
} from "../services/llmConfigStore";
import type { VaultMetadata, VaultMode } from "../services/llmKeyVault";
import type { LLMConfig, LLMProviderName } from "../services/llmConfigStore";

/**
 * Hook return type for LLM config management.
 */
export interface UseLLMConfigReturn {
  /** Current LLM configuration (null if not configured) */
  config: LLMConfig | null;
  /** Whether API key is configured */
  isConfigured: boolean;
  /** Save configuration to vault */
  saveConfig: (config: LLMConfig) => Promise<void>;
  /** Clear configuration from vault */
  clearConfig: () => Promise<void>;
  /** Current vault mode (local/encrypted/session) */
  mode: VaultMode;
  /** Change vault mode */
  setMode: (mode: VaultMode) => Promise<void>;
  /** Whether encrypted vault is locked */
  locked: boolean;
  /** Unlock encrypted vault with passphrase */
  unlock: (passphrase: string) => Promise<void>;
  /** Lock encrypted vault */
  lock: () => void;
  /** Vault metadata (updatedAt, hasPassphrase, etc.) */
  metadata: VaultMetadata;
}

/**
 * React hook for managing LLM configuration.
 *
 * Provides reactive state for LLM config with vault integration.
 * Supports local storage, encrypted storage (BYOK), and session modes.
 *
 * @returns LLM config state and management functions
 *
 * @example
 * ```tsx
 * function LLMSettings() {
 *   const { config, saveConfig, mode, setMode, locked, unlock } = useLLMConfig();
 *
 *   const handleSave = async () => {
 *     await saveConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk-...' });
 *   };
 *
 *   return (
 *     <div>
 *       <p>Mode: {mode}</p>
 *       {locked && <button onClick={() => unlock('passphrase')}>Unlock</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLLMConfig(): UseLLMConfigReturn {
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

/**
 * Get human-readable label for LLM provider.
 *
 * @param provider - Provider name
 * @returns Display label (e.g., "OpenAI", "Anthropic Claude")
 *
 * @example
 * ```ts
 * getLLMProviderLabel('openai'); // "OpenAI"
 * getLLMProviderLabel('anthropic'); // "Anthropic Claude"
 * ```
 */
export function getLLMProviderLabel(provider: LLMProviderName): string {
  return getProviderLabel(provider);
}

/**
 * Get recommended model for LLM provider.
 *
 * @param provider - Provider name
 * @returns Recommended model ID
 *
 * @example
 * ```ts
 * getLLMRecommendedModel('openai'); // "gpt-4o-mini"
 * getLLMRecommendedModel('anthropic'); // "claude-3-5-haiku-latest"
 * ```
 */
export function getLLMRecommendedModel(provider: LLMProviderName): string {
  return getRecommendedModel(provider);
}

/**
 * Get documentation URL for LLM provider.
 *
 * @param provider - Provider name
 * @returns Documentation URL
 *
 * @example
 * ```ts
 * getLLMProviderDocs('openai'); // "https://platform.openai.com/docs/overview"
 * ```
 */
export function getLLMProviderDocs(provider: LLMProviderName): string {
  return getProviderDocUrl(provider);
}

/**
 * Get pricing hint for LLM provider.
 *
 * @param provider - Provider name
 * @returns Pricing hint string
 *
 * @example
 * ```ts
 * getLLMProviderPricing('openai'); // "Pay-as-you-go (~$5 per 1M input tokens)"
 * ```
 */
export function getLLMProviderPricing(provider: LLMProviderName): string {
  return getProviderPricingHint(provider);
}

/**
 * LLM provider option for select dropdowns.
 */
export interface LLMProviderOption {
  /** Provider value */
  value: LLMProviderName;
  /** Display label */
  label: string;
  /** Helper text (default model) */
  helper: string;
}

/**
 * Get all LLM provider options as array.
 *
 * Useful for populating select dropdowns.
 *
 * @returns Array of provider options
 *
 * @example
 * ```tsx
 * const options = getLLMProviderOptions();
 * // [{ value: 'openai', label: 'OpenAI', helper: 'gpt-4o-mini' }, ...]
 *
 * <select>
 *   {options.map(opt => (
 *     <option key={opt.value} value={opt.value}>{opt.label}</option>
 *   ))}
 * </select>
 * ```
 */
export function getLLMProviderOptions(): LLMProviderOption[] {
  return Object.entries(PROVIDER_METADATA).map(([value, meta]) => ({
    value: value as LLMProviderName,
    label: meta.label,
    helper: meta.defaultModel,
  }));
}

export type { VaultMetadata, VaultMode };
