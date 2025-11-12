import { useEffect, useMemo, useState } from "react";
import type { LLMConfig, LLMProviderName } from "../services/llmConfigStore";
import {
  PROVIDER_METADATA,
  getProviderLabel,
  getRecommendedModel,
} from "../services/llmConfigStore";
import "./LLMSettingsModal.css";

interface LLMSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: LLMConfig | null;
  onSave: (config: LLMConfig) => void;
  onClear: () => void;
}

export function LLMSettingsModal({ open, onClose, config, onSave, onClear }: LLMSettingsModalProps) {
  const [provider, setProvider] = useState<LLMProviderName>(config?.provider ?? "openai");
  const [model, setModel] = useState<string>(config?.model ?? getRecommendedModel("openai"));
  const [apiKey, setApiKey] = useState<string>(config?.apiKey ?? "");
  const [modelTouched, setModelTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider(config?.provider ?? "openai");
    setModel(config?.model ?? getRecommendedModel(config?.provider ?? "openai"));
    setApiKey(config?.apiKey ?? "");
    setModelTouched(false);
  }, [open, config?.provider, config?.model, config?.apiKey]);

  const providerOptions = useMemo(
    () =>
      Object.entries(PROVIDER_METADATA).map(([value, meta]) => ({
        value: value as LLMProviderName,
        label: meta.label,
        helper: meta.defaultModel,
      })),
    []
  );

  if (!open) return null;

  const recommendedModel = getRecommendedModel(provider);
  const canSave = Boolean(apiKey.trim());

  const handleProviderChange = (next: LLMProviderName) => {
    setProvider(next);
    setModel((prev) => {
      if (!modelTouched || prev === getRecommendedModel(provider)) {
        return getRecommendedModel(next);
      }
      return prev;
    });
    setModelTouched(false);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      provider,
      model: model.trim() || recommendedModel,
      apiKey: apiKey.trim(),
    });
    onClose();
  };

  const handleClear = () => {
    onClear();
    setApiKey("");
    setModel(getRecommendedModel(provider));
    setModelTouched(false);
  };

  return (
    <div className="llm-settings__backdrop" role="dialog" aria-modal="true">
      <div className="llm-settings__card">
        <header className="llm-settings__header">
          <div>
            <h2>LLM Settings</h2>
            <p>Keys are stored only in this browser and sent with each Muse/Loki request.</p>
          </div>
          <button type="button" className="llm-settings__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="llm-settings__body">
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
              placeholder={provider === "openai" ? "sk-proj-..." : provider === "anthropic" ? "sk-ant-..." : "AI..."}
              autoComplete="off"
              data-testid="llm-key-input"
            />
          </label>

          <div className="llm-settings__hint">
            Need an API key? Visit {getProviderLabel(provider)} docs for latest pricing and quotas.
          </div>
        </div>

        <footer className="llm-settings__footer">
          <button type="button" className="secondary" onClick={handleClear} disabled={!config}>
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
          </div>
        </footer>
      </div>
    </div>
  );
}
