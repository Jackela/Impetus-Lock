import { useState } from "react";
import "./App.css";
import { EditorCore } from "./components/Editor/EditorCore";
import { ManualTriggerButton } from "./components/ManualTriggerButton";
import { AIActionType } from "./types/ai-actions";
import type { AgentMode } from "./hooks/useWritingState";

/**
 * Impetus Lock Main Application
 *
 * Production editor with full lock enforcement and AI intervention system.
 */
function App() {
  const [mode, setMode] = useState<AgentMode>("off");
  const [manualTrigger, setManualTrigger] = useState<AIActionType | null>(null);

  return (
    <div className="app">
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
            onTrigger={() => setManualTrigger(AIActionType.PROVOKE)}
          />
        </div>
      </header>

      <main className="app-main">
        <EditorCore
          mode={mode}
          initialContent="# Welcome to Impetus Lock\n\nStart writing..."
          externalTrigger={manualTrigger}
          onTriggerProcessed={() => setManualTrigger(null)}
        />
      </main>
    </div>
  );
}

export default App;
