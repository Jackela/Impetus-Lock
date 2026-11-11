import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { ManualTriggerButton } from "./components/ManualTriggerButton";
import { TelemetryToggle } from "./components/TelemetryToggle";
import { TaskList } from "./components/TaskList/TaskList";
import { Skeleton } from "./components/Skeleton";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NewTaskButton } from "./components/NewTaskButton";
import { ThemeToggle } from "./components/ThemeToggle/ThemeToggle";
import { Export } from "./components/Export/Export";
import {
  Button,
  ChartIcon,
  CloseIcon,
  DownloadIcon,
  IconButton,
  KeyIcon,
  LayersIcon,
  ListIcon,
  LockIcon,
  Modal,
  MoreIcon,
  SlidersIcon,
  TrophyIcon,
} from "./components/ui";
import { useTasks } from "./hooks/useTasks";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useFocusTrap } from "./hooks/useFocusTrap";
import type { TaskRecord } from "./types/task";
import type { AgentMode } from "./hooks/useWritingState";
import { AIActionType } from "./types/ai-actions";
import { useOptionalAuth } from "./contexts/AuthContext";

/**
 * Overlay panels are user-triggered only, so they are split out of the first
 * paint and fetched the first time their overlay opens. `EditorCore` stays a
 * static import: it is the product surface and must never wait on a chunk.
 */
const Stats = lazy(() =>
  import("./components/Stats/Stats").then((module) => ({ default: module.Stats }))
);
const Achievements = lazy(() =>
  import("./components/Achievements/Achievements").then((module) => ({
    default: module.Achievements,
  }))
);
const StyleLearningPanel = lazy(() =>
  import("./components/StyleLearning/StyleLearningPanel").then((module) => ({
    default: module.StyleLearningPanel,
  }))
);
const ExportModal = lazy(() =>
  import("./components/Export/ExportModal").then((module) => ({ default: module.ExportModal }))
);

/**
 * Quiet placeholder for a deferred overlay — announces nothing on first paint.
 *
 * @returns A small skeleton block sized like the panel it stands in for
 */
function DeferredPanelFallback() {
  return <Skeleton lines={3} height="32px" />;
}

interface AppLayoutProps {
  children: React.ReactNode;
  mode: AgentMode;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onModeChange: (mode: AgentMode) => void;
  onManualTrigger: (action: AIActionType) => void;
  onTaskClick: (task: TaskRecord) => void;
  selectedTaskId?: string | null;
  taskStatus: "loading" | "saving" | "synced" | "error" | "local" | "unsaved";
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
  content: string;
}

/** Save/connection state behind the header status pill. */
type StatusState = "loading" | "saving" | "synced" | "unsaved" | "error" | "offline";

/** Short, single-word status copy per state — never wraps in the header. */
const STATUS_LABEL: Record<StatusState, string> = {
  loading: "Loading…",
  saving: "Saving…",
  synced: "Saved",
  unsaved: "Unsaved",
  error: "Save failed",
  offline: "Offline",
};

/**
 * Resolves the header status pill state from the draft sync props.
 *
 * @param taskStatus - Aggregate draft status reported by the sync layer
 * @param isSaving - Whether a save request is currently in flight
 * @returns The status state used for the pill copy and the signal dot colour
 */
function resolveStatusState(
  taskStatus: AppLayoutProps["taskStatus"],
  isSaving: boolean
): StatusState {
  if (taskStatus === "loading") return "loading";
  if (taskStatus === "local") return "offline";
  if (taskStatus === "error") return "error";
  if (isSaving || taskStatus === "saving") return "saving";
  if (taskStatus === "unsaved") return "unsaved";
  return "synced";
}

