# Frontend Component Contracts

**Feature**: Vibe Enhancements (002-vibe-enhancements)  
**Date**: 2025-11-06  
**Status**: Contracts Defined

## Overview

This document defines the public interfaces (contracts) for all React components and hooks created for the Vibe Enhancements feature. These contracts serve as the API specification for implementation and testing (TDD per Article III).

---

## Component Contracts

### 1. ManualTriggerButton

**Purpose**: Renders manual trigger button for instant AI intervention in Muse mode.

**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005

**TypeScript Interface**:

```typescript
/**
 * Manual trigger button for instant AI intervention in Muse mode.
 * 
 * **Behavior**:
 * - Displays "I'm stuck!" label when enabled (FR-001)
 * - Enabled only in Muse mode; disabled in Loki/Off modes (FR-002)
 * - Triggers AI Provoke action immediately on click (FR-003)
 * - Debounces clicks with 2-second cooldown (FR-004)
 * - Shows loading state during API call (FR-005)
 * 
 * **Accessibility**:
 * - `aria-label`: "I'm stuck! Trigger AI assistance"
 * - `disabled` attribute when not in Muse mode or loading
 * 
 * @example
 * ```tsx
 * <ManualTriggerButton />
 * ```
 */
export function ManualTriggerButton(): JSX.Element;
```

**Props**: None (self-contained, reads mode from context/hook)

**State Dependencies**:
- `useMode()` - Current system mode (muse/loki/off)
- `useManualTrigger()` - Trigger function and loading state

**DOM Output**:

```html
<!-- When enabled (Muse mode, not loading) -->
<button
  data-testid="manual-trigger-button"
  aria-label="I'm stuck! Trigger AI assistance"
  disabled={false}
>
  I'm stuck!
</button>

<!-- When disabled (Loki/Off mode) -->
<button
  data-testid="manual-trigger-button"
  aria-label="I'm stuck! Trigger AI assistance"
  disabled={true}
  style="opacity: 0.5; cursor: not-allowed;"
>
  I'm stuck!
</button>

<!-- When loading (API call in progress) -->
<button
  data-testid="manual-trigger-button"
  aria-label="I'm stuck! Trigger AI assistance"
  disabled={true}
>
  Thinking...
</button>
```

**Test Cases** (TDD):

```typescript
// ManualTriggerButton.test.tsx
describe('ManualTriggerButton', () => {
  it('renders enabled in Muse mode', () => {
    // Mock useMode to return 'muse'
    // Assert button is enabled
  });
  
  it('renders disabled in Loki mode', () => {
    // Mock useMode to return 'loki'
    // Assert button is disabled with opacity: 0.5
  });
  
  it('renders disabled in Off mode', () => {
    // Mock useMode to return 'off'
    // Assert button is disabled
  });
  
  it('calls trigger function on click', () => {
    // Mock useMode to return 'muse'
    // Click button
    // Assert useManualTrigger().trigger was called
  });
  
  it('shows loading state during API call', () => {
    // Mock useManualTrigger to return isLoading: true
    // Assert button text is "Thinking..."
    // Assert button is disabled
  });
  
  it('debounces clicks (2-second cooldown)', async () => {
    // Click button twice within 2 seconds
    // Assert trigger called only once
  });
});
```

---

### 2. SensoryFeedback

**Purpose**: Orchestrates visual and audio feedback for AI actions.

**Requirements**: FR-006 through FR-020

**TypeScript Interface**:

```typescript
/**
 * Sensory feedback component for AI actions.
 * 
 * **Behavior**:
 * - Displays visual animation based on action type (Glitch/Fade-out/Shake)
 * - Plays audio effect synchronized with animation (<100ms lag, SC-008)
 * - Cancels previous animation/audio when new action triggers (FR-018, FR-019)
 * - Respects prefers-reduced-motion for accessibility (FR-014)
 * 
 * **Props**:
 * - `actionType`: AI action that triggered (provoke/delete/reject/null)
 * 
 * @example
 * ```tsx
 * <SensoryFeedback actionType={AIActionType.PROVOKE} />
 * ```
 */
export function SensoryFeedback(props: {
  /** AI action type (null when idle) */
  actionType: AIActionType | null;
}): JSX.Element;
```

**Props**:

```typescript
interface SensoryFeedbackProps {
  /** 
   * AI action type that determines which animation/audio to play.
   * - AIActionType.PROVOKE → Glitch + Clank
   * - AIActionType.DELETE → Fade-out + Whoosh
   * - AIActionType.REJECT → Shake + Bonk
   * - null → Idle (no animation/audio)
   */
  actionType: AIActionType | null;
}
```

