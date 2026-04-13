import { useEffect } from "react";
import { ManualTriggerButton } from "./components/ManualTriggerButton";
import { TelemetryToggle } from "./components/TelemetryToggle";
import { TaskList } from "./components/TaskList/TaskList";
import { Skeleton } from "./components/Skeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OnboardingChecklist } from "./components/OnboardingChecklist";
import { NewTaskButton } from "./components/NewTaskButton";
import { StyleLearningPanel } from "./components/StyleLearning/StyleLearningPanel";
import { ThemeToggle } from "./components/ThemeToggle/ThemeToggle";
import { Stats } from "./components/Stats/Stats";
import { Achievements } from "./components/Achievements/Achievements";
import { Export } from "./components/Export/Export";
import { useTasks } from "./hooks/useTasks";
import type { TaskRecord } from "./types/task";
import type { AgentMode } from "./hooks/useWritingState";
import { AIActionType } from "./types/ai-actions";

interface AppLayoutProps {
  children: React.ReactNode;
  mode: AgentMode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onModeChange: (mode: AgentMode) => void;
  onManualTrigger: (action: AIActionType) => void;
  onTaskClick: (task: TaskRecord) => void;
  selectedTaskId?: string | null;
  taskStatus: "loading" | "saving" | "synced" | "error";
  isSaving: boolean;
  taskError: string | null;
  onCreateTask: () => void;
  onShowSettings: () => void;
  onLockSession: () => void;
  onForgetKey: () => void;
  onShowStyleLearning: () => void;
  showStyleLearning: boolean;
  llmFeedback: string | null;
  isConfigured: boolean;
  llmProviderLabel?: string | null;
  showStats: boolean;
  onToggleStats: () => void;
  showAchievements: boolean;
  onToggleAchievements: () => void;
}

export function AppLayout({
  children,
  mode,
  sidebarOpen,
  onToggleSidebar,
  onModeChange,
  onManualTrigger,
  onTaskClick,
  selectedTaskId,
  taskStatus,
  isSaving,
  taskError,
  onCreateTask,
  onShowSettings,
  onLockSession,
  onForgetKey,
  onShowStyleLearning,
  showStyleLearning,
  llmFeedback,
  isConfigured,
  llmProviderLabel,
  showStats,
  onToggleStats,
  showAchievements,
  onToggleAchievements,
}: AppLayoutProps) {
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useTasks();

  // Keyboard shortcut: "?" to re-open welcome modal, Alt+T to toggle task list
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "t" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onToggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onToggleSidebar]);

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
      <header className="app-header">
        <div className="header-left">
          <h1>Impetus Lock</h1>
          <div className={`header-waveform ${mode !== "off" ? "header-waveform--active" : ""}`}>
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
            <div className="header-waveform__bar" />
          </div>
          <button
            type="button"
            className={`task-list-toggle ${sidebarOpen ? "active" : ""}`}
            onClick={onToggleSidebar}
            aria-pressed={sidebarOpen}
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
          <button
            type="button"
            className={`style-learning-toggle ${showStyleLearning ? "active" : ""}`}
            onClick={onShowStyleLearning}
            aria-pressed={showStyleLearning}
            title="Toggle Style Learning"
            data-testid="style-learning-toggle"
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
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="toggle-label">Style</span>
          </button>
          <button
            type="button"
            className={`stats-toggle ${showStats ? "active" : ""}`}
            onClick={onToggleStats}
            aria-pressed={showStats}
            title="Toggle Stats"
            data-testid="stats-toggle"
          >
            <span className="toggle-label">Stats</span>
          </button>
          <button
            type="button"
            className={`achievements-toggle ${showAchievements ? "active" : ""}`}
            onClick={onToggleAchievements}
            aria-pressed={showAchievements}
            title="Toggle Achievements"
            data-testid="achievements-toggle"
          >
            <span className="toggle-label">🏆</span>
          </button>
        </div>

        <div className="header-actions">
          <ThemeToggle />
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
            onClick={onLockSession}
            data-testid="lock-session-button"
          >
            Lock Session
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onForgetKey}
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
            onChange={(e) => onModeChange(e.target.value as AgentMode)}
          >
            <option value="off">Off</option>
            <option value="muse">Muse</option>
            <option value="loki">Loki</option>
          </select>
          <ManualTriggerButton mode={mode} onTrigger={onManualTrigger} />
          <button
            type="button"
            className={`llm-settings-trigger ${isConfigured ? "configured" : ""}`}
            onClick={onShowSettings}
            data-testid="llm-settings-trigger"
          >
            {isConfigured && llmProviderLabel ? `LLM: ${llmProviderLabel}` : "LLM Settings"}
          </button>
        </div>
      </header>

      <main className="app-main" role="main">
        <ErrorBoundary>
          {sidebarOpen && (
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
                <div className="task-sidebar-skeleton" role="status" aria-label="Loading tasks">
                  <Skeleton lines={5} height="48px" />
                </div>
              ) : (
                <TaskList tasks={tasks} onTaskClick={onTaskClick} selectedTaskId={selectedTaskId} />
              )}
            </aside>
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="editor-area">
            <OnboardingChecklist />
            {children}
          </div>
        </ErrorBoundary>
      </main>

      <footer className="app-footer">
        Press <kbd>?</kbd> for help | <Export />
      </footer>

      {showStats && (
        <div className="stats-overlay" data-testid="stats-overlay">
          <div className="stats-modal">
            <Stats />
            <button
              type="button"
              className="close-button"
              onClick={onToggleStats}
              aria-label="Close Stats"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showAchievements && (
        <div className="achievements-overlay" data-testid="achievements-overlay">
          <div className="achievements-modal">
            <Achievements />
            <button
              type="button"
              className="close-button"
              onClick={onToggleAchievements}
              aria-label="Close Achievements"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showStyleLearning && (
        <div className="style-learning-overlay" data-testid="style-learning-overlay">
          <div className="style-learning-modal">
            <StyleLearningPanel userId="default-user" />
            <button
              type="button"
              className="close-button"
              onClick={onShowStyleLearning}
              aria-label="Close Style Learning"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <NewTaskButton onClick={onCreateTask} ariaLabel="Create new task" />
    </div>
  );
}