/**
 * Top-level layout rendering the header, task sidebar, editor area, and overlays.
 *
 * **Header information architecture**:
 * - Left: brand name plus the decorative waveform (7 bars)
 * - Center: the single AI mode control (Off / Muse / Loki)
 * - Right: save/connection status and one `⋯` overflow menu
 * - Everything else lives in the overflow menu; developer-only triggers are
 *   collapsed inside a `Dev tools` region that only exists in `import.meta.env.DEV`
 *
 * @param root0 - Component props
 * @param root0.children - Editor content rendered inside the main area
 * @param root0.mode - Current agent mode ("off", "muse", or "loki")
 * @param root0.sidebarOpen - Whether the task sidebar is visible
 * @param root0.onToggleSidebar - Callback to toggle the task sidebar
 * @param root0.onModeChange - Callback to change the agent mode
 * @param root0.onManualTrigger - Callback to fire a manual AI action
 * @param root0.onTaskClick - Callback when a task is selected in the list
 * @param root0.selectedTaskId - Currently selected task id, if any
 * @param root0.taskStatus - Aggregate draft sync status shown in the header
 * @param root0.isSaving - Whether the draft is currently being saved
 * @param root0.taskError - Error message for draft sync, if any
 * @param root0.onCreateTask - Callback to open the create-task modal
 * @param root0.onShowSettings - Callback to open LLM settings
 * @param root0.onLockSession - Callback to lock the LLM key vault
 * @param root0.onForgetKey - Callback to clear the stored LLM key
 * @param root0.onShowStyleLearning - Callback to toggle the style learning panel
 * @param root0.showStyleLearning - Whether the style learning overlay is visible
 * @param root0.llmFeedback - Transient feedback message shown in the menu
 * @param root0.isConfigured - Whether an LLM provider is configured
 * @param root0.llmProviderLabel - Display label for the active LLM provider
 * @param root0.showStats - Whether the stats overlay is visible
 * @param root0.onToggleStats - Callback to toggle the stats overlay
 * @param root0.showAchievements - Whether the achievements overlay is visible
 * @param root0.onToggleAchievements - Callback to toggle the achievements overlay
 * @param root0.content - Current document content for export
 * @returns The rendered application layout
 */
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
  content,
}: AppLayoutProps) {
  const auth = useOptionalAuth();
  const remoteEnabled = auth?.remoteEnabled ?? true;
  const { data: tasks, isLoading: tasksLoading, error: tasksError, refetch } = useTasks();
  const [showExportModal, setShowExportModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const sheetOpen = sidebarOpen && isMobile;

  const headerRef = useRef<HTMLElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sheetFocus = useFocusTrap<HTMLElement>({ active: sheetOpen });

  const statusState = resolveStatusState(taskStatus, isSaving);

  const focusMenuTrigger = useCallback(() => {
    menuAnchorRef.current?.querySelector<HTMLButtonElement>(".header-menu-trigger")?.focus();
  }, []);

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      setMenuOpen(false);
      if (restoreFocus) focusMenuTrigger();
    },
    [focusMenuTrigger]
  );

  /** Runs a menu command, closes the menu, and parks focus on the trigger. */
  const runMenuAction = useCallback(
    (action: () => void) => () => {
      setMenuOpen(false);
      focusMenuTrigger();
      action();
    },
    [focusMenuTrigger]
  );

  // Move focus into the menu when it opens, and close it on outside presses.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && menuAnchorRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setMenuOpen(false);
      focusMenuTrigger();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, focusMenuTrigger]);

  // Arrow-key navigation across the header menu.
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
      ) ?? []
    );
    if (items.length === 0) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items[items.length - 1]?.focus();
    else if (event.key === "ArrowDown") items[(current + 1) % items.length]?.focus();
    else items[(current <= 0 ? items.length : current) - 1]?.focus();
  };

  // Keyboard shortcut: Alt+T to toggle the task list
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

  // Mobile sheet: mark the background inert and lock scrolling while open.
  useEffect(() => {
    if (!sheetOpen) return;

    const background = [headerRef.current, editorAreaRef.current].filter(
      (node): node is HTMLElement => node !== null
    );
    background.forEach((node) => {
      node.setAttribute("inert", "");
      node.setAttribute("aria-hidden", "true");
    });

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      background.forEach((node) => {
        node.removeAttribute("inert");
        node.removeAttribute("aria-hidden");
      });
      body.style.overflow = previousOverflow;
    };
  }, [sheetOpen]);

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
      <header className="app-header" ref={headerRef}>
        <div className="header-left">
          <div className="header-brand">
            <h1>Impetus Lock</h1>
            <div
              className={`header-waveform ${mode !== "off" ? "header-waveform--active" : ""}`}
              aria-hidden="true"
            >
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
              <div className="header-waveform__bar" />
            </div>
          </div>
        </div>

        <div className="header-center">
          <label className="header-mode-label" htmlFor="mode-selector">
            AI Mode
          </label>
          <select
            id="mode-selector"
            data-testid="mode-selector"
            className="header-mode-select"
            disabled={!remoteEnabled}
            value={mode}
            onChange={(e) => onModeChange(e.target.value as AgentMode)}
          >
            <option value="off">Off</option>
            <option value="muse">Muse</option>
            <option value="loki">Loki</option>
          </select>
        </div>

        <div className="header-actions">
          <span className="task-status" role="status" data-state={statusState}>
            <span className="task-status__dot" aria-hidden="true" />
            <span className="task-status__text">{STATUS_LABEL[statusState]}</span>
          </span>

          <div className="header-menu-anchor" ref={menuAnchorRef}>
            <IconButton
              ariaLabel="Open main menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="header-menu-trigger"
              data-testid="header-menu-button"
              size="sm"
              onClick={() => (menuOpen ? closeMenu(true) : setMenuOpen(true))}
            >
              <MoreIcon size={20} />
            </IconButton>

            {menuOpen && (
              <div className="header-menu" ref={menuRef} onKeyDown={handleMenuKeyDown}>
                <div className="header-menu__items" role="menu" aria-label="Main menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={`header-menu__item task-list-toggle ${sidebarOpen ? "active" : ""}`}
                    onClick={runMenuAction(onToggleSidebar)}
                    title="Toggle task list (Alt+T)"
                    data-testid="task-list-toggle"
                  >
                    <ListIcon size={18} />
                    <span>Tasks</span>
                    <kbd className="header-menu__hint">Alt+T</kbd>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className={`header-menu__item style-learning-toggle ${showStyleLearning ? "active" : ""}`}
                    onClick={runMenuAction(onShowStyleLearning)}
                    title="Toggle Style Learning"
                    data-testid="style-learning-toggle"
                  >
                    <LayersIcon size={18} />
                    <span>Style</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className={`header-menu__item stats-toggle ${showStats ? "active" : ""}`}
                    onClick={runMenuAction(onToggleStats)}
                    title="Toggle Stats"
                    data-testid="stats-toggle"
                  >
                    <ChartIcon size={18} />
                    <span>Stats</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className={`header-menu__item achievements-toggle ${showAchievements ? "active" : ""}`}
                    onClick={runMenuAction(onToggleAchievements)}
                    aria-label="Achievements"
                    title="Toggle Achievements"
                    data-testid="achievements-toggle"
                  >
                    <TrophyIcon size={18} />
                    <span>Achievements</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu__item"
                    onClick={runMenuAction(() => setShowExportModal(true))}
                    data-testid="export-button"
                  >
                    <DownloadIcon size={18} />
                    <span>Export</span>
                  </button>

                  <div className="header-menu__divider" role="separator" />

                  <ThemeToggle role="menuitem" className="header-menu__item" showLabel />

                  <TelemetryToggle role="menuitem" className="header-menu__item" />

                  <div className="header-menu__divider" role="separator" />

                  <button
                    type="button"
                    role="menuitem"
                    className={`header-menu__item llm-settings-trigger ${isConfigured ? "configured" : ""}`}
                    onClick={runMenuAction(onShowSettings)}
                    data-testid="llm-settings-trigger"
                  >
                    <SlidersIcon size={18} />
                    <span>
                      {isConfigured && llmProviderLabel
                        ? `LLM: ${llmProviderLabel}`
                        : "LLM Settings"}
                    </span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu__item"
                    onClick={runMenuAction(onLockSession)}
                    data-testid="lock-session-button"
                  >
                    <LockIcon size={18} />
                    <span>Lock Session</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="header-menu__item"
                    onClick={runMenuAction(onForgetKey)}
                    disabled={!isConfigured}
                    aria-disabled={!isConfigured}
                    data-testid="forget-llm-key-button"
                  >
                    <KeyIcon size={18} />
                    <span>Forget Key</span>
                  </button>
                </div>

                {taskError && (
                  <p className="task-error header-menu__alert" role="alert">
                    {taskError}
                  </p>
                )}

                {llmFeedback && (
                  <p className="llm-feedback header-menu__alert" role="status">
                    {llmFeedback}
                  </p>
                )}

                {import.meta.env.DEV ? (
                  <details className="header-menu__dev" data-testid="header-dev-region">
                    <summary className="header-menu__dev-summary">Dev tools</summary>
                    <ManualTriggerButton
                      mode={remoteEnabled ? mode : "off"}
                      onTrigger={onManualTrigger}
                    />
                  </details>
                ) : (
                  <div className="header-menu__manual">
                    <ManualTriggerButton
                      mode={remoteEnabled ? mode : "off"}
                      onTrigger={onManualTrigger}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main" role="main">
        {sheetOpen && (
          <div
            className="task-sidebar-backdrop"
            data-testid="task-sidebar-backdrop"
            aria-hidden="true"
            onClick={onToggleSidebar}
          />
        )}

        <ErrorBoundary>
          {sidebarOpen && (
            <aside
              className="task-sidebar"
              data-testid="task-sidebar"
              ref={sheetFocus.ref}
              role={sheetOpen ? "dialog" : undefined}
              aria-modal={sheetOpen ? "true" : undefined}
              aria-label={sheetOpen ? "Tasks" : undefined}
            >
              <div className="task-sidebar-header">
                <h2>Tasks</h2>
                <IconButton
                  ariaLabel="Close task list"
                  className="task-sidebar-close"
                  size="sm"
                  onClick={onToggleSidebar}
                >
                  <CloseIcon size={18} />
                </IconButton>
              </div>
              {tasksLoading ? (
                <div className="task-sidebar-skeleton" role="status" aria-label="Loading tasks">
                  <Skeleton lines={5} height="48px" />
                </div>
              ) : tasksError ? (
                <div className="task-sidebar-state" data-testid="task-sidebar-error">
                  <h3>Couldn’t load your tasks</h3>
                  <p role="alert">The task list could not be fetched. Your draft is still safe.</p>
                  <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <TaskList
                  tasks={tasks}
                  onTaskClick={onTaskClick}
                  selectedTaskId={selectedTaskId ?? undefined}
                  onCreateTask={onCreateTask}
                />
              )}
            </aside>
          )}
        </ErrorBoundary>

        <ErrorBoundary>
          <div className="editor-area" ref={editorAreaRef}>
            {children}
          </div>
        </ErrorBoundary>
      </main>

      <footer className="app-footer">
        Press <kbd>?</kbd> for help | <Export />
      </footer>

      <Modal
        open={showStats && remoteEnabled}
        onClose={onToggleStats}
        ariaLabel="Writing Statistics"
        size="lg"
        className="stats-modal"
        testId="stats-overlay"
      >
        <Suspense fallback={<DeferredPanelFallback />}>
          <Stats />
        </Suspense>
        <IconButton
          ariaLabel="Close Stats"
          className="close-button ui-modal-close"
          size="sm"
          onClick={onToggleStats}
        >
          <CloseIcon size={18} />
        </IconButton>
      </Modal>

      <Modal
        open={showAchievements && remoteEnabled}
        onClose={onToggleAchievements}
        ariaLabel="Achievements"
        size="lg"
        className="achievements-modal"
        testId="achievements-overlay"
      >
        <Suspense fallback={<DeferredPanelFallback />}>
          <Achievements />
        </Suspense>
        <IconButton
          ariaLabel="Close Achievements"
          className="close-button ui-modal-close"
          size="sm"
          onClick={onToggleAchievements}
        >
          <CloseIcon size={18} />
        </IconButton>
      </Modal>

      <Modal
        open={showStyleLearning && remoteEnabled}
        onClose={onShowStyleLearning}
        ariaLabel="Style Learning"
        size="lg"
        className="style-learning-modal"
        testId="style-learning-overlay"
      >
        <Suspense fallback={<DeferredPanelFallback />}>
          <StyleLearningPanel userId={auth?.user?.id ?? "default-user"} />
        </Suspense>
        <IconButton
          ariaLabel="Close Style Learning"
          className="close-button ui-modal-close"
          size="sm"
          onClick={onShowStyleLearning}
        >
          <CloseIcon size={18} />
        </IconButton>
      </Modal>

      <NewTaskButton disabled={!remoteEnabled} onClick={onCreateTask} ariaLabel="Create new task" />

      {/* Mounted only while open: the chunk is fetched on the first Export. */}
      {showExportModal && (
        <Suspense fallback={null}>
          <ExportModal open content={content} onClose={() => setShowExportModal(false)} />
        </Suspense>
      )}
    </div>
  );
}
