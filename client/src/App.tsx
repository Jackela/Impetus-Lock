import { useCallback, useEffect, useState } from "react";
import "./App.css";
import "./styles/variables.css";
import "./styles/responsive.css";
import "./styles/timer-indicator.css";
import "./styles/locked-content.css";
import { EditorCore } from "./components/Editor/EditorCore";
import { ManualTriggerButton } from "./components/ManualTriggerButton";
import { WelcomeModal } from "./components/WelcomeModal";
import { TimerIndicator } from "./components/TimerIndicator";
import { AIActionType } from "./types/ai-actions";
import type { AgentMode } from "./hooks/useWritingState";
import { ConfigErrorModal } from "./components/ConfigErrorModal";
import { useLLMConfig, getLLMProviderLabel } from "./hooks/useLLMConfig";
import { LLMSettingsModal } from "./components/LLMSettingsModal";
import { isInterventionAPIError, type InterventionAPIError } from "./hooks/useInterventionApiError";

/**
 * Impetus Lock Main Application
 *
 * Production editor with full lock enforcement and AI intervention system.
 */
function App() {
  const [mode, setMode] = useState<AgentMode>("off");
  const [manualTrigger, setManualTrigger] = useState<AIActionType | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfigError, setShowConfigError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastLLMError, setLastLLMError] = useState<InterventionAPIError | null>(null);
  const { config: llmConfig, isConfigured, saveConfig, clearConfig } = useLLMConfig();

  // T005: Timer state for Muse mode indicator
  const [timerRemaining, setTimerRemaining] = useState<number>(60);

  // Keyboard shortcut: "?" to re-open welcome modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only trigger if not typing in editor
        const target = e.target as HTMLElement;
        if (
          target.tagName !== "INPUT" &&
          target.tagName !== "TEXTAREA" &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          setShowWelcome(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Calculate progress percentage for timer indicator (0-100%)
  const timerProgress = ((60 - timerRemaining) / 60) * 100;

  const handleInterventionError = useCallback((error: Error) => {
    if (isInterventionAPIError(error)) {
      setLastLLMError(error);
      setShowConfigError(true);
    }
  }, []);

  return (
    <div
      className="app"
      data-testid="app-root"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <WelcomeModal forceShow={showWelcome} onDismiss={() => setShowWelcome(false)} />
      <LLMSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        config={llmConfig}
        onSave={saveConfig}
        onClear={clearConfig}
      />
      <ConfigErrorModal
        visible={showConfigError}
        onDismiss={() => setShowConfigError(false)}
        onOpenSettings={() => {
          setShowConfigError(false);
          setShowSettings(true);
        }}
        errorCode={lastLLMError?.errorCode}
        errorMessage={lastLLMError?.message}
        provider={
          (typeof lastLLMError?.details === "object" &&
            lastLLMError?.details !== null &&
            "provider" in (lastLLMError?.details as Record<string, unknown>) &&
            String((lastLLMError?.details as Record<string, unknown>).provider)) ||
          llmConfig?.provider ||
          null
        }
      />

      {/* T005: Timer indicator for Muse mode */}
      <TimerIndicator
        progress={timerProgress}
        visible={mode === "muse"}
        remainingTime={timerRemaining}
      />

      <header className="app-header">
        <h1>Impetus Lock</h1>
        <div className="controls">
          <label htmlFor="mode-selector">AI Mode:</label>
          <select
            id="mode-selector"
            data-testid="mode-selector"
            value={mode}
            onChange={(e) => setMode(e.target.value as AgentMode)}
          >
            <option value="off">Off</option>
            <option value="muse">Muse</option>
            <option value="loki">Loki</option>
          </select>
          <ManualTriggerButton
            mode={mode}
            onTrigger={(actionType) => setManualTrigger(actionType)}
          />
          <button
            type="button"
            className={`llm-settings-trigger ${isConfigured ? "configured" : ""}`}
            onClick={() => setShowSettings(true)}
            data-testid="llm-settings-trigger"
          >
            {isConfigured && llmConfig
              ? `LLM: ${getLLMProviderLabel(llmConfig.provider)}`
              : "LLM 设置"}
          </button>
        </div>
      </header>

      <main className="app-main" role="main">
        <EditorCore
          mode={mode}
          initialContent=""
          externalTrigger={manualTrigger}
          onTriggerProcessed={() => setManualTrigger(null)}
          onTimerUpdate={setTimerRemaining}
          onInterventionError={handleInterventionError}
        />
      </main>

      <footer className="app-footer">
        Press <kbd>?</kbd> for help
      </footer>
    </div>
  );
}

export default App;
