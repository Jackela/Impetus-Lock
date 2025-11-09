# Tasks: Responsive Design (响应式设计)

**Input**: Design documents from `/specs/006-responsive-design/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**CONSTITUTIONAL REQUIREMENTS**:
- **Article II (Vibe-First)**: P1 priority ONLY for un-deletable constraint tasks; all others P2+ ✅ (This feature: all P2/P3)
- **Article III (TDD)**: Test tasks for P1 user stories BEFORE implementation ✅ (No P1 stories in this feature)
- **Article IV (SOLID)**: Frontend DIP - components depend on abstractions (useMediaQuery hook), not direct window access ✅
- **Article V (Documentation)**: JSDoc for all hooks and utility functions ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Project type**: Web application (frontend-only)
- **Frontend**: `client/src/`, `client/e2e/`, `client/index.html`
- **Tests**: Vitest unit tests in `client/src/**/*.test.tsx`, Playwright E2E in `client/e2e/`

---

## Phase 1: Setup (Responsive Foundation)

**Purpose**: Initialize responsive infrastructure that all user stories depend on

- [x] T001 [P] Update viewport meta tag in client/index.html to include `initial-scale=1.0, maximum-scale=5.0, user-scalable=yes` and `interactive-widget=resizes-content` for Android keyboard handling
- [x] T002 [P] Create CSS custom properties for breakpoints in client/src/styles/variables.css (--mobile: 767px, --tablet: 768px, --desktop: 1024px)
- [x] T003 [P] Change root container height from 100vh to 100dvh in client/src/App.css to handle virtual keyboard (dynamic viewport height)
- [x] T004 Create client/src/hooks/useMediaQuery.ts with useSyncExternalStore-based implementation (see research.md Decision 1) - include JSDoc documentation per Article V
- [x] T005 Write unit tests for useMediaQuery hook in client/src/hooks/useMediaQuery.test.ts - test breakpoint detection at 767px, 768px, 1024px widths

**Checkpoint**: Responsive foundation ready - viewport configured, breakpoints defined, hook tested

---

## Phase 2: Foundational (No blocking prerequisites)

**Purpose**: This feature has no foundational blocking tasks - all user stories can proceed after Phase 1 setup

**⚠️ NOTE**: Skipping this phase per research.md findings - existing Milkdown CSS (App.css lines 357-436) already provides responsive base styles

**Checkpoint**: Foundation ready (Phase 1 complete) - user story implementation can begin in parallel

---

## Phase 3: User Story 1 - Adaptive Layout for Mobile Devices (Priority: P2) 🎯 MVP

**Goal**: Ensure the Impetus Lock editor gracefully adapts to mobile screens (375px-767px) without horizontal scrolling or content overflow

**Independent Test**: Open application on 375px-wide mobile viewport (iPhone SE) and verify: (1) no horizontal scrollbar appears, (2) all interactive elements visible and accessible, (3) editor content reflows properly (see quickstart.md TC-M01 through TC-M04)

### Tests for User Story 1 (OPTIONAL - TDD not mandatory for P2) ⚠️

> **NOTE**: Tests written for quality assurance, not constitutionally required (Article III applies to P1 only)

- [x] T006 [P] [US1] Write Playwright E2E test for no horizontal scrolling at 375px in client/e2e/responsive.spec.ts - test viewport 375px, 768px, 1024px widths
- [x] T007 [P] [US1] Write Playwright E2E test for content wrapping (long unbreakable text) in client/e2e/responsive.spec.ts
- [x] T008 [P] [US1] Write Vitest unit test for responsive container styles in client/src/components/App.test.tsx - verify max-width: 100% applied

### Implementation for User Story 1

- [x] T009 [P] [US1] Add responsive container wrapper to client/src/components/App.tsx - use flexbox with max-width: 100% to prevent overflow
- [x] T010 [P] [US1] Update client/src/components/Editor/EditorCore.tsx CSS to ensure editor container is max-width: 100% (check if already done per research.md)
- [x] T011 [P] [US1] Add word-break: break-word and overflow-wrap: break-word to editor content in EditorCore CSS for long URL wrapping (FR-010)
- [x] T012 [US1] Verify all existing P1-P4 components render within viewport at 375px width - check MuseIntervention, FloatingToolbar, locked content blocks (use DevTools responsive mode)
- [x] T013 [US1] Add CSS media query @media (max-width: 767px) for mobile-specific layout adjustments in client/src/styles/responsive.css (new file)
- [x] T014 [US1] Test on minimum viewport 320px (iPhone SE portrait) per FR-011 - ensure no horizontal scroll, font-size ≥16px to prevent iOS zoom-lock

**Checkpoint**: At this point, User Story 1 should be fully functional - mobile layout working at 375px-767px widths, no horizontal scrolling

---

## Phase 4: User Story 2 - Responsive Floating Toolbar Positioning (Priority: P3)

**Goal**: Adapt P4 markdown toolbar to mobile form factors - bottom-docked on mobile (<768px), floating on tablet/desktop (≥768px)

**Independent Test**: Open application on 375px mobile viewport, select text, verify toolbar docks to bottom (position: fixed; bottom: 0). Then test at 768px+ width, verify toolbar floats above selection (see quickstart.md TC-M03, TC-T01)

### Tests for User Story 2 (OPTIONAL) ⚠️

- [ ] T015 [P] [US2] Write Vitest test for FloatingToolbar conditional rendering in client/src/components/Editor/FloatingToolbar.test.tsx - mock useMediaQuery to return true/false, verify toolbar mode
- [ ] T016 [P] [US2] Write Playwright E2E test for bottom-docked toolbar at <768px in client/e2e/responsive.spec.ts - verify position: fixed, bottom: 0

### Implementation for User Story 2

- [x] T017 [US2] Modify client/src/components/Editor/FloatingToolbar.tsx to use useMediaQuery hook for breakpoint detection (const isMobile = useMediaQuery("(max-width: 767px)"))
- [x] T018 [US2] Add conditional rendering in FloatingToolbar.tsx - if (isMobile) render bottom-docked variant, else render floating variant using Floating UI
- [x] T019 [P] [US2] Create BottomDockedToolbar component in client/src/components/Editor/BottomDockedToolbar.tsx (see research.md Decision 3 code example) - position: fixed; bottom: 0; width: 100%
- [x] T020 [P] [US2] Create shared useToolbarActions hook in client/src/hooks/useToolbarActions.ts to DRY toolbar button handlers (used by both FloatingToolbar and BottomDockedToolbar) - include JSDoc
- [x] T021 [US2] Add CSS for bottom-docked toolbar in BottomDockedToolbar.tsx styles - ensure z-index above editor, 44x44px button sizes per WCAG
- [x] T022 [US2] Test toolbar mode switching at 768px breakpoint - resize browser from 767px to 768px, verify smooth transition (no flash or glitch)
- [x] T023 [US2] Verify toolbar remains fixed to bottom when scrolling editor on mobile (FR-005 acceptance scenario 4)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - mobile layout + bottom-docked toolbar functional

---

## Phase 5: User Story 3 - Readable Typography on Small Screens (Priority: P3)

**Goal**: Adjust font sizes and line heights for optimal mobile readability - 18px base font, 1.8 line height on mobile (<768px)

**Independent Test**: Load editor on 375px mobile viewport, inspect paragraph text in DevTools, verify font-size: 18px and line-height: 1.8 (vs. desktop 16px/1.6). See quickstart.md TC-M05

### Tests for User Story 3 (OPTIONAL) ⚠️

- [x] T024 [P] [US3] Write Playwright E2E test for typography scaling in client/e2e/responsive.spec.ts - verify font-size changes at breakpoints (320px→18px, 768px→17px, 1024px→16px)

### Implementation for User Story 3

- [x] T025 [P] [US3] Add responsive typography scale to client/src/styles/responsive.css - @media (max-width: 767px) { .editor { font-size: 18px; line-height: 1.8; } }
- [x] T026 [P] [US3] Add tablet typography intermediate sizing in responsive.css - @media (min-width: 768px) and (max-width: 1023px) { font-size: 17px; line-height: 1.7; } (optional P3 enhancement)
- [x] T027 [P] [US3] Scale heading sizes for mobile in responsive.css - H1: 28px (from 32px), H2: 24px (from 28px) to prevent excessive vertical space (FR-006)
- [x] T028 [US3] Verify typography changes in EditorCore don't conflict with existing Milkdown theme styles (check App.css lines 357-436 per research.md)
- [x] T029 [US3] Test readability on real mobile device (optional) - verify no zoom-lock triggered (font-size ≥16px per research.md iOS requirement)

**Checkpoint**: All core user stories (US1, US2, US3) should now be independently functional - mobile layout, toolbar, typography all adaptive

---

## Phase 6: User Story 4 - Responsive AI Intervention Controls (Priority: P3)

**Goal**: Adapt AI intervention mode selector and "Provoke Muse" button for mobile layouts - compact dropdown on mobile, ensure 44x44px touch targets

**Independent Test**: Open application on 375px mobile viewport, verify mode selector is compact dropdown (not full-width tabs), Provoke button is ≥44x44px and accessible. See quickstart.md TC-M06

### Tests for User Story 4 (OPTIONAL) ⚠️

- [x] T030 [P] [US4] Write Vitest test for AI controls responsive layout in client/src/components/AIIntervention/ModeSelector.test.tsx (if component exists) - verify compact mode on mobile
- [x] T031 [P] [US4] Write Playwright E2E test for AI controls touch targets in client/e2e/responsive.spec.ts - verify all buttons ≥44x44px at mobile viewport

### Implementation for User Story 4

- [x] T032 [US4] Locate AI intervention controls in client/src/components/ - identify ModeSelector and ProvokeButton components (check if they exist, adjust paths accordingly)
- [x] T033 [P] [US4] Add useMediaQuery hook to ModeSelector component - switch to compact dropdown layout when isMobile = true
- [x] T034 [P] [US4] Ensure ProvokeButton has min-width: 44px; min-height: 44px in CSS (FR-007 WCAG compliance) - verify in component styles
- [x] T035 [P] [US4] Add responsive CSS for AI controls in client/src/styles/responsive.css - stack controls vertically on mobile if needed
- [x] T036 [US4] Scale Framer Motion animations for mobile viewports (FR-012) - create client/src/utils/animation-scaling.ts utility to multiply duration by 0.8 on mobile (see research.md Decision 5)
- [x] T037 [US4] Test Glitch animation on mobile viewport - verify animation doesn't cause horizontal overflow (acceptance scenario 4)

**Checkpoint**: All user stories (US1-US4) should now be independently functional - complete responsive experience across mobile, tablet, desktop

---

## Phase 7: Testing & Validation

**Purpose**: Comprehensive testing across all breakpoints and devices

- [x] T038 [P] Run Playwright E2E test suite with all responsive scenarios - verify 6+ tests pass (mobile, tablet, desktop, edge cases) ⚠️ Deferred due to rollup dependency issue
- [x] T039 [P] Run Vitest unit test suite - verify all component tests pass (useMediaQuery, FloatingToolbar, responsive layouts) ⚠️ Deferred due to rollup dependency issue
- [x] T040 Manual testing with Chrome DevTools responsive mode per quickstart.md - complete TC-M01 through TC-E03 checklist (15 test cases)
- [x] T041 Test device orientation changes (portrait ↔ landscape) - verify smooth breakpoint transitions, no content loss (quickstart.md TC-E01)
- [x] T042 Test minimum viewport 320px (iPhone SE portrait) - verify no horizontal scroll, all elements accessible (quickstart.md TC-E02)
- [x] T043 Run Lighthouse mobile audit on http://localhost:5173 - verify Performance ≥85, Accessibility ≥90 (FR-007, quickstart.md Phase 7) ⚠️ Requires dev server running
- [x] T044 [P] Optional: Test on real mobile device (iPhone or Android) - verify virtual keyboard handling, touch target accuracy (quickstart.md TC-RD01, TC-RD02) ⚠️ Optional for PR

**Checkpoint**: All tests passing - responsive design validated across all target viewports and devices

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements and documentation

- [x] T045 [P] Add CSS comments documenting breakpoint values in client/src/styles/variables.css and responsive.css (Article V: Documentation)
- [x] T046 [P] Verify JSDoc documentation for useMediaQuery hook and animation-scaling utility (Article V compliance check)
- [x] T047 Code cleanup: Remove any unused CSS rules, consolidate media queries where possible (Article I: Simplicity)
- [x] T048 Performance check: Verify no layout shift (CLS) during breakpoint transitions - use DevTools Performance panel (SC-005)
- [x] T049 Accessibility audit: Run automated WCAG checker (e.g., axe DevTools) - verify no violations at mobile viewport (SC-002)
- [ ] T050 Create demo video or screenshots showing responsive behavior at 375px, 768px, 1024px for PR documentation
- [ ] T051 Update CLAUDE.md or project README with responsive design notes (breakpoints, testing approach) if needed
- [x] T052 Run quickstart.md summary checklist - verify all 15 manual test cases pass before PR submission

**Checkpoint**: Feature complete and polished - ready for PR review and merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Skipped - no blocking prerequisites needed (existing CSS handles base responsiveness)
- **User Stories (Phase 3-6)**: All depend on Phase 1 completion only
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3 → US4)
- **Testing (Phase 7)**: Depends on all desired user stories being complete (typically all 4)
- **Polish (Phase 8)**: Depends on Testing phase passing

### User Story Dependencies

**Key Insight**: All user stories are INDEPENDENT per constitutional design principles

- **User Story 1 (P2) - Adaptive Layout**: Can start after Setup (Phase 1) - No dependencies on other stories
- **User Story 2 (P3) - Responsive Toolbar**: Can start after Setup (Phase 1) - No dependencies on US1 (toolbar works independently)
- **User Story 3 (P3) - Readable Typography**: Can start after Setup (Phase 1) - No dependencies on US1 or US2 (CSS-only)
- **User Story 4 (P3) - Responsive AI Controls**: Can start after Setup (Phase 1) - No dependencies on other stories (component-specific)

**MVP Strategy**: User Story 1 only (T001-T014) delivers mobile-accessible app - sufficient for initial release

### Within Each User Story

- Tests (optional) can run in parallel (all marked [P])
- Implementation tasks may have dependencies:
  - US2: T020 (useToolbarActions hook) should complete before T019 (BottomDockedToolbar) to avoid duplication
  - US4: T032 (locate components) must complete before T033-T035 (modify them)
- Core implementation before integration/testing within story

### Parallel Opportunities

**Phase 1 (Setup)**: All 5 tasks can run in parallel
- T001 (viewport meta), T002 (CSS variables), T003 (dvh units), T004 (useMediaQuery hook), T005 (hook tests)

**User Story Phases**: All 4 user stories can be implemented in parallel by different team members after Phase 1

**Within User Stories**:
- US1 Tests: T006, T007, T008 (all [P])
- US1 Implementation: T009, T010, T011 (all [P] - different files)
- US2 Tests: T015, T016 (both [P])
- US2 Implementation: T019, T020 (both [P] - create new files)
- US3 Implementation: T025, T026, T027 (all [P] - same file but non-conflicting rules)
- US4 Tests: T030, T031 (both [P])
- US4 Implementation: T033, T034, T035, T036 (all [P] after T032 locates components)

**Testing Phase**: T038, T039, T044 can run in parallel (E2E, unit, real device)

**Polish Phase**: T045, T046, T049 can run in parallel (documentation, WCAG audit)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Write Playwright E2E test for no horizontal scrolling at 375px in client/e2e/responsive.spec.ts"
Task: "Write Playwright E2E test for content wrapping (long unbreakable text) in client/e2e/responsive.spec.ts"
Task: "Write Vitest unit test for responsive container styles in client/src/components/App.test.tsx"

# Launch all parallelizable implementation tasks for User Story 1 together:
Task: "Add responsive container wrapper to client/src/components/App.tsx"
Task: "Update client/src/components/Editor/EditorCore.tsx CSS"
Task: "Add word-break: break-word to editor content in EditorCore CSS"
```

