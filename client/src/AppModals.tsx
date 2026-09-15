import { WelcomeModal } from "./components/WelcomeModal";
import { ConfigErrorModal } from "./components/ConfigErrorModal";
import { LLMSettingsModal } from "./components/LLMSettingsModal";
import { CreateTaskModal } from "./components/CreateTaskModal";
import type { LLMConfig, VaultMetadata, VaultMode } from "./hooks/useLLMConfig";
import type { InterventionAPIError } from "./hooks/useInterventionApiError";

interface AppModalsProps {
  showWelcome: boolean;
  onDismissWelcome: () => void;

  showConfigError: boolean;
  onDismissConfigError: () => void;
  onOpenSettingsFromError: () => void;
  lastLLMError: InterventionAPIError | null;

  showSettings: boolean;
  onCloseSettings: () => void;
  llmConfig: LLMConfig | null;
  storageMode: VaultMode;
  vaultLocked: boolean;
  metadata: VaultMetadata | null;
  onSaveConfig: (config: LLMConfig) => void;
  onClearConfig: () => Promise<void>;
  onStorageModeChange: (mode: VaultMode) => void;
  onUnlock: (passphrase: string) => Promise<void>;
  onLock: () => void;

  showCreateTaskModal: boolean;
  onCloseCreateTaskModal: () => void;
  onTaskCreated: () => void;

  currentProvider?: string | null;
}

/**
 * Renders the application's modal stack (welcome, config error, settings, create task).
 *
 * @param root0 - Component props
 * @param root0.showWelcome - Whether the welcome modal is visible
 * @param root0.onDismissWelcome - Callback to dismiss the welcome modal
 * @param root0.showConfigError - Whether the config error modal is visible
 * @param root0.onDismissConfigError - Callback to dismiss the config error modal
 * @param root0.onOpenSettingsFromError - Callback to open settings from the error modal
 * @param root0.lastLLMError - Last intervention API error, if any
 * @param root0.showSettings - Whether the LLM settings modal is visible
 * @param root0.onCloseSettings - Callback to close the settings modal
 * @param root0.llmConfig - Current LLM configuration, if any
 * @param root0.storageMode - Current vault storage mode
 * @param root0.vaultLocked - Whether the LLM key vault is locked
 * @param root0.metadata - Vault metadata, if any
 * @param root0.onSaveConfig - Callback to persist an LLM configuration
 * @param root0.onClearConfig - Callback to clear the stored configuration
 * @param root0.onStorageModeChange - Callback to change the vault storage mode
 * @param root0.onUnlock - Callback to unlock the vault with a passphrase
 * @param root0.onLock - Callback to lock the vault
 * @param root0.showCreateTaskModal - Whether the create task modal is visible
 * @param root0.onCloseCreateTaskModal - Callback to close the create task modal
 * @param root0.onTaskCreated - Callback invoked after a task is created
 * @param root0.currentProvider - Fallback provider id derived from the saved config
 * @returns The rendered modal subtree
 */
export function AppModals({
  showWelcome,
  onDismissWelcome,
  showConfigError,
  onDismissConfigError,
  onOpenSettingsFromError,
  lastLLMError,
  showSettings,
  onCloseSettings,
  llmConfig,
  storageMode,
  vaultLocked,
  metadata,
  onSaveConfig,
  onClearConfig,
  onStorageModeChange,
  onUnlock,
  onLock,
  showCreateTaskModal,
  onCloseCreateTaskModal,
  onTaskCreated,
  currentProvider,
}: AppModalsProps) {
  const provider =
    (typeof lastLLMError?.details === "object" &&
      lastLLMError?.details !== null &&
      "provider" in (lastLLMError?.details as Record<string, unknown>) &&
      String((lastLLMError?.details as Record<string, unknown>).provider)) ||
    currentProvider ||
    null;

  return (
    <>
      <WelcomeModal forceShow={showWelcome} onDismiss={onDismissWelcome} />

      <ConfigErrorModal
        visible={showConfigError}
        onDismiss={onDismissConfigError}
        onOpenSettings={onOpenSettingsFromError}
        errorCode={lastLLMError?.errorCode}
        errorMessage={lastLLMError?.message}
        provider={provider}
      />

      <LLMSettingsModal
        open={showSettings}
        onClose={onCloseSettings}
        config={llmConfig}
        onSave={onSaveConfig}
        onClear={onClearConfig}
        storageMode={storageMode}
        onModeChange={onStorageModeChange}
        locked={vaultLocked}
        onUnlock={onUnlock}
        onLock={onLock}
        metadata={metadata}
      />

      <CreateTaskModal
        open={showCreateTaskModal}
        onClose={onCloseCreateTaskModal}
        onSuccess={onTaskCreated}
      />
    </>
  );
}