**State Dependencies**:
- `useAnimationController()` - Animation lifecycle management
- `useAudioFeedback()` - Audio playback management
- `useReducedMotion()` (Framer Motion) - Accessibility detection

**DOM Output**:

```html
<!-- When actionType is PROVOKE -->
<div
  data-testid="sensory-feedback"
  data-animation="glitch"
  role="status"
  aria-live="polite"
>
  <!-- Framer Motion AnimatePresence wrapper -->
  <motion.div
    key="provoke-1699900000000"
    initial={{ opacity: 0 }}
    animate={{ opacity: [1, 0.5, 1, 0.3, 1, 0] }}  <!-- Glitch effect -->
    transition={{ duration: 1.5 }}
  />
</div>

<!-- When actionType is null (idle) -->
<div
  data-testid="sensory-feedback"
  data-animation="idle"
  role="status"
  aria-live="polite"
/>
```

**Test Cases** (TDD):

```typescript
// SensoryFeedback.test.tsx
describe('SensoryFeedback', () => {
  it('plays Glitch animation for PROVOKE action', () => {
    render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);
    // Assert data-animation="glitch"
    // Assert animation keyframes match FEEDBACK_CONFIG
  });
  
  it('plays Fade-out animation for DELETE action', () => {
    render(<SensoryFeedback actionType={AIActionType.DELETE} />);
    // Assert data-animation="fadeout"
  });
  
  it('plays Clank audio for PROVOKE action', () => {
    // Mock useAudioFeedback
    render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);
    // Assert audio.play() called with 'clank.mp3'
  });
  
  it('cancels previous animation when new action triggers', () => {
    const { rerender } = render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);
    // Assert provoke animation started
    rerender(<SensoryFeedback actionType={AIActionType.DELETE} />);
    // Assert provoke animation cancelled
    // Assert delete animation started
  });
  
  it('respects prefers-reduced-motion', () => {
    // Mock useReducedMotion to return true
    render(<SensoryFeedback actionType={AIActionType.PROVOKE} />);
    // Assert animation uses reduced-motion variants (opacity change only)
  });
});
```

---

## Hook Contracts

### 3. useManualTrigger

**Purpose**: Manages manual AI intervention trigger with debouncing and loading state.

**Requirements**: FR-003, FR-004, FR-005

**TypeScript Interface**:

```typescript
/**
 * Hook for manual AI intervention trigger.
 * 
 * **Behavior**:
 * - Calls existing P1 triggerProvoke() API endpoint (FR-003)
 * - Debounces calls with 2-second cooldown (FR-004)
 * - Provides loading state for UI feedback (FR-005)
 * 
 * @returns trigger function and loading state
 * 
 * @example
 * ```tsx
 * const { trigger, isLoading } = useManualTrigger();
 * 
 * <button onClick={trigger} disabled={isLoading}>
 *   {isLoading ? 'Thinking...' : "I'm stuck!"}
 * </button>
 * ```
 */
export function useManualTrigger(): {
  /** 
   * Trigger function (debounced with 2-second cooldown).
   * Calls P1 Provoke API endpoint.
   */
  trigger: () => Promise<void>;
  
  /** 
   * Loading state (true during API call).
   * Used to disable button during execution.
   */
  isLoading: boolean;
};
```

**Dependencies**:
- `triggerProvoke()` - P1 API client function
- `useDebounce()` - Generic debounce hook (2-second cooldown)

**Test Cases** (TDD):

```typescript
// useManualTrigger.test.ts
describe('useManualTrigger', () => {
  it('calls triggerProvoke API on trigger()', async () => {
    const mockProvoke = vi.fn().mockResolvedValue(undefined);
    // Mock triggerProvoke
    const { result } = renderHook(() => useManualTrigger());
    await result.current.trigger();
    expect(mockProvoke).toHaveBeenCalledOnce();
  });
  
  it('sets isLoading to true during API call', async () => {
    const { result } = renderHook(() => useManualTrigger());
    const promise = result.current.trigger();
    expect(result.current.isLoading).toBe(true);
    await promise;
    expect(result.current.isLoading).toBe(false);
  });
  
  it('debounces calls (2-second cooldown)', async () => {
    vi.useFakeTimers();
    const mockProvoke = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useManualTrigger());
    
    result.current.trigger();
    result.current.trigger();  // Should be ignored (within 2s)
    
    vi.advanceTimersByTime(2000);
    result.current.trigger();  // Should execute (after 2s)
    
    expect(mockProvoke).toHaveBeenCalledTimes(2);  // First + third call only
  });
});
```

---

### 4. useAnimationController

