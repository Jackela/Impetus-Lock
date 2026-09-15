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
 * - **UI Components**: useToast, useFocusTrap, useToolbarActions
 * - **Animation & Feedback**: useAnimationController, useAudioFeedback
 * - **Agent Modes**: useLokiTimer, useWritingState, useManualTrigger
 * - **Configuration**: useLLMConfig, useTelemetry
 * - **Error Handling**: useErrorHandler, useInterventionApiError
 * - **Style Analysis**: useStyleLearning, useStyleHistory
 * - **Utilities**: useMediaQuery
 */

/** Re-export of the useWritingState hook. */
export { useWritingState } from "./useWritingState";
/** Re-export of the useTelemetry hook. */
export { useTelemetry } from "./useTelemetry";
/** Re-export of the useTaskSync hook. */
export { useTaskSync } from "./useTaskSync";
/** Re-export of the useTasks hook. */
export { useTasks } from "./useTasks";
/** Re-export of the useCreateTask hook. */
export { useCreateTask } from "./useCreateTask";
/** Re-export of the useErrorHandler hook. */
export { useErrorHandler } from "./useErrorHandler";
/** Re-export of the useToast hook. */
export { useToast } from "./useToast";
/** Re-export of the useFocusTrap hook. */
export { useFocusTrap } from "./useFocusTrap";
/** Re-export of the useEditorInitialization hook. */
export { useEditorInitialization } from "./useEditorInitialization";
/** Re-export of the useSensoryFeedback hook. */
export { useSensoryFeedback } from "./useSensoryFeedback";
/** Re-export of the useManualDelete hook. */
export { useManualDelete } from "./useManualDelete";
/** Re-export of the useInterval hook. */
export { useInterval } from "./useInterval";

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
