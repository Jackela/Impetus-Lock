# Phase 0: Research & Best Practices

**Feature**: Vibe Enhancements (002-vibe-enhancements)  
**Date**: 2025-11-06  
**Status**: Research Complete

## Research Tasks

### 1. Royalty-Free Audio Asset Sourcing

**Decision**: Use Freesound.org and Zapsplat for audio effects

**Rationale**:
- **Freesound.org**: Community-driven, high-quality sounds with CC licenses
  - Search terms: "metal clank lock", "whoosh wind", "bonk impact"
  - License: CC0 (public domain) or CC BY (attribution required)
  - Format: Download as MP3 or WAV, convert to web-optimized MP3 (192kbps)
  
- **Zapsplat**: Professional sound effects library
  - Free tier: Personal/commercial use allowed with attribution
  - Higher quality production sounds
  - Pre-optimized for web (MP3 format available)

**Best Practices**:
1. **File size optimization**: Target <100KB per audio file
   - Use MP3 format at 192kbps (good quality-to-size ratio)
   - Trim silence from start/end to reduce file size
   
2. **Web Audio API integration**:
   - Preload audio files during app initialization (avoid loading delays)
   - Use `AudioContext` with `AudioBuffer` for lowest latency playback
   - Cache decoded audio buffers in memory for instant replay
   
3. **Attribution compliance**:
   - CC0: No attribution required (preferred)
   - CC BY: Add attribution to credits page or footer
   
4. **Search strategy**:
   - "Clank": Search "lock metal", "chain impact", "metal door latch"
   - "Whoosh": Search "wind swoosh", "air whoosh", "fast swipe"
   - "Bonk": Search "cartoon bonk", "wood knock", "soft impact" (already sourced for P1)

**Alternatives Considered**:
- ❌ **Browser-generated tones (Web Audio API synthesis)**: Lacks organic/satisfying feel
- ❌ **Commercial libraries (AudioJungle, Pond5)**: Unnecessary cost for 5-day MVP
- ❌ **Custom recording**: Too time-consuming (requires equipment, editing, multiple takes)

---

### 2. Web Audio API Best Practices (Chrome/Chromium)

**Decision**: Use AudioContext + AudioBuffer for playback

**Rationale**:
- **Lowest latency**: <10ms playback start (vs. 100-300ms for HTMLAudioElement)
- **Precise control**: Stop/cancel previous sounds before playing new ones (cancel-and-replace)
- **Cross-origin safety**: Chromium allows preloaded local audio without CORS issues

**Implementation Pattern**:

```typescript
// Initialize AudioContext once (user interaction required in Chromium)
const audioContext = new AudioContext();

// Preload and decode audio buffers
const audioBuffers = {
  clank: await loadAudioBuffer('/assets/audio/clank.mp3'),
  whoosh: await loadAudioBuffer('/assets/audio/whoosh.mp3'),
  bonk: await loadAudioBuffer('/assets/audio/bonk.mp3'),
};

async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Play audio with cancel-and-replace
let currentSource: AudioBufferSourceNode | null = null;

function playSound(buffer: AudioBuffer) {
  // Cancel previous sound (FR-019)
  if (currentSource) {
    currentSource.stop();
    currentSource.disconnect();
  }
  
  // Create new source and play
  currentSource = audioContext.createBufferSource();
  currentSource.buffer = buffer;
  currentSource.connect(audioContext.destination);
  currentSource.start(0);
  
  // Clean up reference when done
  currentSource.onended = () => { currentSource = null; };
}
```

**Best Practices**:
1. **User gesture requirement**: AudioContext must be created/resumed after user interaction (Chromium policy)
   - Solution: Initialize on first button click or page interaction
   
2. **Error handling** (FR-015):
   - Wrap playSound in try-catch (autoplay restrictions, decoding errors)
   - Gracefully degrade to no sound if AudioContext unavailable
   
