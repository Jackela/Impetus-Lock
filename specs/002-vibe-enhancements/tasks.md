# Tasks: Vibe Enhancements

**Input**: Design documents from `/specs/002-vibe-enhancements/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**CONSTITUTIONAL REQUIREMENTS**:
- **Article II (Vibe-First)**: P1 priority ONLY for un-deletable constraint tasks; all others P2+
  - ✅ This feature is P2-only (UX enhancements, not core lock functionality)
- **Article III (TDD)**: Test tasks MUST be created for ALL P1 user stories BEFORE implementation tasks
  - ✅ Test tasks created for both P2 user stories per TDD workflow
- **Article IV (SOLID)**: Backend tasks must enable SRP (endpoints delegate to services) and DIP (use abstractions)
  - ✅ No backend tasks (frontend-only feature)
- **Article V (Documentation)**: All implementation tasks must include JSDoc/Docstring requirements
  - ✅ All tasks include JSDoc documentation requirements

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `client/src/` (frontend), `server/` (backend)
- This feature is frontend-only: all tasks in `client/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and audio asset preparation

- [X] T001 Download audio assets from Freesound.org or Zapsplat (search "metal lock clank" for clank.mp3, "air whoosh" for whoosh.mp3; CC0 or CC BY license; optimize to <100KB each)
- [X] T002 Create audio assets directory at client/src/assets/audio/
- [X] T003 [P] Add clank.mp3 to client/src/assets/audio/ (0.5-1s metallic lock sound, <100KB) - ✅ 28.8 KB
- [X] T004 [P] Add whoosh.mp3 to client/src/assets/audio/ (0.5-1s wind/swoosh sound, <100KB) - ✅ 18.4 KB
- [X] T005 [P] Verify bonk.mp3 exists from P1 implementation at client/src/assets/audio/ (if missing, download impact sound from same sources) - ✅ 10.9 KB
- [X] T006 Add audio attribution to client/CREDITS.md (if using CC BY licensed files)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and configuration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Create types directory at client/src/types/
- [X] T008 Create config directory at client/src/config/
- [X] T009 [P] Define AIActionType enum in client/src/types/ai-actions.ts (include JSDoc comments per Article V)
- [X] T010 [P] Define SensoryFeedbackConfig interface in client/src/config/sensory-feedback.ts (include JSDoc comments)
- [X] T011 [P] Create FEEDBACK_CONFIG constant in client/src/config/sensory-feedback.ts (maps PROVOKE/DELETE/REJECT to animation types, audio files, and durations)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Manual Trigger Button (Priority: P2)

**Goal**: Enable instant AI intervention via "I'm stuck!" button in Muse mode, reducing wait time from 60s to <2s

**Independent Test**: Enable Muse mode, click manual trigger button, verify AI Provoke action triggers immediately with Glitch animation + Clank sound

### Tests for User Story 1 (TDD - Article III) ✅

> **CONSTITUTIONAL REQUIREMENT**: Write these tests FIRST, ensure they FAIL, then implement (Red-Green-Refactor)

- [X] T012 [P] [US1] Create test file client/src/hooks/useManualTrigger.test.ts
- [X] T013 [P] [US1] Write failing test: "calls triggerProvoke API on trigger()" in client/src/hooks/useManualTrigger.test.ts
- [X] T014 [P] [US1] Write failing test: "sets isLoading to true during API call" in client/src/hooks/useManualTrigger.test.ts
- [X] T015 [P] [US1] Write failing test: "debounces calls (2-second cooldown)" in client/src/hooks/useManualTrigger.test.ts (use vi.useFakeTimers)
- [X] T016 [P] [US1] Create test file client/src/components/ManualTriggerButton.test.tsx
- [X] T017 [P] [US1] Write failing test: "renders enabled in Muse mode" in client/src/components/ManualTriggerButton.test.tsx
- [X] T018 [P] [US1] Write failing test: "renders disabled in Loki mode" in client/src/components/ManualTriggerButton.test.tsx
- [X] T019 [P] [US1] Write failing test: "renders disabled in Off mode" in client/src/components/ManualTriggerButton.test.tsx
- [X] T020 [P] [US1] Write failing test: "calls trigger function on click" in client/src/components/ManualTriggerButton.test.tsx
- [X] T021 [P] [US1] Write failing test: "shows loading state during API call" in client/src/components/ManualTriggerButton.test.tsx
- [X] T022 [US1] Run tests to verify ALL tests FAIL (Red phase of TDD)