**Purpose**: Manages animation lifecycle with cancel-and-replace behavior.

**Requirements**: FR-006, FR-007, FR-010, FR-011, FR-014, FR-018

**TypeScript Interface**:

```typescript
/**
 * Hook for animation lifecycle management.
 * 
 * **Behavior**:
 * - Generates unique animation keys for Framer Motion (cancel-and-replace via remount)
 * - Provides animation variants based on action type (Glitch/Fade-out/Shake)
 * - Respects prefers-reduced-motion setting (FR-14)
 * - Cancels previous animation when new action triggers (FR-018)
 * 
 * @param actionType - Current AI action type (null when idle)
 * @returns animation key and variants for Framer Motion
 * 
 * @example
 * ```tsx
 * const { animationKey, variants } = useAnimationController(AIActionType.PROVOKE);
 * 
 * <AnimatePresence mode="wait">
 *   <motion.div
 *     key={animationKey}
 *     initial="hidden"
 *     animate="visible"
 *     variants={variants}
 *   />
 * </AnimatePresence>
 * ```
 */
export function useAnimationController(
  actionType: AIActionType | null
): {
  /** 
   * Unique key for Framer Motion (format: "${actionType}-${timestamp}").
   * Changes when actionType changes → triggers remount → cancels old animation.
   */
  animationKey: string;
  
  /** 
   * Framer Motion variants for current action type.
   * Automatically switches to reduced-motion variants if prefers-reduced-motion is set.
   */
  variants: Record<string, any>;  // Framer Motion Variants type
};
```

**Dependencies**:
- `useReducedMotion()` (Framer Motion) - Detects accessibility preference
- `FEEDBACK_CONFIG` - Animation configuration (type, duration)

**Test Cases** (TDD):

```typescript
// useAnimationController.test.ts
describe('useAnimationController', () => {
  it('generates unique key for each action type', () => {
    const { result: result1 } = renderHook(() => useAnimationController(AIActionType.PROVOKE));
    const { result: result2 } = renderHook(() => useAnimationController(AIActionType.DELETE));
    
    expect(result1.current.animationKey).toMatch(/provoke-\d+/);
    expect(result2.current.animationKey).toMatch(/delete-\d+/);
    expect(result1.current.animationKey).not.toBe(result2.current.animationKey);
  });
  
  it('returns Glitch variants for PROVOKE', () => {
    const { result } = renderHook(() => useAnimationController(AIActionType.PROVOKE));
    
    expect(result.current.variants.visible).toMatchObject({
      opacity: [1, 0.5, 1, 0.3, 1, 0],  // Glitch keyframes
      transition: { duration: 1.5 }
    });
  });
  
  it('returns Fade-out variants for DELETE', () => {
    const { result } = renderHook(() => useAnimationController(AIActionType.DELETE));
    
    expect(result.current.variants.visible).toMatchObject({
      opacity: 0,  // Fade to transparent
      transition: { duration: 0.75, ease: 'easeOut' }
    });
  });
  
  it('uses reduced-motion variants when prefers-reduced-motion is set', () => {
    // Mock useReducedMotion to return true
    const { result } = renderHook(() => useAnimationController(AIActionType.PROVOKE));
    
    // Assert variants are simplified (no glitch, just opacity change)
    expect(result.current.variants.visible).toMatchObject({
      opacity: 1,
      transition: { duration: 0.2 }  // Instant change, no animation
    });
  });
  
  it('changes key when action type changes (cancel-and-replace)', () => {
    const { result, rerender } = renderHook(
      ({ actionType }) => useAnimationController(actionType),
      { initialProps: { actionType: AIActionType.PROVOKE } }
    );
    
    const initialKey = result.current.animationKey;
    
    rerender({ actionType: AIActionType.DELETE });
    
    expect(result.current.animationKey).not.toBe(initialKey);
    expect(result.current.animationKey).toMatch(/delete-\d+/);
  });
});
```

---

### 5. useAudioFeedback

**Purpose**: Manages Web Audio API lifecycle and playback.

**Requirements**: FR-008, FR-009, FR-012, FR-013, FR-015, FR-016, FR-019

**TypeScript Interface**:

