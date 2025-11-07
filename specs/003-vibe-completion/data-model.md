# Phase 1: Data Model

**Feature**: P3 Vibe Completion  
**Date**: 2025-11-07  
**Status**: Complete

## Overview

This document defines the client-side state model for sensory feedback completion. No backend data model changes required (frontend-only feature).

## Entity: AIActionType (Extended)

**Purpose**: Enumeration of all AI action types that trigger sensory feedback

**Location**: `client/src/types/ai-actions.ts`

**Current State** (from P2):
```typescript
export enum AIActionType {
  PROVOKE = 'PROVOKE',  // AI provocation (glitch animation + clank sound)
  DELETE = 'DELETE',    // AI deletion (fade-out animation + whoosh sound)
  REJECT = 'REJECT'     // Lock rejection (shake animation + bonk sound)
}
```

**Extended State** (P3):
```typescript
export enum AIActionType {
  PROVOKE = 'PROVOKE',
  DELETE = 'DELETE',
  REJECT = 'REJECT',
  ERROR = 'ERROR'       // NEW: API error (red flash + buzz sound)
}
```

**Validation Rules**:
- Must be one of 4 defined values
- TypeScript enum provides compile-time validation
- Runtime validation: `Object.values(AIActionType).includes(value)`

**State Transitions**:
```
null (idle)
  ↓ User clicks manual trigger OR timer fires
PROVOKE (glitch feedback)
  ↓ Animation completes (1.5s)
null (idle)

null (idle)
  ↓ Loki timer triggers deletion
DELETE (fade-out feedback)
  ↓ Animation completes (0.75s) → content removed
null (idle)

null (idle)
  ↓ User attempts to delete locked content
REJECT (shake feedback)
  ↓ Animation completes (0.5s) → content unchanged
null (idle)

null (idle) OR any other state
  ↓ API call fails (network/server error)
ERROR (red flash feedback)
  ↓ Animation completes (0.5s)
null (idle) OR previous state restored
```

**Related Entities**:
- AnimationState (manages visual feedback)
- AudioState (manages sound feedback)

---

## Entity: AnimationState

**Purpose**: Tracks currently playing animation for cancel-and-replace behavior

**Location**: Internal state in `client/src/hooks/useAnimationController.ts`

**Schema**:
```typescript
interface AnimationState {
  /**
   * Unique key for AnimatePresence (format: "{actionType}-{counter}-{timestamp}")
   * Used to trigger React reconciliation and animation replacement
   */
  animationKey: string;
  
  /**
   * Framer Motion animation variants for current action
   * Defines initial, animate, and exit states
   */
  variants: {
    initial: { opacity: number; x?: number; backgroundColor?: string };
    animate: { 
      opacity: number | number[]; 
      x?: number | number[];
      backgroundColor?: string | string[];
      transition: { duration: number; ease: string; repeat?: number };
    };
    exit: { opacity: number; x?: number };
  };
  
  /**
   * Current action type being animated (or null if idle)
   */
  actionType: AIActionType | null;
}
```

**Animation Variants by Action Type**:

| Action Type | Animation | Duration | Properties | Description |
|-------------|-----------|----------|------------|-------------|
| PROVOKE | Glitch | 1.5s | opacity: [1, 0.5, 1, 0.3, 1, 0] | Digital disruption effect |
| DELETE | Fade-out | 0.75s | opacity: 1 → 0 | Smooth disappearance |
| REJECT | Shake | 0.5s | x: [0, -10, 10, -10, 10, 0] | Horizontal oscillation |
| ERROR | Red flash | 0.5s | backgroundColor: ["transparent", "rgba(239,68,68,0.2)", "transparent"] | Urgent error flash |

**State Transitions**:
- New action → Generate new animationKey → Cancel previous animation via AnimatePresence
- Animation completes → State persists until new action (AnimatePresence handles cleanup)
- Prefers-reduced-motion → Use simplified variants (opacity only, 0.2s duration)