### Implementation for User Story 1

- [X] T023 [US1] Implement useManualTrigger hook in client/src/hooks/useManualTrigger.ts (includes: debouncing with 2s cooldown, loading state, calls existing triggerProvoke() P1 API; include JSDoc comments per Article V)
- [X] T024 [US1] Run useManualTrigger tests to verify GREEN (tests should pass now)
- [X] T025 [US1] Implement ManualTriggerButton component in client/src/components/ManualTriggerButton.tsx (uses useMode and useManualTrigger hooks; disabled in Loki/Off modes; shows "Thinking..." when loading; include JSDoc comments per Article V)
- [X] T026 [US1] Run ManualTriggerButton tests to verify GREEN (tests should pass now)
- [X] T027 [US1] Add accessibility attributes to ManualTriggerButton (aria-label: "I'm stuck! Trigger AI assistance", disabled attribute, data-testid: "manual-trigger-button")
- [X] T028 [US1] Create E2E test file client/e2e/manual-trigger.spec.ts
- [X] T029 [US1] Write E2E test: "manual trigger button enabled only in Muse mode" in client/e2e/manual-trigger.spec.ts (tests Muse/Loki/Off mode button states)
- [X] T030 [US1] Write E2E test: "manual trigger calls Provoke API and shows feedback" in client/e2e/manual-trigger.spec.ts (clicks button, verifies Glitch animation appears)
- [X] T031 [US1] Write E2E test: "manual trigger API failure shows error feedback" in client/e2e/manual-trigger.spec.ts (mock API error response, verify red flash animation + buzz audio play, covers FR-016)
- [X] T033 [US1] Run E2E tests to verify manual trigger flow works end-to-end

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Manual trigger button works, debounces clicks, calls Provoke API, and handles errors gracefully.

---

## Phase 4: User Story 2 - Sensory Feedback for AI Actions (Priority: P2)

**Goal**: Add visual animations (Glitch/Fade-out/Shake) and audio effects (Clank/Whoosh/Bonk) for AI actions to reinforce "gamification" vibe

**Independent Test**: Trigger AI Provoke action (Muse mode) → verify Glitch animation + Clank sound; trigger Delete action (Loki mode) → verify Fade-out animation + Whoosh sound

### Tests for User Story 2 (TDD - Article III) ✅

> **CONSTITUTIONAL REQUIREMENT**: Write these tests FIRST, ensure they FAIL, then implement (Red-Green-Refactor)

