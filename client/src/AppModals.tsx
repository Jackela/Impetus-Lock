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