3. **Memory management**:
   - Reuse AudioContext (don't create multiple instances)
   - Disconnect and nullify AudioBufferSourceNode after playback
   
4. **Sync with animations** (SC-008: <100ms lag):
   - Start audio and animation in same microtask (Promise.all or sequential calls)
   - Use AudioContext.currentTime for precise scheduling if needed

**Alternatives Considered**:
- ❌ **HTMLAudioElement (`<audio>` tag)**: 100-300ms latency, harder to cancel mid-playback
- ❌ **Howler.js (third-party library)**: Adds 30KB dependency for features we don't need
- ❌ **Tone.js**: 100KB+ library, overkill for simple sound effects

---

### 3. Framer Motion Animation Patterns (Cancel-and-Replace)

**Decision**: Use Framer Motion `AnimatePresence` + `key` prop for cancel-and-replace

**Rationale**:
- **Already in project**: Framer Motion is listed in package.json dependencies
- **Cancel-and-replace**: Changing `key` prop forces instant remount (old animation cancelled)
- **Accessibility**: Respects `prefers-reduced-motion` via `useReducedMotion()` hook

**Implementation Pattern**:

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

function SensoryFeedback({ actionType }: { actionType: 'provoke' | 'delete' | null }) {
  const shouldReduceMotion = useReducedMotion();
  
  // Cancel-and-replace: key changes trigger unmount/remount (FR-018)
  const animationKey = actionType ? `${actionType}-${Date.now()}` : 'idle';
  
  return (
    <AnimatePresence mode="wait">
      {actionType && (
        <motion.div
          key={animationKey}
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={shouldReduceMotion ? variantsReduced : variants[actionType]}
        />
      )}
    </AnimatePresence>
  );
}

// Animation variants
const variants = {
  provoke: {
    hidden: { opacity: 0 },
    visible: {
      opacity: [1, 0.5, 1, 0.3, 1, 0],  // Glitch effect (FR-007)
      transition: { duration: 1.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }
    }
  },
  delete: {
    hidden: { opacity: 1 },
    visible: {
      opacity: 0,  // Fade-out (FR-011)
      transition: { duration: 0.75, ease: 'easeOut' }
    }
  }
};

// Reduced-motion variants (FR-014)
const variantsReduced = {
  hidden: { opacity: 0.7 },
  visible: { opacity: 1, transition: { duration: 0.2 } }  // Instant color shift
};
```

**Best Practices**:
1. **Cancel-and-replace** (FR-018):
   - Use unique `key` prop (e.g., `${type}-${timestamp}`)
   - `AnimatePresence mode="wait"` ensures old animation exits before new starts
   
2. **Accessibility** (FR-014):
   - `useReducedMotion()` hook detects prefers-reduced-motion
   - Fallback to opacity change (no motion) instead of glitch/fade effects
   
3. **Performance** (SC-007: 95%+ timing consistency):
   - Use GPU-accelerated properties only (opacity, transform)
   - Avoid layout-triggering properties (width, height, margin)
   
4. **Timing precision**:
   - Glitch: 1.5s duration with 6 keyframes (FR-007: 1-2s range)
   - Fade-out: 0.75s duration with easeOut (FR-011: 0.5-1s range)

**Alternatives Considered**:
- ❌ **CSS animations**: Harder to cancel mid-animation programmatically
- ❌ **React Spring**: Different API, not already in project
- ❌ **GSAP**: 100KB+ library, unnecessary for simple effects

---

### 4. React Component Architecture (Manual Trigger Button)

**Decision**: Single-responsibility component with hook-based state management

**Rationale**:
- **SRP compliance** (Article IV): Button only handles UI rendering
- **Testability**: Hooks (useAudioFeedback, useAnimationController) can be tested independently
- **Reusability**: Hooks can be reused in other components if needed

**Component Structure**:

```tsx
// ManualTriggerButton.tsx (UI only)
import { useMode } from '../hooks/useMode';  // Assumed P1 hook
import { useManualTrigger } from '../hooks/useManualTrigger';

/**
 * Manual trigger button for instant AI intervention in Muse mode.
 * Disabled in Loki/Off modes per FR-002.
 * 
 * @returns React component
 */
export function ManualTriggerButton() {
  const { mode } = useMode();
  const { trigger, isLoading } = useManualTrigger();
  
  const isEnabled = mode === 'muse' && !isLoading;  // FR-002, FR-005
  
  return (
    <button
      onClick={trigger}
      disabled={!isEnabled}
      aria-label="I'm stuck! Trigger AI assistance"
    >
      {isLoading ? 'Thinking...' : "I'm stuck!"}
    </button>
  );
}

// useManualTrigger.ts (business logic)
import { useState } from 'react';
import { useDebounce } from './useDebounce';  // Generic debounce hook
import { triggerProvoke } from '../services/ai-actions';  // P1 API client

/**
 * Hook for manual AI intervention trigger with debouncing.
 * 
 * @returns trigger function and loading state
 */
export function useManualTrigger() {
  const [isLoading, setIsLoading] = useState(false);
  
  const trigger = useDebounce(async () => {
    setIsLoading(true);  // FR-005
    try {
      await triggerProvoke();  // FR-003
    } finally {
      setIsLoading(false);
    }
  }, 2000);  // FR-004: 2-second cooldown
  
  return { trigger, isLoading };
}
```

**Best Practices**:
1. **Separation of concerns**:
   - Component: UI rendering + accessibility
   - Hook: Business logic (API calls, debouncing, state)
   
2. **Accessibility**:
   - `aria-label` for screen readers
   - `disabled` attribute with visual styling (grayed out per FR-002)
   
3. **Testing strategy** (TDD per Article III):
   - **Unit tests**: Test useManualTrigger hook in isolation (mock API)
   - **Component tests**: Test button rendering + disabled states
   - **E2E tests**: Test full user journey (click → API call → feedback)

**Alternatives Considered**:
- ❌ **Inline API calls in component**: Violates SRP, harder to test
- ❌ **Redux/Zustand global state**: Overkill for simple button state
- ❌ **Class component**: Functional components + hooks are project standard

---

### 5. Browser Compatibility Testing Strategy (Chrome/Chromium Only)

**Decision**: Manual testing on Chrome, Edge, Opera + automated Playwright on Chrome

**Rationale**:
- **Scope reduction** (FR-020): Chrome/Chromium-only reduces testing matrix
- **Web Audio API**: Fully supported in Chromium without polyfills
- **Framer Motion**: Optimized for Chrome's rendering engine

**Testing Matrix**:

| Browser | Version | Test Type | Coverage |
|---------|---------|-----------|----------|
| Chrome | Latest (stable) | Automated (Playwright) + Manual | 100% |
| Edge | Latest (stable) | Manual only | Spot checks |
| Opera | Latest (stable) | Manual only | Spot checks |
| Firefox | N/A | ❌ Not supported | 0% |
| Safari | N/A | ❌ Not supported | 0% |

**Manual Test Checklist**:
1. **Audio playback**:
   - Clank plays on Provoke action
   - Whoosh plays on Delete action
   - No audio errors in console
   
2. **Animations**:
   - Glitch effect visible (1-2s duration)
   - Fade-out effect visible (0.5-1s duration)
   - prefers-reduced-motion fallback works
   
3. **Button behavior**:
   - Enabled in Muse mode
   - Disabled in Loki/Off modes
   - Debouncing works (2s cooldown)

**Automated E2E Tests** (Playwright on Chrome):

```typescript
// e2e/sensory-feedback.spec.ts
test('plays Clank sound and shows Glitch animation on Provoke', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="mode-selector-muse"]');
  
  // Listen for audio context creation
  const audioPromise = page.waitForEvent('console', msg => 
    msg.text().includes('AudioContext created')
  );
  
  // Trigger Provoke action
  await page.click('[data-testid="manual-trigger-button"]');
  
  // Verify animation visible
  await expect(page.locator('[data-testid="glitch-animation"]')).toBeVisible();
  
  // Verify audio played (check console log or DOM event)
  await audioPromise;
});
```

**Best Practices**:
1. **Playwright configuration**:
   - Use `chromium` channel only (no webkit, firefox)
   - Set `baseURL` to local dev server
   
2. **Audio testing**:
   - Mock AudioContext in unit tests (jsdom doesn't support Web Audio)
   - Use E2E tests for actual audio playback validation
   
3. **Animation testing**:
   - Test presence of animation elements (data-testid attributes)
   - Use Playwright's `waitForSelector` with timeout for animation completion

**Alternatives Considered**:
- ❌ **Cross-browser testing (BrowserStack)**: Unnecessary for Chrome-only scope
- ❌ **Visual regression testing (Percy, Chromatic)**: Overkill for 5-day MVP
- ❌ **Audio waveform analysis**: Too complex for simple playback validation

---

## Summary of Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Audio Assets** | Freesound.org + Zapsplat (CC0/CC BY) | Free, high-quality, legal for commercial use |
| **Audio Playback** | Web Audio API (AudioContext + AudioBuffer) | <10ms latency, precise cancel-and-replace control |
| **Animations** | Framer Motion (AnimatePresence + key prop) | Already in project, cancel-and-replace via key changes |
| **Component Architecture** | Single-responsibility component + hooks | SRP compliance, testable, reusable |
| **Browser Testing** | Chrome/Chromium manual + Playwright automated | Aligns with FR-020, reduces testing overhead |

---

## Implementation Dependencies

**External Assets to Source**:
1. `clank.mp3` - Metal locking sound (0.5-1s, <100KB)
   - Search: Freesound.org "metal lock clank"
   - License: CC0 preferred
   
2. `whoosh.mp3` - Wind/swoosh sound (0.5-1s, <100KB)
   - Search: Zapsplat "air whoosh"
   - License: CC0 or CC BY with attribution

**No New NPM Dependencies Required**:
- ✅ Framer Motion: Already in package.json
- ✅ React Testing Library: Already in package.json
- ✅ Playwright: Already in package.json
- ✅ Web Audio API: Browser native (Chromium)

---

**Research Status**: ✅ Complete  
**Next Phase**: Phase 1 (Data Model, Contracts, Quickstart)
