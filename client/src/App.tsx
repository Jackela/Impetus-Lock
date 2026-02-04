import { useCallback, useEffect, useRef, useState } from "react";
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
import { INITIAL_STORY } from "./constants/initialStory";
import { TelemetryToggle } from "./components/TelemetryToggle";
import { OnboardingChecklist } from "./components/OnboardingChecklist";
import { useTaskSync } from "./hooks/useTaskSync";
import { TaskList } from "./components/TaskList/TaskList";
import { useTasks } from "./hooks/useTasks";
import type { TaskRecord } from "./types/task";
import { NewTaskButton } from "./components/NewTaskButton";
import { CreateTaskModal } from "./components/CreateTaskModal";

/**
 * Impetus Lock Main Application
 *
 * Production editor with full lock enforcement and AI intervention system.
 */
function App() {
  // ST-001: Track the task being edited (must be declared before useTaskSync)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const {
    content: taskContent,
    lockIds: taskLocks,
    taskId,
    version: taskVersion,
    status: taskStatus,
    error: taskError,
    isSaving,
    onChange: handleTaskChange,
  } = useTaskSync(INITIAL_STORY, { externalTaskId: editingTaskId });

  const [mode, setMode] = useState<AgentMode>("off");
  const [manualTrigger, setManualTrigger] = useState<AIActionType | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfigError, setShowConfigError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastLLMError, setLastLLMError] = useState<InterventionAPIError | null>(null);

  // UX-003: Task list integration
  const [showTaskList, setShowTaskList] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  // UX-010: Create task modal state
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  // Fetch task list with refetch for new task creation
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch } = useTasks();
  const {
    config: llmConfig,
    isConfigured,
    saveConfig,
    clearConfig,
    mode: storageMode,
    setMode: setStorageMode,
    locked: vaultLocked,
    unlock,
    lock,
    metadata,
  } = useLLMConfig();
  const [llmFeedback, setLLMFeedback] = useState<string | null>(null);
  const feedbackTimeout = useRef<number | null>(null);

  // T005: Timer state for Muse mode indicator
  const [timerRemaining, setTimerRemaining] = useState<number>(60);

  // Keyboard shortcut: "?" to re-open welcome modal
  // UX-003: "Alt+T" to toggle task list sidebar
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle task list with Alt+T
      if (e.key === "t" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowTaskList((prev) => !prev);
        return;
      }

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

  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) {
        window.clearTimeout(feedbackTimeout.current);
      }
    };
  }, []);

  const handleForgetKey = useCallback(async () => {
    await clearConfig();
    if (feedbackTimeout.current) {
      window.clearTimeout(feedbackTimeout.current);
    }
    setLLMFeedback("LLM key cleared");
    feedbackTimeout.current = window.setTimeout(() => {
      setLLMFeedback(null);
    }, 3000);
  }, [clearConfig]);

  // ST-001: Handle task selection from list - load task into editor
  const handleTaskClick = useCallback(
    (task: TaskRecord) => {
      setSelectedTask(task);
      setEditingTaskId(task.id);
    },
    []
  );

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
        storageMode={storageMode}
        onModeChange={setStorageMode}
        locked={vaultLocked}
        onUnlock={unlock}
        onLock={lock}
        metadata={metadata}
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
      {/* UX-010: Create task modal */}
      <CreateTaskModal
        open={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        onSuccess={() => {
          // Refetch task list after successful creation
          refetch();
        }}
      />

      <header className="app-header">
        <div className="header-left">
          <h1>Impetus Lock</h1>
          <button
            type="button"
            className={`task-list-toggle ${showTaskList ? "active" : ""}`}
            onClick={() => setShowTaskList((prev) => !prev)}
            aria-pressed={showTaskList}
            title="Toggle task list (Alt+T)"
            data-testid="task-list-toggle"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className="toggle-label">Tasks</span>
          </button>
        </div>
        <div className="header-actions">
          <TelemetryToggle />
          <span className="task-status" role="status">
            {taskStatus === "loading" ? "Loading draft…" : isSaving ? "Saving…" : "Synced"}
          </span>
          {taskError && (
            <span className="task-error" role="alert">
              {taskError}
            </span>
          )}
          <button
            type="button"
            className="secondary"
            onClick={lock}
            data-testid="lock-session-button"
          >
            Lock Session
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void handleForgetKey();
            }}
            disabled={!isConfigured}
            aria-disabled={!isConfigured}
            data-testid="forget-llm-key-button"
          >
            Forget Key
          </button>
          {llmFeedback && (
            <span className="llm-feedback" role="status">
              {llmFeedback}
            </span>
          )}
        </div>
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
              : "LLM Settings"}
          </button>
        </div>
      </header>

      <main className="app-main" role="main">
        {/* UX-003: Task list sidebar */}
        {showTaskList && (
          <aside className="task-sidebar" data-testid="task-sidebar">
            <div className="task-sidebar-header">
              <h2>Tasks</h2>
              {tasksError && (
                <span className="task-sidebar-error" role="alert">
                  Failed to load
                </span>
              )}
            </div>
            {tasksLoading ? (
              <div className="task-sidebar-loading" role="status">
                Loading tasks…
              </div>
            ) : (
              <TaskList
                tasks={tasks}
                onTaskClick={handleTaskClick}
                selectedTaskId={selectedTask?.id}
              />
            )}
          </aside>
        )}

        {/* Editor area */}
        <div className="editor-area">
          {/* T005: Timer indicator for Muse mode */}
          <TimerIndicator
            progress={timerProgress}
            visible={mode === "muse"}
            remainingTime={timerRemaining}
          />
          <OnboardingChecklist />
          <EditorCore
            key={`${taskId ?? "local"}:${taskVersion}`}
            mode={mode}
            initialContent={taskContent}
            initialLocks={taskLocks}
            externalTrigger={manualTrigger}
            onTriggerProcessed={() => setManualTrigger(null)}
            onTimerUpdate={setTimerRemaining}
            onInterventionError={handleInterventionError}
            onChange={handleTaskChange}
          />
        </div>
      </main>

      <footer className="app-footer">
        Press <kbd>?</kbd> for help
      </footer>

      {/* UX-010: New task button (FAB) */}
      <NewTaskButton
        onClick={() => setShowCreateTaskModal(true)}
        ariaLabel="Create new task"
      />
    </div>
  );
}

export default App;
