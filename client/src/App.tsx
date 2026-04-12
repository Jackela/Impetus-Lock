import { useState, useCallback, useEffect } from "react";
import "./App.css";
import "./styles/variables.css";
import "./styles/responsive.css";
import "./styles/timer-indicator.css";
import "./styles/locked-content.css";

import { EditorCore } from "./components/Editor/EditorCore";
import { TimerIndicator } from "./components/TimerIndicator";
import { AIActionType } from "./types/ai-actions";
import type { AgentMode } from "./hooks/useWritingState";
import { useLLMConfig, getLLMProviderLabel } from "./hooks/useLLMConfig";
import { isInterventionAPIError } from "./hooks/useInterventionApiError";
import { INITIAL_STORY } from "./constants/initialStory";
import { useTaskSync } from "./hooks/useTaskSync";
import type { TaskRecord } from "./types/task";
import { useTasks } from "./hooks/useTasks";
import { useAppState } from "./AppState";
import { AppLayout } from "./AppLayout";
import { AppModals } from "./AppModals";

function App() {
  const [mode, setMode] = useState<AgentMode>("off");
  const [manualTrigger, setManualTrigger] = useState<AIActionType | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);

  const {
    sidebarOpen,
    showWelcome,
    setShowWelcome,
    showConfigError,
    setShowConfigError,
    showSettings,
    setShowSettings,
    showCreateTaskModal,
    setShowCreateTaskModal,
    showStyleLearning,
    setShowStyleLearning,
    lastLLMError,
    setLastLLMError,
    llmFeedback,
    showFeedback,
    timerRemaining,
    setTimerRemaining,
    toggleSidebar,
  } = useAppState();

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

  const { refetch } = useTasks();

  // Keyboard shortcut: "?" to re-open welcome modal
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
  }, [setShowWelcome]);

  const handleInterventionError = useCallback(
    (error: Error) => {
      if (isInterventionAPIError(error)) {
        setLastLLMError(error);
        setShowConfigError(true);
      }
    },
    [setLastLLMError, setShowConfigError]
  );

  const handleForgetKey = useCallback(async () => {
    await clearConfig();
    showFeedback("LLM key cleared");
  }, [clearConfig, showFeedback]);

  const handleTaskClick = useCallback((task: TaskRecord) => {
    setSelectedTask(task);
    setEditingTaskId(task.id);
  }, []);

  const handleManualTrigger = useCallback((actionType: AIActionType) => {
    setManualTrigger(actionType);
  }, []);

  const handleTriggerProcessed = useCallback(() => {
    setManualTrigger(null);
  }, []);

  const timerProgress = ((60 - timerRemaining) / 60) * 100;

  return (
    <>
      <AppLayout
        mode={mode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onModeChange={setMode}
        onManualTrigger={handleManualTrigger}
        onTaskClick={handleTaskClick}
        selectedTaskId={selectedTask?.id}
        taskStatus={
          taskStatus === "loading"
            ? "loading"
            : isSaving
              ? "saving"
              : taskError
                ? "error"
                : "synced"
        }
        isSaving={isSaving}
        taskError={taskError}
        onCreateTask={() => setShowCreateTaskModal(true)}
        onShowSettings={() => setShowSettings(true)}
        onLockSession={lock}
        onForgetKey={handleForgetKey}
        onShowStyleLearning={() => setShowStyleLearning((prev) => !prev)}
        showStyleLearning={showStyleLearning}
        llmFeedback={llmFeedback}
        isConfigured={isConfigured}
        llmProviderLabel={llmConfig ? getLLMProviderLabel(llmConfig.provider) : null}
        timerProgress={timerProgress}
        timerRemaining={timerRemaining}
      >
        <TimerIndicator
          progress={timerProgress}
          visible={mode === "muse"}
          remainingTime={timerRemaining}
        />
        <EditorCore
          key={taskId ?? "local"}
          contentVersion={taskVersion}
          mode={mode}
          initialContent={taskContent}
          initialLocks={taskLocks}
          externalTrigger={manualTrigger}
          onTriggerProcessed={handleTriggerProcessed}
          onTimerUpdate={setTimerRemaining}
          onInterventionError={handleInterventionError}
          onChange={handleTaskChange}
        />
      </AppLayout>

      <AppModals
        showWelcome={showWelcome}
        onDismissWelcome={() => setShowWelcome(false)}
        showConfigError={showConfigError}
        onDismissConfigError={() => setShowConfigError(false)}
        onOpenSettingsFromError={() => {
          setShowConfigError(false);
          setShowSettings(true);
        }}
        lastLLMError={lastLLMError}
        showSettings={showSettings}
        onCloseSettings={() => setShowSettings(false)}
        llmConfig={llmConfig}
        storageMode={storageMode}
        vaultLocked={vaultLocked}
        metadata={metadata}
        onSaveConfig={saveConfig}
        onClearConfig={clearConfig}
        onStorageModeChange={setStorageMode}
        onUnlock={unlock}
        onLock={lock}
        showCreateTaskModal={showCreateTaskModal}
        onCloseCreateTaskModal={() => setShowCreateTaskModal(false)}
        onTaskCreated={refetch}
        currentProvider={llmConfig?.provider ?? null}
      />
    </>
  );
}

export default App;