**Validation Rules**:
- animationKey must be unique per action trigger (enforced by timestamp)
- variants must include all three states (initial, animate, exit)
- Duration must be positive number in seconds
- Opacity values must be 0-1 range

---

## Entity: AudioState

**Purpose**: Tracks currently playing audio for interrupt-and-replace behavior

**Location**: Internal state in `client/src/hooks/useAudioFeedback.ts`

**Schema**:
```typescript
interface AudioState {
  /**
   * Web Audio API context (singleton per hook instance)
   */
  audioContext: AudioContext | null;
  
  /**
   * Preloaded audio buffers (loaded on mount)
   */
  audioBuffers: {
    clank: AudioBuffer;   // Provoke sound
    whoosh: AudioBuffer;  // Delete sound
    bonk: AudioBuffer;    // Reject sound
    buzz: AudioBuffer;    // NEW: Error sound
  } | null;
  
  /**
   * Currently playing audio source (null if no audio playing)
   * Used for interruption when new audio triggers
   */
  currentSource: AudioBufferSourceNode | null;
  
  /**
   * Audio readiness flag (true when buffers loaded)
   */
  isReady: boolean;
  
  /**
   * Audio enabled flag (respects user preference + browser autoplay policy)
   */
  isEnabled: boolean;
}
```

**Audio Mappings**:

| Action Type | Sound File | Duration | Description |
|-------------|------------|----------|-------------|
| PROVOKE | clank.mp3 | ~0.8s | Metallic lock sound |
| DELETE | whoosh.mp3 | ~0.6s | Wind swoosh sound |
| REJECT | bonk.mp3 | ~0.4s | Impact/invalid sound |
| ERROR | buzz.mp3 | ~0.4s | NEW: Urgent buzz/alarm |

**State Transitions**:
```
Initial State:
  audioContext: null
  audioBuffers: null
  currentSource: null
  isReady: false
  isEnabled: false

Mount (useEffect):
  1. Create AudioContext
  2. Preload all audio buffers
  3. Set isReady = true
  4. Check autoplay policy → Set isEnabled

Play Audio:
  1. If currentSource exists → currentSource.stop()
  2. Create new AudioBufferSourceNode
  3. Connect to audioContext.destination
  4. Start playback
  5. Store in currentSource
  6. On playback end → Set currentSource = null

Unmount:
  1. Stop currentSource if playing
  2. Close audioContext
  3. Clear all state
```

**Validation Rules**:
- audioContext must be created before any playback attempt
- audioBuffers must be loaded before isReady = true
- currentSource.stop() must be called before starting new playback (FR-009)
- Audio files must be <100KB (performance constraint)
- Audio must gracefully degrade if permissions denied (FR-015)

---

## Entity: ErrorContext

**Purpose**: Captures error information for debugging and telemetry (future use)

**Location**: Error handler utility or hook state

**Schema**:
```typescript
interface ErrorContext {
  /**
   * Error type classification
   */
  type: 'network' | 'client' | 'server' | 'timeout' | 'unknown';
  
  /**
   * HTTP status code (if applicable)
   */
  statusCode?: number;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Timestamp of error occurrence
   */
  timestamp: number;
  
  /**
   * API endpoint that failed
   */
  endpoint: string;
  
  /**
   * User action that triggered the API call
   */
  triggerSource: 'manual-button' | 'loki-timer' | 'muse-timer';
}
```

**Error Type Classification**:

| Type | HTTP Status | Description | Example |
|------|-------------|-------------|---------|
| network | N/A | No response from server | fetch() timeout, offline |
| timeout | N/A | Request exceeded timeout | AbortSignal.timeout() |
| client | 400-499 | Client-side error | 400 Bad Request, 401 Unauthorized |
| server | 500-599 | Server-side error | 500 Internal Error, 503 Unavailable |
| unknown | N/A | Unclassified error | Unexpected exception |

**State Lifecycle**:
- Created when error occurs
- Logged to console (development)
- Used to trigger ERROR feedback
- **Not persisted** (ephemeral, per-error instance)
- Future: Could be sent to telemetry service

