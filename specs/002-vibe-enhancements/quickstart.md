# Developer Quickstart: Vibe Enhancements

**Feature**: 002-vibe-enhancements  
**Date**: 2025-11-06  
**Audience**: Developers implementing this P2 feature

## Overview

This P2 feature adds two UX enhancements to the existing P1 Impetus Lock core:

1. **Manual Trigger Button**: "I'm stuck!" button for instant AI intervention (Muse mode only)
2. **Sensory Feedback**: Animations + audio for AI actions (Glitch/Clank, Fade-out/Whoosh, Shake/Bonk)

**Timeline**: ~6-8 hours (1 day) for TDD implementation  
**Complexity**: Low (frontend-only, no backend changes)  
**Dependencies**: Framer Motion (already installed), Web Audio API (browser native)

---

## Prerequisites

### Required Knowledge
- React 19 + TypeScript 5.9 (project standard)
- Framer Motion basics (AnimatePresence, variants)
- Web Audio API (AudioContext, AudioBuffer)
- TDD workflow (Red-Green-Refactor per Article III)

### Environment Setup

```bash
# 1. Ensure you're on feature branch
git checkout 002-vibe-enhancements

# 2. Install dependencies (if not already done)
cd client
npm ci  # Use ci for reproducible builds

# 3. Verify development server runs
npm run dev
# Open http://localhost:5173

# 4. Verify tests run
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright E2E tests
```

---

## Implementation Workflow (TDD)

### Phase 1: Audio Assets (Manual Task - 30 mins)

**Goal**: Download and optimize royalty-free audio files.

```bash
# Navigate to audio assets directory
cd client/src/assets/audio

# Download sounds from Freesound.org or Zapsplat
# - clank.mp3: Metal lock sound (0.5-1s, <100KB)
# - whoosh.mp3: Wind/swoosh sound (0.5-1s, <100KB)
# - bonk.mp3: Already exists from P1 (impact sound)
```

**Search Terms**:
- **Clank**: "metal lock clank", "chain impact", "metal door latch"
- **Whoosh**: "air whoosh", "fast swipe", "wind swoosh"

**Optimization**:
1. Download as MP3 or WAV
2. Trim silence from start/end using Audacity or online tool
3. Convert to MP3 at 192kbps (if not already)
4. Verify file size <100KB

**License Check**:
- ✅ CC0 (public domain) - No attribution required
- ✅ CC BY - Add attribution to client/CREDITS.md

---

### Phase 2: Types & Config (TDD - 1 hour)

**Goal**: Define TypeScript types and configuration.

**Files to Create**:
1. `client/src/types/ai-actions.ts` - AIActionType enum
2. `client/src/config/sensory-feedback.ts` - FEEDBACK_CONFIG constant

**TDD Workflow**:

```bash
# 1. RED: Write failing tests first
cat > client/src/types/ai-actions.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { AIActionType } from './ai-actions';

describe('AIActionType', () => {
  it('has PROVOKE variant', () => {
    expect(AIActionType.PROVOKE).toBe('provoke');
  });
  
  it('has DELETE variant', () => {
    expect(AIActionType.DELETE).toBe('delete');
  });
  
  it('has REJECT variant', () => {
    expect(AIActionType.REJECT).toBe('reject');
  });
});
EOF

# 2. Run tests (should FAIL - enum doesn't exist yet)
npm run test -- ai-actions.test.ts

# 3. GREEN: Write minimal implementation
cat > client/src/types/ai-actions.ts << 'EOF'
export enum AIActionType {
  PROVOKE = 'provoke',
  DELETE = 'delete',
  REJECT = 'reject'
}
EOF

# 4. Run tests (should PASS)
npm run test -- ai-actions.test.ts

# 5. REFACTOR: Add JSDoc comments (Article V)
# (Edit client/src/types/ai-actions.ts to add JSDoc)
```

**Repeat for FEEDBACK_CONFIG** (see contracts/frontend-components.md for structure).

---

### Phase 3: useAudioFeedback Hook (TDD - 2 hours)

**Goal**: Implement Web Audio API wrapper hook.

