# Phase 1: Data Model

**Feature**: Vibe Enhancements (002-vibe-enhancements)  
**Date**: 2025-11-06  
**Status**: Design Complete

## Overview

This P2 feature is **frontend-only** and does not introduce new backend entities or database schemas. It enhances the existing P1 Impetus Lock core with UI/UX improvements (manual trigger button + sensory feedback). The data model consists of **client-side state** managed by React hooks and local browser APIs.

## Entities

### 1. AI Action Type (Enum)

**Description**: Categorizes AI interventions to determine appropriate sensory feedback.

**Type**: TypeScript enum (client-side only)

```typescript
/**
 * AI action types that trigger sensory feedback.
 * Defined in spec.md Key Entities: AI Action Feedback.
 */
export enum AIActionType {
  /** Provoke action (Muse mode): AI injects provocative content */
  PROVOKE = 'provoke',
  
  /** Delete action (Loki mode): AI deletes text */
  DELETE = 'delete',
  
  /** Reject action (Lock enforcement): User delete attempt blocked */
  REJECT = 'reject'
}
```

**Source**: spec.md Line 132 (Key Entities: AI Action Feedback)

**Relationships**: Maps to animation/audio pairs in SensoryFeedbackConfig

**Validation Rules**:
- Must be one of: 'provoke', 'delete', 'reject'
- Case-sensitive (lowercase only)

**State Transitions**: N/A (immutable enum)

---

### 2. Sensory Feedback Configuration

**Description**: Maps AI action types to their visual/audio feedback pairs.

**Type**: TypeScript interface + constant object (client-side only)

```typescript
/**
 * Configuration for animation and audio feedback per AI action.
 * Defined in spec.md FR-006 through FR-013.
 */
interface SensoryFeedbackConfig {
  animationType: 'glitch' | 'fadeout' | 'shake';
  audioFile: string;  // Path to audio asset
  duration: number;   // Animation duration in milliseconds
}

export const FEEDBACK_CONFIG: Record<AIActionType, SensoryFeedbackConfig> = {
  [AIActionType.PROVOKE]: {
    animationType: 'glitch',      // FR-006: Glitch animation
    audioFile: '/assets/audio/clank.mp3',  // FR-008: Clank sound
    duration: 1500  // FR-007: 1-2 seconds (1.5s midpoint)
  },
  [AIActionType.DELETE]: {
    animationType: 'fadeout',     // FR-010: Fade-out animation
    audioFile: '/assets/audio/whoosh.mp3', // FR-012: Whoosh sound
    duration: 750   // FR-011: 0.5-1 second (0.75s midpoint)
  },
  [AIActionType.REJECT]: {
    animationType: 'shake',       // Spec.md Line 56 (P1 feature)
    audioFile: '/assets/audio/bonk.mp3',   // Spec.md Line 56 (P1 feature)
    duration: 500   // Assumed from P1 implementation
  }
};
```

**Source**: spec.md FR-006 to FR-013

**Relationships**: Referenced by useAnimationController and useAudioFeedback hooks

**Validation Rules**:
- `animationType` must match Framer Motion variant names
- `audioFile` must be valid path to MP3 file in /assets/audio/
- `duration` must be positive integer (milliseconds)

**State Transitions**: N/A (constant configuration)

---

### 3. Manual Trigger Event

**Description**: User-initiated request for AI intervention in Muse mode.

**Type**: Client-side event object (ephemeral, not persisted)

```typescript
/**
 * Event data when user clicks manual trigger button.
 * Defined in spec.md Key Entities: Manual Trigger Event.
 */
interface ManualTriggerEvent {
  /** Timestamp when button was clicked */
  timestamp: number;  // Date.now()
  
  /** User ID (if authentication exists, otherwise null) */
  userId: string | null;
  
  /** Always 'muse' (button only enabled in Muse mode per FR-002) */
  mode: 'muse';
  
  /** Always 'provoke' (manual trigger only calls Provoke API per FR-003) */
  actionType: AIActionType.PROVOKE;
}
```

**Source**: spec.md Line 143 (Key Entities: Manual Trigger Event)

**Relationships**: 
- Triggers AI Provoke action via existing P1 API client
- Logged for analytics (optional, not implemented in MVP)

**Validation Rules**:
- `timestamp` must be valid Unix timestamp (milliseconds)
- `mode` must always be 'muse' (button disabled otherwise)
- `actionType` must always be 'provoke'

**State Transitions**: 
1. User clicks button → Event created
2. Event sent to API client → Provoke action triggered
3. Event logged (optional) → Event discarded

---

### 4. Mode State

**Description**: Current operational mode of the system (P1 feature, referenced by P2).

**Type**: Client-side state (React context or hook state)

```typescript
/**
 * System mode state (P1 feature).
 * Defined in spec.md Key Entities: Mode State.
 */
interface ModeState {
  /** Current mode: 'muse', 'loki', or 'off' */
  modeName: 'muse' | 'loki' | 'off';
  
  /** Computed: true only when modeName === 'muse' (FR-002) */
  isManualTriggerEnabled: boolean;
}
```

**Source**: spec.md Line 151 (Key Entities: Mode State)

**Relationships**: 
- Determines manual trigger button availability (FR-002)
- Controls AI behavior (P1 feature)

**Validation Rules**:
- `modeName` must be one of: 'muse', 'loki', 'off'
- `isManualTriggerEnabled` must be true only when modeName === 'muse'

**State Transitions**:
```
off → muse → loki → off (circular transitions)
       ↓
isManualTriggerEnabled: true
```

---

### 5. Animation Controller State

