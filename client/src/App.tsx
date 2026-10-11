import { useState, useCallback, useEffect, useRef } from "react";
import { parserCtx, remarkCtx, type Editor } from "@milkdown/core";
import { useOptionalAuth } from "./contexts/AuthContext";
import { useDraftRecovery } from "./hooks/useDraftRecovery";
import { validateRecoveredLocks } from "./utils/editorMarkdown";
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

/**
 * Root application component wiring editor, task sync, LLM config, and modals.
 *
 * @returns The application layout with editor and modal subtree
 */
function App() {
  const auth = useOptionalAuth();
  const remoteEnabled = auth?.remoteEnabled ?? true;
  const editorRef = useRef<Editor | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [legacyNotice, setLegacyNotice] = useState<string | null>(null);
  const [creationCandidates, setCreationCandidates] = useState<TaskRecord[] | null>(null);
  const [creationChecking, setCreationChecking] = useState(false);
  const [creationCheckError, setCreationCheckError] = useState<string | null>(null);
  const recovery = useDraftRecovery();
  const validateDraft = useCallback((_identity: string, content: string, locks: string[]) => {
    if (!editorRef.current) return false;
    editorRef.current.action((ctx) =>
      validateRecoveredLocks(content, locks, ctx.get(remarkCtx), ctx.get(parserCtx))
    );
    return true;
  }, []);
  const [mode, setMode] = useState<AgentMode>("off");
  const [manualTrigger, setManualTrigger] = useState<AIActionType | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

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
    taskId: currentTaskId,
    lockIds: taskLocks,
    version: taskVersion,
    status: taskStatus,
    error: taskError,
    isSaving,
    onChange: handleTaskChange,
    draftIdentity,
    conflict,
    retry,
    resolveConflict,
    createLocalDraft,
    hasUnsavedChanges,
    recoveryIssues,
    hasBlockedRecovery,
    creationUncertain,
    checkCreation,
    adoptCreation,
  } = useTaskSync(INITIAL_STORY, {
    externalTaskId: editingTaskId,
    userId: auth?.user?.id,
    session: auth ? auth.session : undefined,
    registerSnapshot: auth?.registerSnapshot,
    canSave: auth ? validateDraft : undefined,
  });

  const activeIdentity = useRef(draftIdentity);
  activeIdentity.current = draftIdentity;
  useEffect(() => {
    setCreationCandidates(null);
    setCreationCheckError(null);
    setCreationChecking(false);
  }, [draftIdentity]);
  const checkCreatedTask = async (): Promise<void> => {
    const identity = draftIdentity;
    setCreationChecking(true);
    setCreationCheckError(null);
    try {
      const candidates = await checkCreation();
      if (activeIdentity.current === identity) setCreationCandidates(candidates);
    } catch (failure) {
      if (activeIdentity.current === identity)
        setCreationCheckError(
          failure instanceof Error
            ? failure.message
            : "The created task could not be checked. Retry."
        );
    } finally {
      if (activeIdentity.current === identity) setCreationChecking(false);
    }
  };
  const handleEditorChange = useCallback(
    (markdown: string, locks: string[]) => {
      if (activeIdentity.current === draftIdentity && !recoveryError && !hasBlockedRecovery)
        handleTaskChange(markdown, locks);
    },
    [draftIdentity, handleTaskChange, recoveryError, hasBlockedRecovery]
  );
  const importLegacy = () => {
    const payload = recovery.legacy?.payload;
    if (!payload || !editorRef.current) return;
    try {
      const locks = editorRef.current.action((ctx) =>
        validateRecoveredLocks(
          payload.content,
          payload.lockIds,
          ctx.get(remarkCtx),
          ctx.get(parserCtx)
        )
      );
      createLocalDraft(payload.content, locks);
      setEditingTaskId(null);
      setLegacyNotice(
        "Imported as a new draft. The original is still available until you discard it."
      );
    } catch (error) {
      setLegacyNotice(
        error instanceof Error
          ? error.message
          : "The original draft could not be restored. Export it and retry."
      );
    }
  };

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

  const handleTaskClick = useCallback(
    (task: Pick<TaskRecord, "id" | "title">) => {
      if (task.id !== currentTaskId) {
        setRecoveryError(null);
        setEditorReady(false);
        editorRef.current = null;
      }
      setEditingTaskId(task.id);
    },
    [currentTaskId]
  );

  const handleManualTrigger = useCallback((actionType: AIActionType) => {
    setManualTrigger(actionType);
  }, []);

  const handleTriggerProcessed = useCallback(() => {
    setManualTrigger(null);
  }, []);

  const timerProgress = ((60 - timerRemaining) / 60) * 100;

  return (
    <>
      {recoveryIssues.length > 0 && (
        <section className="draft-recovery" aria-label="Account draft recovery">
          <h2>Owned draft needs recovery</h2>
          <p>
            The original writing is kept on this device. Export a backup and retry recovery before
            continuing with this draft.
          </p>
          {recoveryIssues.map((issue) => (
            <div key={issue.key}>
              <p role="alert">{issue.error}</p>
              <button type="button" onClick={() => recovery.exportOwned(issue)}>
                Export original account draft
              </button>
            </div>
          ))}
        </section>
      )}
      {auth && recovery.legacy && (
        <section className="draft-recovery" aria-label="Unassigned draft recovery">
          <h2>
            {recovery.legacy.readFailed
              ? "Unassigned draft could not be read"
              : "Unassigned draft found"}
          </h2>
          <p>
            Choose whether to import this writing into your account as a new draft. The original
            will stay on this device.
          </p>
          {(recovery.legacy.error || legacyNotice || recovery.error) && (
            <p role="alert">{recovery.legacy.error ?? legacyNotice ?? recovery.error}</p>
          )}
          <div className="recovery-actions">
            <button
              type="button"
              disabled={!remoteEnabled || !editorReady || !recovery.legacy.payload}
              onClick={importLegacy}
            >
              Import as a new draft
            </button>
            {recovery.legacy.readFailed && (
              <button type="button" onClick={recovery.retryLegacy}>
                Retry reading unassigned draft
              </button>
            )}
            <button
              type="button"
              disabled={recovery.legacy.readFailed}
              onClick={recovery.exportLegacy}
            >
              Export original draft
            </button>
            <button type="button" onClick={recovery.discardLegacy}>
              Discard unassigned draft
            </button>
          </div>
        </section>
      )}
      {conflict && (
        <section className="draft-recovery" aria-label="Version conflict">
          <h2>Your local draft and server version differ</h2>
          <p>
            Both versions are kept. Continue writing here to keep your local draft; remote saving
            stays paused. Saving as a new draft creates a separate task. Using the server version
            replaces this editor after preserving a local recovery backup.
          </p>
          <div className="recovery-actions">
            <button
              type="button"
              disabled={!remoteEnabled}
              onClick={() => {
                try {
                  resolveConflict("new");
                  setEditingTaskId(null);
                } catch {
                  /* The hook preserves and reports storage failures. */
                }
              }}
            >
              Save as a new draft
            </button>
            <button
              type="button"
              disabled={!conflict.server || !remoteEnabled}
              onClick={() => {
                try {
                  resolveConflict("server");
                  // Explicit replacement starts a fresh editor and lock manager;
                  // the prior document's locks must not reject the user's choice.
                  editorRef.current = null;
                  setEditorReady(false);
                  setRecoveryError(null);
                  setRecoveryAttempt((attempt) => attempt + 1);
                } catch {
                  /* The hook preserves and reports storage failures. */
                }
              }}
            >
              Use server version
            </button>
            <button type="button" onClick={() => recovery.exportCurrent(taskContent, taskLocks)}>
              Export local draft
            </button>
          </div>
          <details>
            <summary>Local draft</summary>
            <pre>{conflict.local.content}</pre>
          </details>
          {conflict.server && (
            <details>
              <summary>Server version</summary>
              <pre>{conflict.server.content}</pre>
            </details>
          )}
        </section>
      )}
      {creationUncertain && (
        <section className="draft-recovery" aria-label="Unconfirmed task creation">
          <h2>Task creation is unconfirmed</h2>
          <p>
            The server may already have created this task. Your writing is kept here and automatic
            creation is paused. Check for the earlier task and choose it explicitly, or save a
            separate new draft. A separate draft may create a duplicate of the earlier task.
          </p>
          {creationCheckError && <p role="alert">{creationCheckError}</p>}
          <div className="recovery-actions">
            <button
              type="button"
              disabled={!remoteEnabled || creationChecking}
              onClick={() => void checkCreatedTask()}
            >
              {creationChecking ? "Checking created tasks…" : "Check for the created task"}
            </button>
            <button
              type="button"
              disabled={!remoteEnabled || creationChecking}
              onClick={() => {
                try {
                  createLocalDraft(taskContent, taskLocks);
                  setEditingTaskId(null);
                } catch {
                  setCreationCheckError(
                    "Your current draft could not be preserved. Keep this page open and export it before switching drafts."
                  );
                }
              }}
            >
              Save as a separate new draft
            </button>
            <button type="button" onClick={() => recovery.exportCurrent(taskContent, taskLocks)}>
              Export local draft
            </button>
          </div>
          {creationCandidates && creationCandidates.length === 0 && (
            <p role="status">
              No matching task was found. This does not confirm that the earlier creation failed.
              You can check again.
            </p>
          )}
          {creationCandidates && creationCandidates.length > 0 && (
            <ul>
              {creationCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={!remoteEnabled || creationChecking}
                    onClick={() => {
                      setCreationChecking(true);
                      void adoptCreation(candidate.id)
                        .catch((failure: unknown) => {
                          if (activeIdentity.current === draftIdentity)
                            setCreationCheckError(
                              failure instanceof Error
                                ? failure.message
                                : "This task could not be adopted. Your local writing remains open."
                            );
                        })
                        .finally(() => {
                          if (activeIdentity.current === draftIdentity) setCreationChecking(false);
                        });
                    }}
                  >
                    Use created task: {candidate.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {((taskError && !creationUncertain) || recoveryError) && (
        <section className="draft-recovery" aria-label="Draft recovery actions">
          <p role="alert">{recoveryError ?? taskError}</p>
          <div className="recovery-actions">
            <button
              type="button"
              onClick={() => {
                if (recoveryError) {
                  setRecoveryError(null);
                  setRecoveryAttempt((v) => v + 1);
                }
                void Promise.resolve(retry()).catch(() => {});
              }}
            >
              Retry draft recovery
            </button>
            <button type="button" onClick={() => recovery.exportCurrent(taskContent, taskLocks)}>
              Export local draft
            </button>
          </div>
        </section>
      )}
      <AppLayout
        mode={mode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onModeChange={setMode}
        onManualTrigger={handleManualTrigger}
        onTaskClick={handleTaskClick}
        selectedTaskId={currentTaskId ?? undefined}
        taskStatus={
          taskError || recoveryError
            ? "error"
            : !remoteEnabled
              ? "local"
              : taskStatus === "loading"
                ? "loading"
                : isSaving
                  ? "saving"
                  : taskError
                    ? "error"
                    : hasUnsavedChanges
                      ? "unsaved"
                      : "synced"
        }
        isSaving={isSaving}
        taskError={recoveryError ?? taskError}
        onCreateTask={() => setShowCreateTaskModal(true)}
        onShowSettings={() => setShowSettings(true)}
        onLockSession={lock}
        onForgetKey={handleForgetKey}
        onShowStyleLearning={() => setShowStyleLearning((prev) => !prev)}
        showStyleLearning={showStyleLearning}
        llmFeedback={llmFeedback}
        isConfigured={isConfigured && remoteEnabled && !recoveryError && !hasBlockedRecovery}
        llmProviderLabel={llmConfig ? getLLMProviderLabel(llmConfig.provider) : null}
        showStats={showStats}
        onToggleStats={() => setShowStats((prev) => !prev)}
        showAchievements={showAchievements}
        onToggleAchievements={() => setShowAchievements((prev) => !prev)}
        content={taskContent}
      >
        <TimerIndicator
          progress={timerProgress}
          visible={remoteEnabled && !recoveryError && !hasBlockedRecovery && mode === "muse"}
          remainingTime={timerRemaining}
        />
        {hasBlockedRecovery ? (
          <pre data-testid="unrecovered-account-draft">{taskContent}</pre>
        ) : (
          <EditorCore
            key={`${draftIdentity}:${recoveryAttempt}`}
            contentVersion={taskVersion}
            mode={remoteEnabled && !recoveryError && !hasBlockedRecovery ? mode : "off"}
            session={auth ? auth.session : undefined}
            requestIdentity={draftIdentity}
            initialContent={taskContent}
            initialLocks={taskLocks}
            externalTrigger={manualTrigger}
            onTriggerProcessed={handleTriggerProcessed}
            onTimerUpdate={setTimerRemaining}
            onInterventionError={handleInterventionError}
            onChange={handleEditorChange}
            onRecoveryError={(error) => setRecoveryError(error.message)}
            onReady={(editor) => {
              editorRef.current = editor;
              setEditorReady(true);
              void Promise.resolve(retry()).catch(() => {});
            }}
          />
        )}
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
        showCreateTaskModal={showCreateTaskModal && !recoveryError && !hasBlockedRecovery}
        onCloseCreateTaskModal={() => setShowCreateTaskModal(false)}
        onTaskCreated={(task) => {
          handleTaskClick(task);
          void refetch();
        }}
        currentProvider={llmConfig?.provider ?? null}
      />
    </>
  );
}

export default App;
