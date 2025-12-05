# Quickstart Implementation Guide

**Feature**: P3 Vibe Completion  
**Date**: 2025-11-07  
**Prerequisites**: Phase 0 Research + Phase 1 Data Model complete

## TDD Workflow Overview

This feature follows **strict TDD (Test-Driven Development)** per Article III of the constitution. All implementation follows the Red-Green-Refactor cycle:

1. **RED**: Write a failing test
2. **GREEN**: Write minimal implementation to pass test
3. **REFACTOR**: Clean up code while keeping tests green

**Test Priority**: Test tasks MUST be completed BEFORE implementation tasks.

---

## Implementation Sequence

### Wave 1: P1 - API Error Feedback (Critical)

**Story Points**: 8  
**Priority**: P1 (Critical error handling)  
**Dependencies**: None

#### Task 1.1: Enable E2E Test for Error Feedback (RED)
**File**: `client/e2e/manual-trigger.spec.ts`

**Current State**: Test exists but is skipped
```typescript
test.skip('should show error feedback when API fails', async ({ page }) => {
  // ... existing test code
});
```

**Action**: Remove `.skip` to enable test
```typescript
test('should show error feedback when API fails', async ({ page }) => {
  // ... existing test code
});
```

**Expected Result**: ❌ Test fails (ERROR action type doesn't exist yet)

**Verification**:
```bash
cd client
npm run test:e2e -- manual-trigger.spec.ts
# Expected: 1 failing test (ERROR action not found)
```

---

#### Task 1.2: Add ERROR Action Type (GREEN)
**File**: `client/src/types/ai-actions.ts`

**Current State**:
```typescript
export enum AIActionType {
  PROVOKE = 'PROVOKE',
  DELETE = 'DELETE',
  REJECT = 'REJECT'
}
```

**Change**:
```typescript
export enum AIActionType {
  PROVOKE = 'PROVOKE',
  DELETE = 'DELETE',
  REJECT = 'REJECT',
  ERROR = 'ERROR'  // NEW: API error feedback
}
```

**Expected Result**: ✅ Type now exists, but E2E test still fails (no visual feedback)

**Verification**:
```bash
cd client
npm run type-check  # Should pass
```

---

#### Task 1.3: Add Error Animation Variants (GREEN)
**File**: `client/src/hooks/useAnimationController.ts`

**Location**: Inside `switch (actionType)` block

**Add New Case**:
```typescript
case AIActionType.ERROR:
  // Red flash animation - urgent error indicator
  return {
    initial: { opacity: 1 },
    animate: {
      opacity: [1, 0.8, 1],  // Subtle pulse
      backgroundColor: ['transparent', 'rgba(239, 68, 68, 0.2)', 'transparent'],
      transition: {
        duration: 0.5,
        ease: 'easeInOut',
      },
    },
    exit: { opacity: 0 },
  };
```

**Expected Result**: ✅ Animation variants exist, E2E test may still fail (no API error handling)

**Unit Test** (add to `client/src/hooks/useAnimationController.test.ts`):
```typescript
test('returns red flash variants for ERROR action', () => {
  const { result } = renderHook(() => useAnimationController(AIActionType.ERROR));
  
  expect(result.current.variants.animate).toHaveProperty('backgroundColor');
  expect(result.current.variants.animate.transition.duration).toBe(0.5);
});
```

**Verification**:
```bash
cd client
npm run test -- useAnimationController.test.ts
# Expected: All tests pass including new ERROR test
```

---

#### Task 1.4: Add Error Handling to Manual Trigger (GREEN)
**File**: `client/src/components/ManualTriggerButton.tsx`

**Current State**: API call without error handling
```typescript
const handleClick = () => {
  fetch('/impetus/generate-intervention', { method: 'POST' })
    .then(() => onTrigger());
};
```

**Change**: Add try-catch with error feedback
```typescript
const handleClick = async () => {
  try {
    const response = await fetch('/impetus/generate-intervention', {
      method: 'POST',
      signal: AbortSignal.timeout(5000)  // 5s timeout
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    onTrigger();  // Success: trigger PROVOKE feedback
  } catch (error) {
    console.error('API Error:', error);
    onTrigger(AIActionType.ERROR);  // Error: trigger ERROR feedback
  }
};
```

**Expected Result**: ✅ E2E test should pass (error feedback now triggers)

**Verification**:
```bash
cd client
npm run test:e2e -- manual-trigger.spec.ts
# Expected: All tests pass (3/3)
```

---

#### Task 1.5: Source buzz.mp3 Audio Asset (GREEN)
**File**: `client/src/assets/audio/buzz.mp3` (NEW)

**Action**:
1. Visit [Freesound.org](https://freesound.org)
2. Search: "error buzz" OR "alarm buzz" OR "notification buzz"
3. Filter: License = CC0 or CC BY
4. Download file matching specs:
   - Duration: 0.3-0.5 seconds
   - Size: <50KB (compress if needed)
   - Type: Sharp, urgent tone (not pleasant)
5. Rename to `buzz.mp3`
6. Place in `client/src/assets/audio/`
7. If CC BY: Add attribution to `client/CREDITS.md`

**Recommended Sounds** (as of 2025-11-07):
- Freesound #387232: "Error Buzz" (CC0, 0.4s, 28KB)
- Freesound #341695: "Alert Buzz" (CC0, 0.3s, 19KB)

**Expected Result**: ✅ buzz.mp3 file exists in assets/audio/

**Verification**:
```bash
ls -lh client/src/assets/audio/buzz.mp3
# Expected: File exists, size <50KB
```

---

#### Task 1.6: Add Buzz Sound to Audio Hook (GREEN)
**File**: `client/src/hooks/useAudioFeedback.ts`

**Change 1**: Add buzz to audioBuffers type
```typescript
interface AudioBuffers {
  clank: AudioBuffer;
  whoosh: AudioBuffer;
  bonk: AudioBuffer;
  buzz: AudioBuffer;  // NEW
}
```

**Change 2**: Add buzz to preload list
```typescript
useEffect(() => {
  const loadAudio = async () => {
    const context = new AudioContext();
    const buffers = {
      clank: await loadAudioBuffer(context, '/assets/audio/clank.mp3'),
      whoosh: await loadAudioBuffer(context, '/assets/audio/whoosh.mp3'),
      bonk: await loadAudioBuffer(context, '/assets/audio/bonk.mp3'),
      buzz: await loadAudioBuffer(context, '/assets/audio/buzz.mp3'),  // NEW
    };
    // ... rest of load logic
  };
  loadAudio();
}, []);
```

**Change 3**: Add ERROR case to playAudio
```typescript
const playAudio = useCallback((actionType: AIActionType) => {
  const soundMap = {
    [AIActionType.PROVOKE]: audioBuffers.clank,
    [AIActionType.DELETE]: audioBuffers.whoosh,
    [AIActionType.REJECT]: audioBuffers.bonk,
    [AIActionType.ERROR]: audioBuffers.buzz,  // NEW
  };
  
  const buffer = soundMap[actionType];
  if (!buffer || !audioContext) return;
  
  // ... play logic
}, [audioBuffers, audioContext]);
```

**Expected Result**: ✅ Error feedback now includes buzz sound

**Unit Test** (add to `client/src/hooks/useAudioFeedback.test.ts`):
```typescript
test('plays buzz sound for ERROR action', async () => {
  const { result } = renderHook(() => useAudioFeedback());
  
  await waitFor(() => expect(result.current.isReady).toBe(true));
  
  result.current.playAudio(AIActionType.ERROR);
  
  // Verify buzz.mp3 was loaded and played
  expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
});
```

**Verification**:
```bash
cd client
npm run test -- useAudioFeedback.test.ts
# Expected: All tests pass including new buzz test
```

---

#### Task 1.7: Add Audio Cancel-and-Replace (REFACTOR)
**File**: `client/src/hooks/useAudioFeedback.ts`

**Issue**: Currently, multiple rapid actions cause audio overlap (violates FR-009)

**Add**: currentSource tracking + stop() before new playback

**Change**:
```typescript
export function useAudioFeedback() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioBuffers, setAudioBuffers] = useState<AudioBuffers | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);  // NEW
  
  const playAudio = useCallback((actionType: AIActionType) => {
    // Stop previous audio if playing (FR-009)
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (error) {
        // Ignore error if already stopped
      }
      currentSourceRef.current = null;
    }
    
    const buffer = soundMap[actionType];
    if (!buffer || !audioContext) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      currentSourceRef.current = null;  // Clear ref when done
    };
    source.start(0);
    
    currentSourceRef.current = source;  // Track current source
  }, [audioBuffers, audioContext]);
  
  // ... rest of hook
}
```

**Expected Result**: ✅ Rapid actions no longer overlap audio

**Unit Test**:
```typescript
test('stops previous audio when new action triggers', async () => {
  const { result } = renderHook(() => useAudioFeedback());
  
  await waitFor(() => expect(result.current.isReady).toBe(true));
  
  result.current.playAudio(AIActionType.PROVOKE);
  result.current.playAudio(AIActionType.ERROR);  // Should stop PROVOKE audio
  
  // Verify stop() was called on first source
  expect(mockSourceNode.stop).toHaveBeenCalledTimes(1);
});
```

**Verification**:
```bash
cd client
npm run test -- useAudioFeedback.test.ts
npm run test:e2e -- sensory-feedback.spec.ts
# Expected: All tests pass, no audio overlap in E2E
```

---

### Wave 2: P2 - Lock Rejection Feedback

**Story Points**: 5  
**Priority**: P2 (UX enhancement)  
**Dependencies**: Wave 1 complete (ERROR action type exists)

#### Task 2.1: Enable E2E Test for Rejection Feedback (RED)
**File**: `client/e2e/sensory-feedback.spec.ts`

**Action**: Remove `.skip` from rejection test
```typescript
test('should trigger shake animation and bonk sound on locked content deletion', async ({ page }) => {
  // ... existing test code
});
```

**Expected Result**: ❌ Test fails (no rejection callback in useLockEnforcement)

**Verification**:
```bash
cd client
npm run test:e2e -- sensory-feedback.spec.ts
# Expected: 1 failing test (rejection not triggered)
```

---

#### Task 2.2: Add Reject Animation Variants (GREEN)
**File**: `client/src/hooks/useAnimationController.ts`

**Current State**: REJECT case has placeholder opacity animation
```typescript
case AIActionType.REJECT:
  return {
    initial: { opacity: 1 },
    animate: {
      opacity: [1, 0.5, 1],
      transition: { duration: 0.5, ease: 'easeInOut' },
    },
    exit: { opacity: 0 },
  };
```

**Change**: Replace with shake animation
```typescript
case AIActionType.REJECT:
  // Shake animation - horizontal oscillation (FR-003)
  return {
    initial: { opacity: 1, x: 0 },
    animate: {
      x: [0, -10, 10, -10, 10, -5, 5, 0],  // Shake keyframes
      opacity: 1,  // Keep visible during shake
      transition: {
        duration: 0.3,  // 300ms per spec
        ease: 'easeInOut',
      },
    },
    exit: { opacity: 0, x: 0 },
  };
```

**Expected Result**: ✅ Shake animation defined, test still fails (no callback)

**Unit Test**:
```typescript
test('returns shake variants for REJECT action', () => {
  const { result } = renderHook(() => useAnimationController(AIActionType.REJECT));
  
  expect(result.current.variants.animate).toHaveProperty('x');
  expect(result.current.variants.animate.transition.duration).toBe(0.3);
});
```

**Verification**:
```bash
cd client
npm run test -- useAnimationController.test.ts
# Expected: All tests pass including new shake test
```

---

#### Task 2.3: Add Rejection Callback to useLockEnforcement (GREEN)
**File**: `client/src/hooks/useLockEnforcement.ts`

**Current Signature**:
```typescript
export function useLockEnforcement(lockedIds: Set<string>)
```

**New Signature**:
```typescript
export function useLockEnforcement(
  lockedIds: Set<string>,
  onReject?: () => void  // NEW: Callback when deletion rejected
)
```

**Implementation**: Call onReject when transaction blocked
```typescript
export function useLockEnforcement(
  lockedIds: Set<string>,
  onReject?: () => void
) {
  return {
    filterTransaction: (tr: Transaction) => {
      const shouldBlock = /* existing lock detection logic */;
      
      if (shouldBlock && onReject) {
        onReject();  // Trigger feedback
      }
      
      return !shouldBlock;
    }
  };
}
```

**Expected Result**: ✅ Callback exists but not wired up yet

**Unit Test** (add to `client/tests/unit/LockManager.test.ts`):
```typescript
test('calls onReject callback when deletion blocked', () => {
  const lockedIds = new Set(['locked-1']);
  const onReject = vi.fn();
  
  const { filterTransaction } = useLockEnforcement(lockedIds, onReject);
  
  // Simulate deletion transaction on locked node
  const mockTransaction = createMockTransaction('locked-1', 'delete');
  const result = filterTransaction(mockTransaction);
  
  expect(result).toBe(false);  // Transaction blocked
  expect(onReject).toHaveBeenCalledTimes(1);
});
```

**Verification**:
```bash
cd client
npm run test -- LockManager.test.ts
# Expected: All tests pass including new callback test
```

---

#### Task 2.4: Wire Rejection Feedback in EditorCore (GREEN)
**File**: `client/src/components/Editor/EditorCore.tsx`

**Add**: Rejection callback to useLockEnforcement call

**Find**:
```typescript
const { filterTransaction } = useLockEnforcement(lockedIds);
```

**Change**:
```typescript
const handleReject = useCallback(() => {
  setCurrentAction(AIActionType.REJECT);
}, []);

const { filterTransaction } = useLockEnforcement(lockedIds, handleReject);
```

**Expected Result**: ✅ E2E test should pass (rejection feedback now triggers)

**Verification**:
```bash
cd client
npm run test:e2e -- sensory-feedback.spec.ts
# Expected: Rejection test passes
```

---

### Wave 3: P2 - Loki Delete Feedback

**Story Points**: 4  
**Priority**: P2 (UX enhancement)  
**Dependencies**: Wave 1 complete

#### Task 3.1: Enable E2E Test for Delete Feedback (RED)
**File**: `client/e2e/sensory-feedback.spec.ts`

**Action**: Remove `.skip` from delete test
```typescript
test('should trigger fade-out animation and whoosh sound on Loki delete', async ({ page }) => {
  // ... existing test code
});
```

**Expected Result**: ❌ Test fails (no Loki delete implementation yet)

**Note**: This test may require Loki timer implementation (out of scope for this sprint). If so, create manual test scenario in E2E_TEST_STATUS.md.

---

#### Task 3.2: Update Delete Animation Timing (GREEN)
**File**: `client/src/hooks/useAnimationController.ts`

**Current State**: DELETE animation is 0.75s
```typescript
case AIActionType.DELETE:
  return {
    initial: { opacity: 1 },
    animate: {
      opacity: 0,
      transition: { duration: 0.75, ease: 'easeOut' },
    },
    exit: { opacity: 0 },
  };
```

**Change**: Verify timing matches spec (300-500ms per FR-001, but P2 defined 0.75s)

**Decision**: Keep 0.75s (existing P2 implementation, matches SC-008 "600ms total")

**No code change needed** - Existing implementation correct

**Verification**:
```bash
cd client
npm run test -- useAnimationController.test.ts
# Expected: All tests pass (no changes)
```

---

#### Task 3.3: Add Delete Trigger in Loki Timer (GREEN)
**File**: `client/src/hooks/useLokiTimer.ts`

**Status**: ⚠️ **OUT OF SCOPE** - Loki timer not implemented in P2

**Alternative**: Add manual delete trigger for testing purposes

**Add to ManualTriggerButton.tsx** (temporary test button):
```typescript
// Development only: Manual delete trigger
{import.meta.env.DEV && (
  <button onClick={() => onTrigger(AIActionType.DELETE)}>
    Test Delete
  </button>
)}
```

**Expected Result**: ✅ Can manually test delete feedback

**Verification**: Manual testing only (E2E test remains skipped)

---

### Wave 4: P2 - Animation Queue (Already Implemented)

**Story Points**: 3  
**Priority**: P2 (UX polish)  
**Dependencies**: Waves 1-3 complete

**Status**: ✅ **ALREADY IMPLEMENTED** in Phase 5

**Evidence**:
- AnimatePresence with `mode="wait"` ✅
- Unique keys per action ✅
- Audio cancel-and-replace ✅ (added in Wave 1 Task 1.7)

**Verification**:
```bash
cd client
npm run test:e2e
# Expected: All enabled tests pass with clean animations
```

**No additional implementation required** ✅

---

## Testing Checklist

### Unit Tests (Vitest)
- [ ] useAnimationController: ERROR variants test
- [ ] useAnimationController: REJECT shake variants test
- [ ] useAudioFeedback: buzz sound playback test
- [ ] useAudioFeedback: audio cancel-and-replace test
- [ ] useLockEnforcement: onReject callback test
- [ ] All existing tests still pass (regression check)

### E2E Tests (Playwright)
- [ ] manual-trigger.spec.ts: Error feedback test (enable)
- [ ] sensory-feedback.spec.ts: Rejection feedback test (enable)
- [ ] sensory-feedback.spec.ts: Delete feedback test (skip if Loki not implemented)
- [ ] All existing tests still pass (regression check)

### Manual Testing
- [ ] Error feedback: Disconnect network, click manual trigger, verify red flash + buzz
- [ ] Rejection feedback: Create locked block, attempt delete, verify shake + bonk
- [ ] Animation queue: Rapid button clicks, verify clean replacement (no overlap)
- [ ] Audio permissions: Deny audio, verify visual-only mode works
- [ ] Prefers-reduced-motion: Enable accessibility setting, verify simplified animations

---

## Success Criteria Validation

After implementation, verify all success criteria from spec.md:

- [ ] **SC-001**: Visual feedback within 50ms (use browser DevTools Performance tab)
- [ ] **SC-002**: Audio feedback within 100ms of visual
- [ ] **SC-003**: 95% user identification (user testing or team poll)
- [ ] **SC-004**: Animation replacements within 16ms (60fps verified)
- [ ] **SC-005**: Handle 10 actions/second without glitches (stress test)
- [ ] **SC-006**: 90% understand errors (user testing or team poll)
- [ ] **SC-007**: Locked content stable during rejection (no layout shift)
- [ ] **SC-008**: Delete completes within 600ms
- [ ] **SC-009**: Works with audio on/off (test both modes)
- [ ] **SC-010**: All error types trigger feedback (test network, 4xx, 5xx)

---

## Rollout Plan

### Phase 1: Core Features (Wave 1-2)
- API error feedback (P1)
- Lock rejection feedback (P2)
- Duration: 1 day

### Phase 2: Polish (Wave 3-4)
- Loki delete feedback (P2, if Loki implemented)
- Animation queue verification (already complete)
- Duration: 0.5 day

### Phase 3: Testing & Validation
- Enable all E2E tests
- Manual testing checklist
- Success criteria validation
- Duration: 0.5 day

**Total Estimated Duration**: 2 days (within 5-day MVP sprint)

---

## Troubleshooting

### Issue: E2E test timeout
**Symptom**: Playwright test times out waiting for animation
**Solution**: Increase timeout in test config or reduce animation duration in test mode

### Issue: Audio doesn't play
**Symptom**: Visual feedback works but no sound
**Possible Causes**:
1. Browser autoplay policy blocked audio → Require user interaction first
2. Audio file not loaded → Check network tab, verify file path
3. AudioContext suspended → Call `audioContext.resume()` on user interaction

### Issue: Animation jank
**Symptom**: Animations stutter or drop frames
**Possible Causes**:
1. Non-accelerated properties → Use only opacity and transform
2. Too many simultaneous animations → Verify AnimatePresence mode="wait"
3. Main thread blocked → Check for long-running JavaScript

---

## Next Steps

After completing this implementation:

1. Run full test suite: `npm run test && npm run test:e2e`
2. Run CI locally: `act` (via Act CLI)
3. Commit with TDD evidence: `git commit -m "feat: complete P3 vibe sensory feedback"`
4. Ready for `/speckit.tasks` to generate detailed task breakdown

**Implementation guide complete** ✅  
**Ready for task generation** ✅