**Description**: Tracks current animation lifecycle for cancel-and-replace behavior.

**Type**: React hook state (ephemeral)

```typescript
/**
 * Internal state for animation lifecycle management.
 * Implements FR-018 (cancel-and-replace).
 */
interface AnimationControllerState {
  /** Current animation type (null when idle) */
  currentAnimation: AIActionType | null;
  
  /** Unique key for Framer Motion (timestamp ensures remount) */
  animationKey: string;  // Format: "${actionType}-${timestamp}"
  
  /** Animation start timestamp (for duration tracking) */
  startTime: number | null;
}
```

**Source**: research.md (Framer Motion pattern)

**Relationships**: 
- Consumes FEEDBACK_CONFIG to get animation type and duration
- Triggers SensoryFeedback component re-render via key change

**Validation Rules**:
- `currentAnimation` must be valid AIActionType or null
- `animationKey` must be unique per animation instance
- `startTime` must be valid Unix timestamp when animation active

**State Transitions**:
```
idle (null) → provoke → idle
           → delete → idle
           → reject → idle

Cancel-and-replace: provoke → DELETE (provoke cancelled, delete starts)
```

---

### 6. Audio Controller State

**Description**: Manages Web Audio API resources and playback state.

**Type**: React hook state + Web Audio API objects

```typescript
/**
 * Internal state for audio playback management.
 * Implements FR-019 (cancel previous audio before new playback).
 */
interface AudioControllerState {
  /** Web Audio API context (singleton) */
  audioContext: AudioContext | null;
  
  /** Preloaded audio buffers (loaded on mount) */
  audioBuffers: Record<AIActionType, AudioBuffer | null>;
  
  /** Currently playing source (null when silent) */
  currentSource: AudioBufferSourceNode | null;
  
  /** Loading state for initial buffer decode */
  isLoading: boolean;
  
  /** Error state if AudioContext creation fails (FR-015) */
  error: Error | null;
}
```

**Source**: research.md (Web Audio API pattern)

**Relationships**: 
- Consumes FEEDBACK_CONFIG to get audio file paths
- Syncs with AnimationControllerState (play audio when animation starts)

**Validation Rules**:
- `audioContext` must be valid AudioContext or null (if browser doesn't support)
- `audioBuffers` must contain decoded AudioBuffer for each action type
- `currentSource` must be stopped/disconnected before playing new sound (FR-019)

**State Transitions**:
```
initialization → loading buffers → ready (idle)
ready (idle) → playing provoke → idle
            → playing delete → idle
            → playing reject → idle

Cancel-and-replace: playing provoke → STOP → playing delete
```

---

## Data Flow Diagram

```
User Click (Manual Trigger Button)
    ↓
ManualTriggerEvent created (timestamp, userId, mode='muse', action='provoke')
    ↓
useManualTrigger hook → triggerProvoke() API call (P1 endpoint)
    ↓
API response received → AIActionType.PROVOKE
    ↓
┌──────────────────────────────────────────────────────┐
│ Sensory Feedback Orchestration                       │
│  ┌──────────────────┐    ┌──────────────────┐       │
│  │ Animation        │    │ Audio            │       │
│  │ Controller       │    │ Controller       │       │
│  ├──────────────────┤    ├──────────────────┤       │
│  │ 1. Cancel old    │    │ 1. Stop current  │       │
│  │    animation     │    │    source        │       │
│  │ 2. Generate new  │    │ 2. Create new    │       │
│  │    key           │    │    source        │       │
│  │ 3. Trigger       │    │ 3. Start         │       │
│  │    re-render     │    │    playback      │       │
│  └──────────────────┘    └──────────────────┘       │
│         ↓                        ↓                   │
│  FEEDBACK_CONFIG[PROVOKE]                            │
│    - animationType: 'glitch'                         │
│    - audioFile: 'clank.mp3'                          │
│    - duration: 1500ms                                │
└──────────────────────────────────────────────────────┘
    ↓
User sees Glitch animation (1.5s) + hears Clank sound (<100ms sync)
```

---

## Storage & Persistence

**Frontend State Management**:
- **Mode State**: React Context or Zustand store (P1 implementation)
- **Animation State**: React hook (useAnimationController)
- **Audio State**: React hook (useAudioFeedback)
- **Manual Trigger Event**: Ephemeral (not persisted)

**Browser APIs**:
- **Web Audio API**: AudioContext, AudioBuffer (in-memory buffers)
- **Fetch API**: Load audio files from /assets/audio/ (cached by browser)

**Backend Storage**: N/A (feature is frontend-only)

---

## Testing Validation

**Unit Test Coverage** (TDD per Article III):

| Entity/State | Test File | Coverage Target |
|--------------|-----------|-----------------|
| AIActionType enum | `types.test.ts` | 100% (trivial) |
| FEEDBACK_CONFIG | `config.test.ts` | 100% (validate all keys present) |
| ManualTriggerEvent | `useManualTrigger.test.ts` | 100% (event creation) |
| ModeState | `useMode.test.ts` | 100% (P1 test, verify button state) |
| AnimationControllerState | `useAnimationController.test.ts` | 90%+ (cancel-and-replace logic) |
| AudioControllerState | `useAudioFeedback.test.ts` | 80%+ (mock AudioContext) |

**Integration Tests** (Playwright E2E):
- Manual trigger flow: Click button → Provoke API → Glitch + Clank
- Sensory feedback flow: Provoke action → Animation + Audio sync
- Cancel-and-replace: Rapid actions → Old animation/audio cancelled

---

**Data Model Status**: ✅ Complete  
**Next Artifact**: contracts/frontend-components.md