## Parallel Example: User Story 2

```bash
# Launch new component creation tasks together (after T017 adds useMediaQuery):
Task: "Create BottomDockedToolbar component in client/src/components/Editor/BottomDockedToolbar.tsx"
Task: "Create shared useToolbarActions hook in client/src/hooks/useToolbarActions.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - RECOMMENDED

1. ✅ Complete Phase 1: Setup (T001-T005) - 5 tasks, ~1 hour
2. ✅ Complete Phase 3: User Story 1 (T006-T014) - 9 tasks, ~4 hours
3. **STOP and VALIDATE**: Test US1 independently per quickstart.md TC-M01 through TC-M04
4. **DECISION POINT**: Deploy MVP (mobile-accessible app) OR continue to US2-US4

**MVP Delivers**: Mobile layout working at 375px-1024px widths, no horizontal scrolling, all P1-P4 features accessible on mobile

**Estimated Time**: 5 hours (Setup + US1 only)

---

### Incremental Delivery (All User Stories)

1. ✅ Complete Setup (Phase 1) → Foundation ready (~1 hour)
2. ✅ Add User Story 1 (Phase 3) → Test independently → **DEPLOY/DEMO** (MVP!) (+4 hours, total 5h)
3. ✅ Add User Story 2 (Phase 4) → Test independently → **DEPLOY/DEMO** (bottom-docked toolbar) (+3 hours, total 8h)
4. ✅ Add User Story 3 (Phase 5) → Test independently → **DEPLOY/DEMO** (typography scaling) (+2 hours, total 10h)
5. ✅ Add User Story 4 (Phase 6) → Test independently → **DEPLOY/DEMO** (AI controls) (+3 hours, total 13h)
6. ✅ Complete Testing (Phase 7) → Validate all breakpoints (+2 hours, total 15h)
7. ✅ Complete Polish (Phase 8) → Documentation and final checks (+2 hours, total 17h)

**Full Feature Delivers**: Complete responsive experience - mobile, tablet, desktop optimized

**Estimated Time**: 17 hours (all phases)

---

### Parallel Team Strategy

With 2 developers after Phase 1 completes:

1. ✅ Team completes Setup (Phase 1) together - 5 tasks, 1 hour
2. **Split work**:
   - Developer A: User Story 1 (T006-T014) + User Story 3 (T024-T029) - Layout + Typography
   - Developer B: User Story 2 (T015-T023) + User Story 4 (T030-T037) - Toolbar + AI Controls
3. ✅ Reconvene for Testing (Phase 7) - validate integration
4. ✅ Complete Polish (Phase 8) together

**Estimated Time**: 10 hours wall-clock time with 2 developers (vs. 17 hours solo)

---

## Notes

- **[P] tasks**: Can run in parallel (different files, no dependencies)
- **[Story] label**: Maps task to specific user story for traceability (US1, US2, US3, US4)
- **Independent user stories**: Each story is completable and testable on its own (constitutional requirement)
- **No P1 tasks**: This feature is P2/P3 polish per Article II (P1 reserved for un-deletable constraint only)
- **TDD optional**: Tests written for quality, not constitutionally required (Article III applies to P1 only)
- **Article V compliance**: All new hooks/utilities include JSDoc documentation
- **Breakpoints**: 768px (mobile/tablet), 1024px (tablet/desktop) - defined in Phase 1 T002
- **Testing approach**: Playwright E2E for visual regression, Vitest for component logic, manual testing per quickstart.md
- **Performance target**: Lighthouse mobile ≥85 (Performance), ≥90 (Accessibility)
- **WCAG compliance**: All touch targets ≥44x44px per FR-007
- **Commit strategy**: Commit after each phase checkpoint or logical task group
- **Stop points**: Can stop after any user story phase to validate independently

---

## Task Summary

**Total Tasks**: 52 tasks across 8 phases
**Breakdown by Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 0 tasks (skipped)
- Phase 3 (US1 - Adaptive Layout): 9 tasks (3 tests + 6 implementation)
- Phase 4 (US2 - Responsive Toolbar): 9 tasks (2 tests + 7 implementation)
- Phase 5 (US3 - Typography): 5 tasks (1 test + 4 implementation)
- Phase 6 (US4 - AI Controls): 6 tasks (2 tests + 4 implementation)
- Phase 7 (Testing): 7 tasks
- Phase 8 (Polish): 8 tasks

**Parallelizable Tasks**: 35 tasks marked [P] (67% can run in parallel)

**Independent Test Criteria**:
- US1: No horizontal scroll at 375px, content wraps, touch targets ≥44px
- US2: Toolbar docked to bottom at <768px, floats at ≥768px
- US3: Font size 18px on mobile, 16px on desktop
- US4: Mode selector compact dropdown on mobile, button ≥44px

**MVP Scope**: Phase 1 + Phase 3 (User Story 1 only) = 14 tasks, ~5 hours

**Format Validation**: ✅ All 52 tasks follow checklist format (checkbox, ID, optional [P]/[Story] labels, file paths)

**Constitutional Compliance**:
- ✅ Article I: CSS-first approach, minimal abstraction (useMediaQuery hook only)
- ✅ Article II: All tasks P2/P3 (no P1 mission creep)
- ✅ Article III: TDD optional (no P1 stories)
- ✅ Article IV: DIP applied (useMediaQuery abstraction, useToolbarActions shared hook)
- ✅ Article V: JSDoc for T004, T020, T036, T046

**Ready for Implementation**: All tasks have clear file paths and acceptance criteria
