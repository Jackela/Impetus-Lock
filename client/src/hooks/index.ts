/**
 * Hooks Module
 *
 * Centralized exports for all React hooks in the Impetus application.
 * These hooks provide reusable stateful logic for editor features, API integration,
 * UI interactions, and agent mode functionality.
 *
 * @module hooks
 * @description
 * Available hooks include:
 * - **Editor & Content**: useEditorInitialization, useWritingState, useManualDelete, useSensoryFeedback
 * - **Task Management**: useTasks, useCreateTask, useTaskSync
 * - **Lock System**: useLockEnforcement
 * - **UI Components**: useToast, useFocusTrap, useToolbarActions
 * - **Animation & Feedback**: useAnimationController, useAudioFeedback
 * - **Agent Modes**: useLokiTimer, useWritingState, useManualTrigger
 * - **Configuration**: useLLMConfig, useTelemetry
 * - **Error Handling**: useErrorHandler, useInterventionApiError
 * - **Style Analysis**: useStyleLearning, useStyleHistory
 * - **Utilities**: useMediaQuery
 */

export { useLockEnforcement } from "./useLockEnforcement";
export { useWritingState } from "./useWritingState";
export { useTelemetry } from "./useTelemetry";
export { useTaskSync } from "./useTaskSync";
export { useTasks } from "./useTasks";
export { useCreateTask } from "./useCreateTask";
export { useErrorHandler } from "./useErrorHandler";
export { useToast } from "./useToast";
export { useFocusTrap } from "./useFocusTrap";
export { useEditorInitialization } from "./useEditorInitialization";
export { useSensoryFeedback } from "./useSensoryFeedback";
export { useManualDelete } from "./useManualDelete";

// Additional hooks (not yet in index.ts but available for direct import):
// - useStyleLearning
// - useStyleHistory
// - useLokiTimer
// - useManualTrigger
// - useAnimationController
// - useAudioFeedback
// - useToolbarActions
// - useMediaQuery
// - useLLMConfig
// - useInterventionApiError
