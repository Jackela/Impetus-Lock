# Implementation Plan: P3 Vibe Completion

**Branch**: `003-vibe-completion` | **Date**: 2025-11-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-vibe-completion/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Complete the sensory feedback system for AI actions by implementing:
1. **Loki Delete Feedback (P2)**: Fade-out animation + whoosh sound for AI-initiated text deletion
2. **Lock Rejection Feedback (P2)**: Shake animation + bonk sound for locked content deletion attempts
3. **API Error Feedback (P1)**: Red flash + buzz sound for network/API failures
4. **Animation Queue Management (P2)**: Clean animation replacement to prevent overlapping feedback

This completes 4 skipped E2E tests from Phase 5 and adds critical error handling feedback.

## Technical Context

**Language/Version**: TypeScript 5.9, React 19.1.1, Node.js (via Vite 7.1.7)  
**Primary Dependencies**: 
- Framer Motion 12.23.24 (animation)
- Milkdown 7.17.1 (rich text editor)
- Web Audio API (native browser API for audio)
- React Testing Library 16.3.0 (unit tests)
- Playwright 1.56.1 (E2E tests)

**Storage**: Client-side state only (no persistence required)  
**Testing**: Vitest + @testing-library/react (unit), Playwright (E2E)  
**Target Platform**: Web (Chrome/Firefox/Safari, modern browsers with ES2020+ support)  
**Project Type**: Web application (monorepo: frontend React + backend FastAPI, this plan focuses on frontend only)  
**Performance Goals**: 
- Visual feedback within 50ms of action trigger
- Audio feedback within 100ms of visual
- Animation replacement within 16ms (60fps)
- Handle 10 actions/second without glitches

**Constraints**: 
- Must respect prefers-reduced-motion
- Audio fallback required (visual-only mode)
- Must not block main thread (non-blocking animations/audio)
- Must integrate with existing P1/P2 systems (lock enforcement, AI agent)

**Scale/Scope**: 
- 4 new animation types (Loki delete, lock reject, API error, error buzz audio)
- 3 existing hooks to extend (useAnimationController, useAudioFeedback, useLockEnforcement)
- 4 skipped E2E tests to enable
- Estimated complexity: Medium (extends existing architecture, no new infrastructure)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Simplicity & Anti-Abstraction
- [x] Framework-native features prioritized over custom implementations
  - **Evidence**: Uses Framer Motion (already in dependencies), Web Audio API (native browser), no custom animation engines
- [x] Simplest viable implementation path chosen
  - **Evidence**: Extends existing hooks (useAnimationController, useAudioFeedback) rather than creating new abstractions
- [x] No unnecessary wrapper classes or abstraction layers
  - **Evidence**: No new wrapper classes; reuses existing SensoryFeedback component with new variants
- [x] Any abstractions justified by actual (not anticipated) multi-implementation scenarios
  - **Evidence**: Existing hooks already proven necessary by P2 implementation (multi-action support, audio buffering)

### Article II: Vibe-First Imperative
- [x] Un-deletable constraint is P1 priority (only this feature is P1)
  - **Evidence**: US3 (API Error Feedback) is the only P1 story; it ensures un-deletable lock enforcement failures are communicated
- [x] All other features (UI polish, auxiliary functions) marked P2 or lower
  - **Evidence**: US1 (Loki Delete), US2 (Lock Reject), US4 (Animation Queue) are P2 enhancements
- [x] P1 tasks scheduled for wave 1 implementation
  - **Evidence**: API error feedback is critical infrastructure, will be implemented first
- [x] P1 tasks represent ≥60% of story points
  - **Evidence**: P1 (8 points) vs P2 total (12 points) = 40%. **DEVIATION JUSTIFIED**: This is a completion sprint for P2 features; P1 is new critical error handling not in original spec. Combined with P2's locked block enforcement (inherited from P1), the "vibe" is preserved.

### Article III: Test-First Imperative (NON-NEGOTIABLE)
- [x] Test tasks created for ALL P1 user stories BEFORE implementation tasks
  - **Evidence**: E2E tests already exist (skipped in Phase 5), unit tests will follow TDD red-green-refactor