```typescript
/**
 * Hook for audio feedback management using Web Audio API.
 * 
 * **Behavior**:
 * - Preloads and decodes audio buffers on mount (Clank, Whoosh, Bonk)
 * - Plays audio synchronized with animations (<100ms lag, SC-008)
 * - Stops previous audio before playing new sound (FR-019)
 * - Gracefully handles AudioContext errors (FR-015)
 * 
 * @param actionType - Current AI action type (null when idle)
 * @returns playback function and loading/error state
 * 
 * @example
 * ```tsx
 * const { playAudio, isLoading, error } = useAudioFeedback();
 * 
 * useEffect(() => {
 *   if (actionType) {
 *     playAudio(actionType);  // Play Clank/Whoosh/Bonk based on action
 *   }
 * }, [actionType, playAudio]);
 * ```
 */
export function useAudioFeedback(): {
  /** 
   * Play audio for given action type.
   * Automatically stops previous audio (cancel-and-replace).
   */
  playAudio: (actionType: AIActionType) => Promise<void>;
  
  /** 
   * Loading state (true while decoding audio buffers on mount).
   */
  isLoading: boolean;
  
  /** 
   * Error state (non-null if AudioContext creation fails).
   * Component should gracefully degrade (visual feedback only).
   */
  error: Error | null;
};
```

**Dependencies**:
- `AudioContext` (Web Audio API) - Browser native
- `fetch()` - Load audio files from /assets/audio/
- `FEEDBACK_CONFIG` - Audio file paths

**Test Cases** (TDD):

```typescript
// useAudioFeedback.test.ts
describe('useAudioFeedback', () => {
  it('preloads audio buffers on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAudioFeedback());
    
    expect(result.current.isLoading).toBe(true);
    await waitForNextUpdate();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
  
  it('plays Clank audio for PROVOKE action', async () => {
    const mockAudioContext = createMockAudioContext();  // Helper
    const { result } = renderHook(() => useAudioFeedback());
    
    await result.current.playAudio(AIActionType.PROVOKE);
    
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledWith();
    expect(mockAudioContext.bufferSource.buffer).toBe(mockAudioContext.buffers.clank);
    expect(mockAudioContext.bufferSource.start).toHaveBeenCalledWith(0);
  });
  
  it('stops previous audio before playing new sound (FR-019)', async () => {
    const mockSource1 = createMockBufferSource();
    const mockSource2 = createMockBufferSource();
    const { result } = renderHook(() => useAudioFeedback());
    
    await result.current.playAudio(AIActionType.PROVOKE);  // Start Clank
    expect(mockSource1.start).toHaveBeenCalled();
    
    await result.current.playAudio(AIActionType.DELETE);   // Start Whoosh
    expect(mockSource1.stop).toHaveBeenCalled();  // Previous sound stopped
    expect(mockSource2.start).toHaveBeenCalled();
  });
  
  it('handles AudioContext creation failure gracefully (FR-015)', () => {
    // Mock AudioContext constructor to throw error
    global.AudioContext = vi.fn(() => {
      throw new Error('AudioContext not supported');
    });
    
    const { result } = renderHook(() => useAudioFeedback());
    
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('AudioContext not supported');
    expect(() => result.current.playAudio(AIActionType.PROVOKE)).not.toThrow();
  });
});
```

---

## API Integration (P1 Endpoints)

### Existing P1 API Client

**No new backend endpoints required.** This feature reuses existing P1 API client:

```typescript
// src/services/ai-actions.ts (P1 implementation - assumed to exist)

/**
 * Trigger AI Provoke action (Muse mode).
 * Injects provocative content to help user overcome writer's block.
 * 
 * @throws {Error} If API call fails (network timeout, server error)
 */
export async function triggerProvoke(): Promise<void>;

/**
 * Trigger AI Delete action (Loki mode).
 * Deletes user-selected text as punishment.
 * 
 * @throws {Error} If API call fails
 */
export async function triggerDelete(): Promise<void>;
```

**Manual Trigger Integration**:

```typescript
// useManualTrigger.ts calls existing P1 API
import { triggerProvoke } from '../services/ai-actions';

export function useManualTrigger() {
  const trigger = async () => {
    await triggerProvoke();  // Reuses P1 endpoint
  };
  return { trigger, isLoading };
}
```

---

## Contract Validation Checklist

**Before Implementation** (TDD per Article III):

- [ ] All component props and return types defined
- [ ] All hook interfaces and dependencies listed
- [ ] All test cases written (failing tests before implementation)
- [ ] All accessibility attributes documented (aria-label, role, etc.)
- [ ] All error handling scenarios covered (FR-015, FR-016)

**After Implementation**:

- [ ] All test cases pass (Red → Green → Refactor)
- [ ] JSDoc comments present for all exports (Article V)
- [ ] TypeScript strict mode passes (no `any` types)
- [ ] ESLint jsdoc plugin passes (documentation enforced)
- [ ] Playwright E2E tests pass (manual trigger + sensory feedback flows)

---

**Contracts Status**: ✅ Complete  
**Next Artifact**: quickstart.md