**Validation Rules**:
- type must be one of 5 defined values
- statusCode required if type is 'client' or 'server'
- timestamp must be valid Unix timestamp (ms)
- endpoint must be non-empty string

---

## Entity: LockRejectionEvent (Extension)

**Purpose**: Extends useLockEnforcement to trigger feedback on rejection

**Location**: `client/src/hooks/useLockEnforcement.ts`

**Current Interface**:
```typescript
interface UseLockEnforcementReturn {
  filterTransaction: (tr: Transaction) => boolean;
}

function useLockEnforcement(lockedIds: Set<string>): UseLockEnforcementReturn
```

**Extended Interface** (P3):
```typescript
interface UseLockEnforcementReturn {
  filterTransaction: (tr: Transaction) => boolean;
}

function useLockEnforcement(
  lockedIds: Set<string>,
  onReject?: () => void  // NEW: Callback when rejection occurs
): UseLockEnforcementReturn
```

**Callback Behavior**:
- Called synchronously when deletion transaction is blocked
- Receives no arguments (rejection is binary: blocked or not)
- Should be memoized callback to prevent re-renders (useCallback in consumer)
- Must not throw (wrap in try-catch if callback can error)

**Usage Example**:
```typescript
// In EditorCore.tsx
const handleReject = useCallback(() => {
  setCurrentAction(AIActionType.REJECT);
}, []);

const { filterTransaction } = useLockEnforcement(lockedIds, handleReject);
```

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     App.tsx (State Lift)                    │
│  - manualTrigger: AIActionType | null                      │
│  - setManualTrigger: (type: AIActionType | null) => void   │
└─────────────────────────────────────────────────────────────┘
                      ↓                    ↓
    ┌─────────────────────────┐  ┌────────────────────────────┐
    │  ManualTriggerButton    │  │       EditorCore           │
    │  - Triggers API calls   │  │  - Receives externalTrigger│
    │  - Handles errors       │  │  - Manages currentAction   │
    │  - Calls onTrigger()    │  │  - Integrates feedback     │
    └─────────────────────────┘  └────────────────────────────┘
                                           ↓
                      ┌────────────────────────────────────────┐
                      │         SensoryFeedback                │
                      │  - actionType: AIActionType | null     │
                      │  - Orchestrates animation + audio      │
                      └────────────────────────────────────────┘
                               ↓                     ↓
              ┌────────────────────────┐   ┌──────────────────────┐
              │ useAnimationController │   │  useAudioFeedback    │
              │  - animationKey        │   │  - audioBuffers      │
              │  - variants            │   │  - currentSource     │
              └────────────────────────┘   └──────────────────────┘
```

---

## Data Model Summary

| Entity | Type | Location | Purpose | Changes |
|--------|------|----------|---------|---------|
| AIActionType | Enum | types/ai-actions.ts | Action type definitions | Add ERROR |
| AnimationState | Interface | useAnimationController.ts | Animation tracking | Add ERROR variants |
| AudioState | Interface | useAudioFeedback.ts | Audio playback state | Add buzz.mp3, currentSource |
| ErrorContext | Interface | Error handler utility | Error information | NEW entity |
| LockRejectionEvent | Function param | useLockEnforcement.ts | Rejection callback | Add onReject param |

**No backend data model required** - All state is client-side, ephemeral  
**No persistence required** - Feedback is real-time, not stored  
**No API contracts required** - Extends existing endpoints' error handling only

---

## Next Steps (Phase 1 Continued)

1. ✅ **Data Model** - Complete
2. ⏭ **API Contracts** - Skip (no backend changes, only error handling)
3. ⏭ **Quickstart Guide** - Create implementation guide with TDD workflow
4. ⏭ **Agent Context Update** - Propagate data model to agent context

**Data model validated against requirements** ✅  
**All entities defined with schemas** ✅  
**Ready for Quickstart Guide** ✅