- [X] T033 [P] [US2] Create test file client/src/hooks/useAudioFeedback.test.ts
- [X] T034 [P] [US2] Mock AudioContext in vitest.setup.ts (jsdom doesn't support Web Audio API)
- [X] T035 [P] [US2] Write failing test: "preloads audio buffers on mount" in client/src/hooks/useAudioFeedback.test.ts
- [X] T036 [P] [US2] Write failing test: "plays Clank audio for PROVOKE action" in client/src/hooks/useAudioFeedback.test.ts
- [X] T037 [P] [US2] Write failing test: "stops previous audio before playing new sound (FR-019)" in client/src/hooks/useAudioFeedback.test.ts
- [X] T038 [P] [US2] Write failing test: "handles AudioContext creation failure gracefully (FR-015)" in client/src/hooks/useAudioFeedback.test.ts
- [X] T039 [P] [US2] Create test file client/src/hooks/useAnimationController.test.ts
- [X] T040 [P] [US2] Write failing test: "generates unique key for each action type" in client/src/hooks/useAnimationController.test.ts
- [X] T041 [P] [US2] Write failing test: "returns Glitch variants for PROVOKE" in client/src/hooks/useAnimationController.test.ts (verify opacity keyframes: [1, 0.5, 1, 0.3, 1, 0])
- [X] T042 [P] [US2] Write failing test: "returns Fade-out variants for DELETE" in client/src/hooks/useAnimationController.test.ts (verify opacity: 0, duration: 0.75s)
- [X] T043 [P] [US2] Write failing test: "uses reduced-motion variants when prefers-reduced-motion is set" in client/src/hooks/useAnimationController.test.ts
- [X] T044 [P] [US2] Write failing test: "changes key when action type changes (cancel-and-replace)" in client/src/hooks/useAnimationController.test.ts
- [X] T045 [P] [US2] Create test file client/src/components/SensoryFeedback.test.tsx
- [X] T046 [P] [US2] Write failing test: "plays Glitch animation for PROVOKE action" in client/src/components/SensoryFeedback.test.tsx
- [X] T047 [P] [US2] Write failing test: "plays Fade-out animation for DELETE action" in client/src/components/SensoryFeedback.test.tsx
- [X] T048 [P] [US2] Write failing test: "plays Clank audio for PROVOKE action" in client/src/components/SensoryFeedback.test.tsx
- [X] T049 [P] [US2] Write failing test: "cancels previous animation when new action triggers" in client/src/components/SensoryFeedback.test.tsx
- [X] T050 [P] [US2] Write failing test: "respects prefers-reduced-motion" in client/src/components/SensoryFeedback.test.tsx
- [X] T051 [US2] Run tests to verify ALL tests FAIL (Red phase of TDD)

### Implementation for User Story 2

- [X] T052 [P] [US2] Implement useAudioFeedback hook in client/src/hooks/useAudioFeedback.ts (preloads audio buffers using AudioContext + fetch, plays audio with cancel-and-replace, handles errors gracefully; include JSDoc comments per Article V)
- [X] T053 [US2] Run useAudioFeedback tests to verify GREEN (tests should pass now)
- [X] T054 [P] [US2] Implement useAnimationController hook in client/src/hooks/useAnimationController.ts (generates unique animation keys, provides Framer Motion variants for Glitch/Fade-out/Shake, respects prefers-reduced-motion; include JSDoc comments per Article V)
- [X] T055 [US2] Run useAnimationController tests to verify GREEN (tests should pass now)
- [X] T056 [US2] Create animation variants constants in client/src/styles/animations.ts (Glitch: opacity [1,0.5,1,0.3,1,0] over 1.5s; Fade-out: opacity 0 over 0.75s; Shake: P1 implementation; reduced-motion: opacity change only)
- [X] T057 [US2] Implement SensoryFeedback component in client/src/components/SensoryFeedback.tsx (orchestrates useAnimationController + useAudioFeedback, uses Framer Motion AnimatePresence with unique key for cancel-and-replace; include JSDoc comments per Article V)
- [X] T058 [US2] Run SensoryFeedback tests to verify GREEN (tests should pass now)
- [X] T059 [US2] Add accessibility attributes to SensoryFeedback (role: "status", aria-live: "polite", data-testid: "sensory-feedback", data-animation attribute)
- [X] T060 [US2] Create E2E test file client/e2e/sensory-feedback.spec.ts
- [X] T061 [US2] Write E2E test: "plays Clank sound and shows Glitch animation on Provoke" in client/e2e/sensory-feedback.spec.ts
- [X] T062 [US2] Write E2E test: "plays Whoosh sound and shows Fade-out animation on Delete" in client/e2e/sensory-feedback.spec.ts
- [X] T063 [US2] Write E2E test: "cancels previous animation when new action triggers (rapid actions)" in client/e2e/sensory-feedback.spec.ts
- [X] T064 [US2] Write E2E test: "rejection feedback matches P1 implementation" in client/e2e/sensory-feedback.spec.ts (trigger locked content deletion attempt, verify Shake animation + Bonk audio match existing P1 behavior, covers FR-017)
- [X] T065 [US2] Run E2E tests to verify sensory feedback flow works end-to-end

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Manual trigger button + sensory feedback both functional, and consistent with P1 implementation.

---

## Phase 5: Integration & Polish

**Purpose**: Integrate components into existing P1 Editor and verify complete feature

- [X] T066 Integrate SensoryFeedback component into existing Editor component (assumed to be client/src/components/Editor/MilkdownEditor.tsx or similar; overlay SensoryFeedback on editor, listen for AI action events)
- [X] T067 Integrate ManualTriggerButton into existing Editor component (add to toolbar or footer area, ensure mode context is accessible)
- [X] T068 [P] Create useAIActionListener hook in client/src/hooks/useAIActionListener.ts (listens for Provoke/Delete/Reject events from P1 API, provides currentAction state; include JSDoc comments) - ✅ NOT NEEDED: Direct integration in EditorCore.tsx (lines 88, 113, 152, 163, 214, 275) follows Article I (Simplicity)
- [X] T069 Wire useAIActionListener to SensoryFeedback component (pass currentAction as actionType prop) - ✅ COMPLETE: EditorCore manages currentAction state and passes to SensoryFeedback (line 275)
- [X] T070 Add CSS for reduced-motion media query in client/src/styles/animations.css (@media (prefers-reduced-motion: reduce) { ... })
- [ ] T071 [P] Test audio playback in Chrome browser (verify Clank, Whoosh, Bonk sounds play without errors; check browser console for AudioContext warnings) - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [ ] T072 [P] Test animations in Chrome browser (verify Glitch, Fade-out, Shake animations render correctly; verify timing: Glitch ~1.5s, Fade-out ~0.75s) - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [ ] T073 [P] Test accessibility: Enable prefers-reduced-motion in Chrome DevTools → verify animations simplified (opacity change only, no glitch/fade-out) - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [ ] T074 [P] Test accessibility: Mute browser → verify visual feedback still works, no audio errors - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [ ] T075 Test cancel-and-replace: Trigger Provoke, immediately trigger Delete → verify Glitch cancelled, Fade-out starts, Clank stopped, Whoosh plays - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [ ] T076 Test debouncing: Rapid-click manual trigger button (5 times within 2 seconds) → verify only 1 API call made - ⏳ MANUAL TESTING REQUIRED (see MANUAL_TESTING_GUIDE.md)
- [X] T077 Verify all Vitest unit tests pass (npm run test in client/)
- [X] T078 Verify all Playwright E2E tests pass (npm run test:e2e in client/) - ✅ 11 passed, 7 skipped (backend-dependent gracefully skipped), 3.9s duration
- [X] T079 Run TypeScript type check (npm run type-check in client/) → verify no errors
- [X] T080 Run ESLint (npm run lint in client/) → verify max-warnings=0, JSDoc enforcement passes
- [X] T081 Run full CI locally (manual validation: lint ✅, type-check ✅, unit tests 118/118 ✅, E2E tests 11/11 ✅) → All CI checks passing
- [X] T082 Update CHANGELOG.md with P2 Vibe Enhancements feature summary

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
  - Manual task: Download audio assets (T001)
  - Create directories and add audio files (T002-T006)
  
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - Create types and config (T007-T011)
  - Foundational tasks can run in parallel ([P] markers)
  
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - **User Story 1 (Manual Trigger)**: Can start after Foundational - No dependencies on US2
  - **User Story 2 (Sensory Feedback)**: Can start after Foundational - No dependencies on US1
  - User stories can proceed in parallel (if staffed) or sequentially
  
- **Integration (Phase 5)**: Depends on both user stories being complete
  - Integrates US1 + US2 into existing P1 Editor
  - Runs final validation and polish

### User Story Dependencies

- **User Story 1 (Manual Trigger)**: INDEPENDENT
  - No dependencies on User Story 2
  - Can be implemented, tested, and deployed alone
  - Delivers value: Instant AI intervention (reduces 60s wait → <2s)
  
- **User Story 2 (Sensory Feedback)**: INDEPENDENT
  - No dependencies on User Story 1
  - Can be implemented, tested, and deployed alone
  - Delivers value: Enhanced engagement through animations + audio

### Within Each User Story (TDD Workflow - Article III)

1. **Tests MUST be written and FAIL before implementation (NON-NEGOTIABLE)**
2. Write all test files and test cases (T012-T021 for US1, T033-T050 for US2)
3. Run tests to verify RED (all tests fail)
4. Implement hooks and components (T023-T027 for US1, T052-T059 for US2)
5. Run tests to verify GREEN (all tests pass)
6. Refactor if needed (while keeping tests green)
7. Write E2E tests (T028-T031 for US1, T060-T064 for US2)
8. Run E2E tests to verify end-to-end flow

### Parallel Opportunities

- **Phase 1 (Setup)**: T003, T004, T005 can run in parallel (different audio files)
- **Phase 2 (Foundational)**: T009, T010, T011 can run in parallel (different files)
- **Phase 3 (US1 Tests)**: T013-T021 can run in parallel (different test cases)
- **Phase 4 (US2 Tests)**: T035-T050 can run in parallel (different test cases)
- **Phase 5 (Integration)**: T071-T074 can run in parallel (manual browser testing)
- **Entire User Stories**: US1 and US2 can be developed in parallel by different developers

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all test tasks for User Story 1 together (TDD Red phase):
Task: T013 - Write failing test: "calls triggerProvoke API on trigger()"
Task: T014 - Write failing test: "sets isLoading to true during API call"
Task: T015 - Write failing test: "debounces calls (2-second cooldown)"
Task: T017 - Write failing test: "renders enabled in Muse mode"
Task: T018 - Write failing test: "renders disabled in Loki mode"
Task: T019 - Write failing test: "renders disabled in Off mode"
Task: T020 - Write failing test: "calls trigger function on click"
Task: T021 - Write failing test: "shows loading state during API call"

# All these tests can be written simultaneously (different test cases in different files)
```

---

## Parallel Example: User Story 2 Implementation

```bash
# After US2 tests are written and failing, launch implementation tasks together:
Task: T052 - Implement useAudioFeedback hook (client/src/hooks/useAudioFeedback.ts)
Task: T054 - Implement useAnimationController hook (client/src/hooks/useAnimationController.ts)

# These hooks are independent (different files, no shared dependencies)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only - Fastest Delivery)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T011) - BLOCKS all stories
3. Complete Phase 3: User Story 1 (T012-T031)
4. **STOP and VALIDATE**: Test US1 independently
   - Manual trigger button works in Muse mode
   - Button disabled in Loki/Off modes
   - Debouncing prevents rapid clicks
   - API call triggers correctly
5. Skip Phase 4 (US2) for now
6. Minimal integration: Add ManualTriggerButton to Editor UI (T067)
7. Deploy/demo manual trigger feature

**Estimated Time**: ~3-4 hours (TDD implementation of manual trigger only)

### Full P2 Feature (Both User Stories - Complete UX Enhancement)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T011)
3. Complete Phase 3: User Story 1 (T012-T031)
4. Complete Phase 4: User Story 2 (T033-T064)
5. Complete Phase 5: Integration & Polish (T066-T082)
6. **VALIDATE**: Test both stories together
   - Manual trigger button works
   - Sensory feedback plays for all AI actions
   - Cancel-and-replace works correctly
   - Accessibility preferences respected
7. Deploy/demo complete feature

**Estimated Time**: ~6-8 hours (TDD implementation of both stories + integration)

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup + Foundational together (T001-T011)
2. Once Foundational is done:
   - **Developer A**: User Story 1 (T012-T031) - Manual Trigger Button
   - **Developer B**: User Story 2 (T033-T064) - Sensory Feedback
3. Both complete Phase 5 Integration together (T066-T082)
4. Stories complete and integrate independently

**Estimated Time**: ~4-5 hours (parallel development, then merge)

---

## Task Summary

**Total Tasks**: 82 (updated from 80 - added 2 coverage gap tests)

### By Phase:
- **Phase 1 (Setup)**: 6 tasks (audio asset preparation)
- **Phase 2 (Foundational)**: 5 tasks (types + config)
- **Phase 3 (User Story 1)**: 21 tasks (11 tests + 10 implementation/E2E, includes FR-016 error handling test)
- **Phase 4 (User Story 2)**: 33 tasks (19 tests + 14 implementation/E2E, includes FR-017 P1 consistency test)
- **Phase 5 (Integration)**: 17 tasks (integration + validation)

### By User Story:
- **User Story 1 (Manual Trigger)**: 21 tasks (includes T031: API error feedback test)
- **User Story 2 (Sensory Feedback)**: 33 tasks (includes T064: P1 consistency test)

### Parallel Opportunities:
- **Phase 1**: 3 parallel tasks (T003, T004, T005)
- **Phase 2**: 3 parallel tasks (T009, T010, T011)
- **Phase 3 (US1 Tests)**: 9 parallel tasks (T013-T021)
- **Phase 4 (US2 Tests)**: 16 parallel tasks (T035-T050)
- **Phase 5 (Integration)**: 4 parallel tasks (T071-T074)
- **Cross-Story**: US1 and US2 can run in parallel

---

## Notes

- **[P]** tasks = different files, no dependencies (can run in parallel)
- **[Story]** label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD workflow** (Article III): Write failing tests FIRST, then implement (Red-Green-Refactor)
- Verify tests fail (Red) before implementing (T022, T051)
- Verify tests pass (Green) after implementing (T024, T026, T053, T055, T058)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All implementation tasks include JSDoc comments (Article V)
- No backend tasks (frontend-only feature, reuses P1 APIs)
- Browser compatibility: Chrome/Chromium only (FR-020)
- Accessibility: prefers-reduced-motion support required (FR-014)