**TDD Workflow**:

```bash
# 1. RED: Write failing tests (see contracts/frontend-components.md)
touch client/src/hooks/useAudioFeedback.test.ts
# Copy test cases from contracts doc

# 2. Run tests (should FAIL)
npm run test -- useAudioFeedback.test.ts

# 3. GREEN: Implement hook (see research.md for pattern)
touch client/src/hooks/useAudioFeedback.ts
# Implement minimal AudioContext logic

# 4. Run tests (should PASS)
npm run test -- useAudioFeedback.test.ts

# 5. REFACTOR: Add error handling (FR-015), JSDoc (Article V)
```

**Key Implementation Points**:
- Mock `AudioContext` in tests (jsdom doesn't support Web Audio API)
- Use `vi.fn()` to mock `createBufferSource`, `decodeAudioData`
- Test cancel-and-replace behavior (FR-019)

---

### Phase 4: useAnimationController Hook (TDD - 1.5 hours)

**Goal**: Implement Framer Motion animation lifecycle manager.

**TDD Workflow**: Same Red-Green-Refactor cycle as Phase 3.

**Key Implementation Points**:
- Mock `useReducedMotion()` hook in tests
- Test key generation (unique per action type + timestamp)
- Test variant selection (Glitch/Fade-out/Shake)
- Test reduced-motion fallback (FR-014)

---

### Phase 5: SensoryFeedback Component (TDD - 1.5 hours)

**Goal**: Integrate animation + audio hooks into React component.

**TDD Workflow**: Same Red-Green-Refactor cycle.

**Key Implementation Points**:
- Use `@testing-library/react` for component tests
- Mock `useAnimationController` and `useAudioFeedback` hooks
- Test sync between animation start and audio playback (<100ms, SC-008)
- Test cancel-and-replace when actionType prop changes (FR-018, FR-019)

---

### Phase 6: useManualTrigger Hook (TDD - 1 hour)

**Goal**: Implement manual trigger logic with debouncing.

**TDD Workflow**: Same Red-Green-Refactor cycle.

**Key Implementation Points**:
- Mock `triggerProvoke()` P1 API client
- Use `vi.useFakeTimers()` for debouncing tests (2-second cooldown, FR-004)
- Test loading state changes (FR-005)

---

### Phase 7: ManualTriggerButton Component (TDD - 1 hour)

**Goal**: Implement button UI with mode-based enable/disable logic.

**TDD Workflow**: Same Red-Green-Refactor cycle.

**Key Implementation Points**:
- Mock `useMode()` P1 hook (returns 'muse', 'loki', or 'off')
- Mock `useManualTrigger()` hook
- Test disabled states (Loki/Off modes, FR-002)
- Test loading state UI ("Thinking...", FR-005)
- Test accessibility (aria-label, disabled attribute)

---

### Phase 8: E2E Tests (Playwright - 1.5 hours)

**Goal**: Write end-to-end tests for user journeys.

**Files to Create**:
1. `client/e2e/manual-trigger.spec.ts`
2. `client/e2e/sensory-feedback.spec.ts`

**Test Scenarios** (see spec.md acceptance scenarios):

```typescript
// manual-trigger.spec.ts
test('manual trigger button enabled only in Muse mode', async ({ page }) => {
  await page.goto('/');
  
  // Test Muse mode (enabled)
  await page.click('[data-testid="mode-selector-muse"]');
  await expect(page.locator('[data-testid="manual-trigger-button"]')).toBeEnabled();
  
  // Test Loki mode (disabled)
  await page.click('[data-testid="mode-selector-loki"]');
  await expect(page.locator('[data-testid="manual-trigger-button"]')).toBeDisabled();
});

test('manual trigger calls Provoke API and shows feedback', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="mode-selector-muse"]');
  
  // Click manual trigger
  await page.click('[data-testid="manual-trigger-button"]');
  
  // Verify sensory feedback
  await expect(page.locator('[data-testid="sensory-feedback"][data-animation="glitch"]')).toBeVisible();
  
  // Verify audio played (check console logs or DOM events)
  // Note: Playwright can't directly verify audio playback, use console.log markers
});

// sensory-feedback.spec.ts
test('plays correct animation for each AI action type', async ({ page }) => {
  // Test Provoke → Glitch
  // Test Delete → Fade-out
  // Test Reject → Shake (P1 feature, verify still works)
});
```

**Run E2E Tests**:

```bash
npm run test:e2e -- manual-trigger.spec.ts
npm run test:e2e -- sensory-feedback.spec.ts
```

---

## Local Testing Checklist

### Manual Testing (Chrome/Edge/Opera)

```bash
# Start dev server
npm run dev

# Open http://localhost:5173 in Chrome

# Test Manual Trigger Button
1. Switch to Muse mode
2. Click "I'm stuck!" button
3. Verify:
   - Button shows "Thinking..." while loading
   - Glitch animation plays (screen flash, ~1.5s)
   - Clank sound plays (metal lock sound)
   - Button re-enables after 2 seconds (debounce cooldown)

# Test Disabled States
1. Switch to Loki mode → Button grayed out, not clickable
2. Switch to Off mode → Button grayed out, not clickable

# Test Sensory Feedback
1. Trigger Provoke action (manual or automatic) → Glitch + Clank
2. Trigger Delete action (Loki mode) → Fade-out + Whoosh
3. Trigger Reject action (try to delete locked content) → Shake + Bonk (P1)

# Test Accessibility
1. Open DevTools → Settings → Emulate CSS media feature prefers-reduced-motion
2. Trigger Provoke action → Verify animation is simplified (no glitch, just opacity change)
3. Mute browser → Verify visual feedback still works (FR-015)

# Test Cancel-and-Replace
1. Trigger Provoke (Glitch animation starts)
2. Immediately trigger Delete (Glitch cancelled, Fade-out starts)
3. Verify: Old animation stopped, new animation plays, old audio stopped
```

### Automated Testing

```bash
# Unit tests (Vitest)
npm run test

# E2E tests (Playwright - Chrome only)
npm run test:e2e

# Type checking (TypeScript strict mode)
npm run type-check

# Linting (ESLint + JSDoc enforcement)
npm run lint

# Full CI simulation (Act CLI)
cd ../..  # Return to repo root
act -j lint
act -j type-check
act -j frontend-tests
```

---

## Integration Points

### P1 Dependencies (Already Exist)

**Hooks** (assumed from P1 implementation):

```typescript
// src/hooks/useMode.ts (P1 - assumed to exist)
export function useMode(): {
  mode: 'muse' | 'loki' | 'off';
  setMode: (mode: 'muse' | 'loki' | 'off') => void;
};
```

**API Clients** (P1 - assumed to exist):

```typescript
// src/services/ai-actions.ts (P1 - assumed to exist)
export async function triggerProvoke(): Promise<void>;
export async function triggerDelete(): Promise<void>;
```

**Components** (P1 - to be enhanced):

```typescript
// src/components/Editor/MilkdownEditor.tsx (P1 - assumed to exist)
// This component will be enhanced to render <SensoryFeedback> overlay
// and <ManualTriggerButton> in toolbar/footer
```

### Integration Strategy

**Option 1: Add to Editor Component** (Recommended)

```tsx
// client/src/components/Editor/MilkdownEditor.tsx
import { SensoryFeedback } from '../SensoryFeedback';
import { ManualTriggerButton } from '../ManualTriggerButton';
import { useAIActionListener } from '../../hooks/useAIActionListener';  // NEW: Listen for AI actions

export function MilkdownEditor() {
  const { currentAction } = useAIActionListener();  // Listens for Provoke/Delete/Reject events
  
  return (
    <div className="editor-container">
      {/* Sensory feedback overlay */}
      <SensoryFeedback actionType={currentAction} />
      
      {/* Existing Milkdown editor */}
      <MilkdownEditorCore />
      
      {/* Manual trigger button (fixed position or toolbar) */}
      <div className="editor-footer">
        <ManualTriggerButton />
      </div>
    </div>
  );
}
```

**Option 2: Global Context Provider** (If multiple components need feedback)

```tsx
// client/src/App.tsx
import { SensoryFeedbackProvider } from './contexts/SensoryFeedbackContext';

export function App() {
  return (
    <SensoryFeedbackProvider>
      <Router>
        <Routes>
          {/* Existing routes */}
        </Routes>
      </Router>
    </SensoryFeedbackProvider>
  );
}
```

---

## Common Issues & Troubleshooting

### Issue: AudioContext blocked by browser autoplay policy

**Symptom**: Audio doesn't play on first load, console error "AudioContext suspended"

**Solution**:

```typescript
// Resume AudioContext on user interaction
const audioContext = new AudioContext();

button.addEventListener('click', async () => {
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  // Then play audio
});
```

### Issue: Animation stutters or doesn't complete

**Symptom**: Glitch animation freezes or Fade-out stops mid-animation

**Solution**: Check Framer Motion key prop changes correctly (cancel-and-replace)

```typescript
// WRONG: Same key doesn't trigger remount
<motion.div key="feedback" {...} />

// CORRECT: Unique key per action
<motion.div key={`${actionType}-${Date.now()}`} {...} />
```

### Issue: Tests fail with "AudioContext is not defined"

**Symptom**: Vitest tests fail when calling useAudioFeedback hook

**Solution**: Mock AudioContext in test setup

```typescript
// vitest.setup.ts
global.AudioContext = vi.fn(() => ({
  createBufferSource: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn()
  })),
  decodeAudioData: vi.fn(() => Promise.resolve({})),
  destination: {},
  state: 'running',
  resume: vi.fn(() => Promise.resolve())
}));
```

### Issue: Debouncing doesn't work (multiple API calls within 2 seconds)

**Symptom**: Manual trigger button calls API multiple times on rapid clicks

**Solution**: Check debounce implementation uses closure correctly

```typescript
// WRONG: Creates new timeout every call (doesn't debounce)
function trigger() {
  setTimeout(() => callAPI(), 2000);
}

// CORRECT: Clears previous timeout (proper debounce)
let timeoutId: NodeJS.Timeout | null = null;
function trigger() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => callAPI(), 2000);
}
```

---

## Definition of Done

### Code Complete ✅

- [ ] All test files created and passing (Red-Green-Refactor cycle)
- [ ] JSDoc comments on all exported functions/components (Article V)
- [ ] TypeScript strict mode passes (no `any` types)
- [ ] ESLint passes (max-warnings=0)
- [ ] Prettier passes (code formatting)

### Testing Complete ✅

- [ ] Unit tests: ≥70% coverage for hooks/components
- [ ] E2E tests: Manual trigger flow passes
- [ ] E2E tests: Sensory feedback flow passes
- [ ] Manual testing: Chrome/Edge/Opera verified
- [ ] Accessibility testing: prefers-reduced-motion verified

### Integration Complete ✅

- [ ] Audio assets downloaded and optimized (<100KB each)
- [ ] Audio assets added to client/src/assets/audio/
- [ ] Attribution added to client/CREDITS.md (if CC BY license)
- [ ] SensoryFeedback component integrated into Editor
- [ ] ManualTriggerButton component integrated into Editor

### Documentation Complete ✅

- [ ] Code comments explain complex logic (Web Audio API, Framer Motion)
- [ ] README updated (if public-facing changes)
- [ ] CREDITS.md updated (audio attribution)

### CI Validation ✅

```bash
# Run full CI locally with Act CLI
cd ../..  # Return to repo root
act  # Runs all 4 jobs: lint, type-check, backend-tests, frontend-tests
```

**All jobs must pass** before marking feature complete.

---

## Next Steps After Implementation

1. **Create PR** (use `/speckit.tasks` to generate task breakdown first)
2. **Request code review** (verify constitutional compliance)
3. **Merge to main** (after CI passes and review approved)
4. **Deploy to staging** (manual testing in production-like environment)
5. **Collect user feedback** (measure SC-005: 70%+ positive feedback)

---

**Quickstart Status**: ✅ Complete  
**Ready for Implementation**: YES  
**Next Command**: `/speckit.tasks` (to generate detailed task breakdown)
