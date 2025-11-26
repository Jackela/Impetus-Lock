import { useEffect, useMemo, useState } from "react";
import {
  getLLMProviderLabel,
  getLLMRecommendedModel,
  getLLMProviderDocs,
  getLLMProviderPricing,
  getLLMProviderOptions,
} from "../hooks/useLLMConfig";
import type { LLMConfig, LLMProviderName, VaultMetadata, VaultMode } from "../hooks/useLLMConfig";
import { useTelemetry } from "../hooks/useTelemetry";
import "./LLMSettingsModal.css";

interface LLMSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: LLMConfig | null;
  onSave: (config: LLMConfig) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  storageMode: VaultMode;
  onModeChange: (mode: VaultMode) => Promise<void> | void;
  locked: boolean;
  onUnlock: (passphrase: string) => Promise<void>;
  onLock: () => void;
  metadata?: VaultMetadata;
}

export function LLMSettingsModal({
  open,
  onClose,
  config,
  onSave,
  onClear,
  storageMode,
  onModeChange,
  locked,
  onUnlock,
  onLock,
  metadata,
}: LLMSettingsModalProps) {
  const { emitTelemetry } = useTelemetry();
  const [provider, setProvider] = useState<LLMProviderName>(config?.provider ?? "openai");
  const [model, setModel] = useState<string>(config?.model ?? getLLMRecommendedModel("openai"));
  const [apiKey, setApiKey] = useState<string>(config?.apiKey ?? "");
  const [modelTouched, setModelTouched] = useState(false);
  const [modeChoice, setModeChoice] = useState<VaultMode>(storageMode);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setProvider(config?.provider ?? "openai");
    setModel(config?.model ?? getLLMRecommendedModel(config?.provider ?? "openai"));
    setApiKey(config?.apiKey ?? "");
    setModelTouched(false);
    setModeChoice(storageMode);
    setPassphrase("");
    setPassphraseConfirm("");
    setUnlockError(null);
  }, [open, config?.provider, config?.model, config?.apiKey, storageMode]);

  const providerOptions = useMemo(() => getLLMProviderOptions(), []);

  if (!open) return null;

  const recommendedModel = getLLMRecommendedModel(provider);
  const apiKeyPattern =
    provider === "gemini"
      ? /^AI[a-zA-Z0-9_-]{10,}$/
      : provider === "anthropic"
        ? /^sk-ant-[a-zA-Z0-9_-]{8,}$/
        : /^sk-[a-zA-Z0-9_-]{10,}$/;
  const isKeyValid = apiKeyPattern.test(apiKey.trim());
  const requiresUnlock = modeChoice === "encrypted" && locked;
  const needsPassphraseSetup = modeChoice === "encrypted" && metadata?.hasPassphrase !== true;
  const wantsPassphraseRotation = modeChoice === "encrypted" && passphrase.length > 0;
  const requiresPassphraseInput = needsPassphraseSetup || wantsPassphraseRotation;
  const passphraseValid =
    modeChoice !== "encrypted" ||
    requiresUnlock ||
    !requiresPassphraseInput ||
    (passphrase.length >= 8 && passphrase === passphraseConfirm);
  const canSave = Boolean(apiKey.trim()) && isKeyValid && passphraseValid && !requiresUnlock;
  const showPassphraseConfirm = !requiresUnlock && requiresPassphraseInput;

  const handleProviderChange = (next: LLMProviderName) => {
    setProvider(next);
    setModel((prev) => {
      if (!modelTouched || prev === getLLMRecommendedModel(provider)) {
        return getLLMRecommendedModel(next);
      }
      return prev;
    });
    setModelTouched(false);
  };

  const handleModeChange = async (next: VaultMode) => {
    setModeChoice(next);
    setPassphrase("");
    setPassphraseConfirm("");
    setUnlockError(null);
    await onModeChange(next);
  };

  const handleSave = async () => {
    if (!canSave) return;
    if (modeChoice === "encrypted" && !locked && requiresPassphraseInput) {
      try {
        await onUnlock(passphrase);
      } catch {
        setUnlockError("Passphrase incorrect");
        return;
      }
    }
    await onSave({
      provider,
      model: model.trim() || recommendedModel,
      apiKey: apiKey.trim(),
    });
    emitTelemetry({
      event: "llm_config_saved",
      provider,
      payload: { model: model.trim() || recommendedModel },
    });
    setPassphrase("");
    setPassphraseConfirm("");
    setUnlockError(null);
    onClose();
  };

  const handleClear = async () => {
    await onClear();
    setApiKey("");
    setModel(getLLMRecommendedModel(provider));
    setModelTouched(false);
    setUnlockError(null);
    setPassphrase("");
    setPassphraseConfirm("");
    emitTelemetry({ event: "llm_config_cleared", provider });
  };

  const handleUnlock = async () => {
    try {
      await onUnlock(passphrase);
      setPassphrase("");
      setPassphraseConfirm("");
      setUnlockError(null);
    } catch {
      setUnlockError("Passphrase incorrect");
    }
  };

  return (
    <div className="llm-settings__backdrop" role="dialog" aria-modal="true">
      <div className="llm-settings__card">
        <header className="llm-settings__header">
          <div>
            <h2>LLM Settings</h2>
            <p>Keys are stored only in this browser and sent with each Muse/Loki request.</p>
          </div>
          <button
            type="button"
            className="llm-settings__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="llm-settings__body">
          <div className="llm-settings__tips">
            <strong>How this works</strong>
            <p>
              We send three HTTPS headers on each Muse/Loki call: provider, model, and your API key.
              Keys stay in this browser only and are never logged.
            </p>
            <p>
              Need a key? Read the provider guide below and follow the onboarding checklist on the
              left before triggering Muse/Loki.
            </p>
            <p>
              Storage mode: <strong>{modeChoice}</strong>
              {metadata?.updatedAt &&
                ` • Last saved ${new Date(metadata.updatedAt).toLocaleString()}`}
            </p>
            {modeChoice === "session" && (
              <p>Session mode clears data when you leave or stay idle for a few minutes.</p>
            )}
            {modeChoice === "encrypted" && (
              <p>
                {metadata?.hasPassphrase
                  ? "Encrypted mode requires your passphrase before loading or saving."
                  : "Set a passphrase before saving so we can encrypt your key (we never transmit it)."}
              </p>
            )}
          </div>

          <label className="llm-settings__field">
            <span>Storage Mode</span>
            <select
              value={modeChoice}
              onChange={(e) => handleModeChange(e.target.value as VaultMode)}
              data-testid="storage-mode-select"
            >
              <option value="local">Local (default)</option>
              <option value="encrypted">Encrypted with passphrase</option>
              <option value="session">Session only</option>
            </select>
          </label>

          <label className="llm-settings__field">
            <span>Provider</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProviderName)}
              data-testid="llm-provider-select"
            >
              {providerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Recommended model: {recommendedModel}</small>
            <div className="llm-settings__provider-docs">
              <a href={getLLMProviderDocs(provider)} target="_blank" rel="noreferrer">
                {getLLMProviderLabel(provider)} API docs ↗
              </a>
              <span>{getLLMProviderPricing(provider)}</span>
            </div>
          </label>

          <label className="llm-settings__field">
            <span>Model</span>
            <input
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setModelTouched(true);
              }}
              placeholder={recommendedModel}
              data-testid="llm-model-input"
            />
          </label>

          <label className="llm-settings__field">
            <span>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === "openai"
                  ? "sk-proj-..."
                  : provider === "anthropic"
                    ? "sk-ant-..."
                    : "AI..."
              }
              autoComplete="off"
              data-testid="llm-key-input"
            />
            {!isKeyValid && apiKey.trim().length > 0 && (
              <small className="llm-settings__error">Key format doesn’t match {provider}.</small>
            )}
          </label>

          {modeChoice === "encrypted" && (
            <label className="llm-settings__field">
              <span>{requiresUnlock ? "Enter passphrase to unlock" : "Set passphrase"}</span>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setUnlockError(null);
                }}
                placeholder="••••••••"
                autoComplete="new-password"
                data-testid="llm-passphrase-input"
              />
              {showPassphraseConfirm && (
                <input
                  type="password"
                  value={passphraseConfirm}
                  onChange={(e) => {
                    setPassphraseConfirm(e.target.value);
                    setUnlockError(null);
                  }}
                  placeholder="Confirm passphrase"
                  autoComplete="new-password"
                  data-testid="llm-passphrase-confirm-input"
                />
              )}
              {!requiresUnlock && requiresPassphraseInput && !passphraseValid && (
                <small className="llm-settings__error">
                  Passphrase must be at least 8 characters and match.
                </small>
              )}
              {requiresUnlock && (
                <button
                  type="button"
                  className="secondary"
                  onClick={handleUnlock}
                  disabled={!passphrase}
                >
                  Unlock
                </button>
              )}
              {unlockError && <small className="llm-settings__error">{unlockError}</small>}
            </label>
          )}

          <div className="llm-settings__hint">
            Need an API key? Visit {getLLMProviderLabel(provider)} docs for latest pricing and
            quotas.
          </div>
        </div>

        <footer className="llm-settings__footer">
          <button
            type="button"
            className="secondary"
            onClick={handleClear}
            disabled={!metadata?.updatedAt && !config}
          >
            Clear Key
          </button>
          <div className="llm-settings__actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="llm-settings-save"
            >
              Save
            </button>
            <button type="button" className="secondary" onClick={onLock}>
              Lock Session
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
