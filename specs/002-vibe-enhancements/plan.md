# Implementation Plan: Vibe Enhancements

**Branch**: `002-vibe-enhancements` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-vibe-enhancements/spec.md`

## Summary

Enhance Impetus Lock's user experience with two P2 features: (1) Manual trigger button for instant AI intervention in Muse mode (reduces wait from 60s to <2s), and (2) Sensory feedback (animations + audio) for AI actions (Glitch/Clank for Provoke, Fade-out/Whoosh for Delete). This builds on P1 core functionality (already implemented) using React + Framer Motion (animations), Web Audio API (sound effects), and royalty-free audio assets from Freesound.org/Zapsplat.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1, Python 3.11  
**Primary Dependencies**: 
- Frontend: React, Framer Motion (animations), Milkdown (editor), Vite
- Backend: FastAPI, Pydantic v2 (P1 API endpoints already exist)

**Storage**: N/A (frontend-only feature, leverages existing backend APIs)  
**Testing**: 
- Frontend: Vitest (unit), @testing-library/react, Playwright (E2E)
- Audio/Animation: jsdom + manual Chrome/Edge testing

**Target Platform**: Chrome/Chromium-based browsers only (Chrome, Edge, Opera)  
**Project Type**: Web application (monorepo: client/ + server/)  
**Performance Goals**: 
- Manual trigger response: <2s (button click → AI Provoke action received)
- Audio-visual sync: <100ms lag between animation start and audio playback
- Animation timing: Glitch (1-2s), Fade-out (0.5-1s) with 95%+ consistency

**Constraints**: 
- Browser compatibility: Chrome/Chromium only (no Firefox/Safari support for MVP)
- Audio assets: Royalty-free libraries only (Freesound.org, Zapsplat)
- Animation interruption: Cancel-and-replace (no queuing or blending)
- Accessibility: prefers-reduced-motion support required

**Scale/Scope**: 
- 2 user stories (US4: Manual Trigger, US5: Sensory Feedback)
- 3 audio files (Clank, Whoosh, Bonk - last one from P1)
- 2 new animations (Glitch, Fade-out; Shake from P1)
- 1 new React component (ManualTriggerButton)
- 0 new backend endpoints (reuses existing P1 Provoke/Delete APIs)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Simplicity & Anti-Abstraction ✅
- [x] Framework-native features prioritized over custom implementations
  - ✅ Using Framer Motion (already in project) for animations instead of custom animation engine
  - ✅ Using Web Audio API (browser native) instead of third-party audio libraries
  - ✅ Using CSS prefers-reduced-motion media query (native) for accessibility
- [x] Simplest viable implementation path chosen
  - ✅ Cancel-and-replace animation strategy (simplest; no queuing/blending complexity)
  - ✅ Chrome/Chromium-only (avoids cross-browser polyfills)
  - ✅ Royalty-free audio assets (avoids custom recording overhead)
- [x] No unnecessary wrapper classes or abstraction layers
  - ✅ Direct Web Audio API usage (no AudioManager abstraction)
  - ✅ Direct Framer Motion API usage (no AnimationService wrapper)
- [x] Any abstractions justified by actual (not anticipated) multi-implementation scenarios
  - N/A (no abstractions planned)

### Article II: Vibe-First Imperative ✅
- [x] Un-deletable constraint is P1 priority (only this feature is P1)
  - ✅ This feature is P2 (correctly prioritized as UX enhancement, not core lock)
- [x] All other features (UI polish, auxiliary functions) marked P2 or lower
  - ✅ Manual Trigger: P2
  - ✅ Sensory Feedback: P2
- [x] P1 tasks scheduled for wave 1 implementation
  - N/A (no P1 tasks in this feature; P1 already implemented in 001-impetus-core)
- [x] P1 tasks represent ≥60% of story points
  - N/A (this is a P2-only feature)

### Article III: Test-First Imperative (NON-NEGOTIABLE) ✅
- [x] Test tasks created for ALL P1 user stories BEFORE implementation tasks
  - N/A (no P1 user stories; but test tasks WILL be created for P2 stories per TDD)
- [x] TDD workflow enforced: failing test → verify failure → minimal implementation → refactor
  - ✅ Phase 2 (tasks.md) will enforce TDD order: test tasks before implementation tasks
- [x] Test coverage ≥80% for critical paths (un-deletable logic, lock enforcement)
  - N/A (no P1 critical paths; but sensory feedback logic will have ≥70% coverage)
- [x] P1 features have corresponding test files
  - N/A (no P1 features in this spec)

### Article IV: SOLID Principles ✅
- [x] **SRP**: FastAPI endpoints delegate business logic to service layer classes
  - ✅ No new backend endpoints (reuses P1 APIs)
- [x] **DIP**: High-level logic depends on abstractions (protocols/interfaces), not concrete implementations
  - ✅ Frontend services will use dependency injection for audio/animation managers
- [x] No endpoint handlers contain raw SQL or business rules
  - N/A (no new endpoints)
- [x] Service classes use constructor injection (no direct instantiation of infrastructure dependencies)
  - ✅ React components will receive audio/animation dependencies via props/context

### Article V: Clear Comments & Documentation ✅
- [x] **Frontend**: JSDoc comments for all exported functions/components
  - ✅ ManualTriggerButton component will have JSDoc
  - ✅ useAudioFeedback hook will have JSDoc
  - ✅ useAnimationController hook will have JSDoc
- [x] **Backend**: Python docstrings (Google/NumPy style) for all public functions/classes
  - N/A (no backend changes)
- [x] Documentation present for all public interfaces
  - ✅ All exported React components/hooks documented
- [x] Missing documentation flagged as blocking if on critical path
  - ✅ ESLint jsdoc plugin enforces documentation

## Project Structure

### Documentation (this feature)

```text
specs/002-vibe-enhancements/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (to be created)
│   └── frontend-components.md  # Component contracts
└── tasks.md             # Phase 2 output (/speckit.tasks - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application (monorepo structure - already exists)
client/                  # Frontend (React + Vite + TypeScript)
├── src/
│   ├── components/
│   │   ├── ManualTriggerButton.tsx        # NEW: P2 - Manual trigger UI
│   │   ├── ManualTriggerButton.test.tsx   # NEW: TDD tests
│   │   └── Editor/                        # EXISTING: Milkdown editor (to be enhanced)
│   ├── hooks/
│   │   ├── useAudioFeedback.ts            # NEW: P2 - Web Audio API wrapper
│   │   ├── useAudioFeedback.test.ts       # NEW: TDD tests
│   │   ├── useAnimationController.ts      # NEW: P2 - Animation lifecycle manager
│   │   └── useAnimationController.test.ts # NEW: TDD tests
│   ├── services/
│   │   └── ai-actions.ts                  # EXISTING: P1 API client (Provoke/Delete)
│   ├── assets/
│   │   └── audio/                         # NEW: Sound effects directory
│   │       ├── clank.mp3                  # NEW: Provoke sound
│   │       ├── whoosh.mp3                 # NEW: Delete sound
│   │       └── bonk.mp3                   # EXISTING: P1 rejection sound
│   └── styles/
│       └── animations.css                 # NEW: Framer Motion variants + reduced-motion
├── e2e/
│   ├── manual-trigger.spec.ts             # NEW: E2E test for button interaction
│   └── sensory-feedback.spec.ts           # NEW: E2E test for animations/audio
└── package.json                           # No new dependencies (Framer Motion already added)

server/                  # Backend (FastAPI + Python) - NO CHANGES
└── (no changes - reuses existing P1 endpoints)
```

**Structure Decision**: This is a frontend-only P2 feature that enhances the existing P1 Impetus Lock core. The monorepo structure (client/ + server/) is already established. All new code goes into `client/src/` with the following organization:

- **Components**: UI elements (ManualTriggerButton)
- **Hooks**: React hooks for audio (useAudioFeedback) and animation (useAnimationController) lifecycle
- **Assets**: Audio files (royalty-free MP3s from Freesound.org/Zapsplat)
- **Services**: No new services (reuses existing ai-actions.ts for API calls)
- **E2E Tests**: Playwright tests for user journeys (manual trigger + sensory feedback)

## Complexity Tracking

> **No violations detected** — Constitution Check passed completely.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