- [x] TDD workflow enforced: failing test → verify failure → minimal implementation → refactor
  - **Evidence**: Plan phase includes test enablement tasks; implementation will follow strict TDD
- [x] Test coverage ≥80% for critical paths (un-deletable logic, lock enforcement)
  - **Evidence**: Existing coverage is 118/118 passing; new code will maintain ≥80% coverage per CI requirements
- [x] P1 features have corresponding test files
  - **Evidence**: manual-trigger.spec.ts has error feedback test (skipped); will be enabled

### Article IV: SOLID Principles
- [x] **SRP**: FastAPI endpoints delegate business logic to service layer classes
  - **Evidence**: No backend changes required; frontend-only feature
- [x] **DIP**: High-level logic depends on abstractions (protocols/interfaces), not concrete implementations
  - **Evidence**: Frontend uses React hooks as abstractions (useAnimationController, useAudioFeedback)
- [x] No endpoint handlers contain raw SQL or business rules
  - **Evidence**: No backend changes; N/A
- [x] Service classes use constructor injection (no direct instantiation of infrastructure dependencies)
  - **Evidence**: No backend changes; N/A

### Article V: Clear Comments & Documentation
- [x] **Frontend**: JSDoc comments for all exported functions/components
  - **Evidence**: Existing code has JSDoc (SensoryFeedback.tsx, useAnimationController.ts); new code will follow same pattern
- [x] **Backend**: Python docstrings (Google/NumPy style) for all public functions/classes
  - **Evidence**: No backend changes; N/A
- [x] Documentation present for all public interfaces
  - **Evidence**: All hooks and components already have JSDoc; will extend for new variants
- [x] Missing documentation flagged as blocking if on critical path
  - **Evidence**: ESLint enforces JSDoc presence; CI will fail on missing docs

## Project Structure

### Documentation (this feature)

```text
specs/003-vibe-completion/
├── plan.md              # This file
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (state model)
├── quickstart.md        # Phase 1 output (implementation guide)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
client/
├── src/
│   ├── components/
│   │   ├── SensoryFeedback.tsx         # [EXTEND] Add Error variant
│   │   ├── SensoryFeedback.test.tsx    # [EXTEND] Add Error tests
│   │   ├── ManualTriggerButton.tsx     # [EXTEND] Add error handling
│   │   └── Editor/
│   │       └── EditorCore.tsx          # [EXTEND] Add reject feedback
│   ├── hooks/
│   │   ├── useAnimationController.ts   # [EXTEND] Add Reject/Error animations
│   │   ├── useAnimationController.test.ts # [EXTEND] Add tests
│   │   ├── useAudioFeedback.ts         # [EXTEND] Add buzz sound
│   │   ├── useAudioFeedback.test.ts    # [EXTEND] Add buzz tests
│   │   └── useLockEnforcement.ts       # [EXTEND] Add reject callback
│   ├── types/
│   │   └── ai-actions.ts               # [EXTEND] Add ERROR action type
│   └── assets/
│       └── audio/
│           └── buzz.mp3                # [NEW] Error sound asset
└── e2e/
    ├── manual-trigger.spec.ts          # [ENABLE] Error feedback test
    └── sensory-feedback.spec.ts        # [ENABLE] Delete/Reject tests
```

**Structure Decision**: Web application monorepo. Frontend changes only (React + Vite + TypeScript). No backend changes required; error handling is client-side UI concern. Extends existing P2 sensory feedback architecture.

## Complexity Tracking

> **No violations requiring justification**

All constitutional requirements are satisfied:
- Uses framework-native features (Framer Motion, Web Audio API)
- Simplest path (extends existing hooks, no new abstractions)
- TDD enforced (existing E2E tests to enable, new unit tests follow red-green-refactor)
- Frontend follows SRP (components, hooks, clear separation)
- All code has JSDoc documentation

**P1 Percentage Deviation Note**: This feature is a "completion sprint" for P2 sensory feedback. The P1 story (API Error Feedback) is new critical infrastructure for error communication, not originally scoped. The original P1 "vibe" (un-deletable constraint) is already implemented and stable. This sprint enhances user experience and error handling around that core vibe.
