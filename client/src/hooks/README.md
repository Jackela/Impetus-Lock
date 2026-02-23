# Hooks Module

This directory contains custom React hooks for the Impetus Lock application.

## Structure

```
hooks/
├── index.ts                    # Barrel exports
├── README.md                   # This file
├── useAnimationController.ts   # Animation state management
├── useAudioFeedback.ts         # Web Audio API feedback
├── useCreateTask.ts            # Task creation operations
├── useEditorInitialization.ts  # Editor setup with retry logic
├── useErrorHandler.ts          # Global error handling
├── useFocusTrap.ts             # Modal focus management
├── useInterventionApiError.ts  # API error parsing
├── useLLMConfig.ts             # LLM configuration management
├── useLockEnforcement.ts       # Lock state management
├── useLokiTimer.ts             # Loki mode random timer
├── useManualDelete.ts          # Manual delete operations
├── useManualTrigger.ts         # Manual AI trigger
├── useMediaQuery.ts            # Responsive breakpoint detection
├── useSensoryFeedback.ts       # Visual/audio feedback management
├── useTaskSync.ts              # Task synchronization
├── useTasks.ts                 # Task list fetching
├── useTelemetry.ts             # Analytics telemetry
├── useToast.ts                 # Toast notifications
├── useToolbarActions.ts        # Toolbar action handlers
├── useWritingState.ts          # Writing state machine (Muse mode)
```

## Usage

Import hooks from the barrel export:

```typescript
import { useWritingState, useLokiTimer, useSensoryFeedback } from "../hooks";
```

## Categories

### Editor Hooks
- `useEditorInitialization` - Milkdown editor setup
- `useWritingState` - STUCK detection state machine
- `useLokiTimer` - Random chaos timer
- `useSensoryFeedback` - Feedback management
- `useManualDelete` - Delete operations

### Data Hooks
- `useTasks` - Fetch task list
- `useTaskSync` - Sync task content
- `useCreateTask` - Create new tasks

### UI Hooks
- `useMediaQuery` - Responsive breakpoints
- `useToast` - Notifications
- `useFocusTrap` - Accessibility
- `useAnimationController` - Animation states
- `useAudioFeedback` - Sound effects

### Configuration Hooks
- `useLLMConfig` - LLM settings
- `useTelemetry` - Analytics
- `useLockEnforcement` - Lock management

### Utility Hooks
- `useErrorHandler` - Error handling
- `useInterventionApiError` - API error parsing
- `useToolbarActions` - Toolbar utilities
- `useManualTrigger` - Manual AI trigger

## Guidelines

1. **Single Responsibility**: Each hook should do one thing well
2. **Composable**: Hooks should work well together
3. **Tested**: All hooks must have corresponding test files
4. **Documented**: Use JSDoc comments for all public functions
5. **Type Safe**: Full TypeScript coverage, no `any` types

## Adding New Hooks

1. Create the hook file with `.ts` extension
2. Add tests in `hookname.test.ts`
3. Export from `index.ts`
4. Update this README
