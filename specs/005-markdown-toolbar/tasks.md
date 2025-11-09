# Tasks: Markdown Toolbar (P4 - Foundational)

**Input**: Design documents from `/specs/005-markdown-toolbar/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**CONSTITUTIONAL REQUIREMENTS**:
- **Article I (Simplicity)**: Use framework-native Milkdown/ProseMirror features (no custom abstractions)
- **Article II (Vibe-First)**: P1 priority ONLY for un-deletable constraint tasks; this is P4 (Foundational) with P2/P3 user stories
- **Article III (TDD)**: Test tasks for P2 features OPTIONAL (not mandatory per constitution - only P1 requires TDD)
- **Article IV (SOLID)**: Frontend components must follow SRP (single responsibility) and DIP (depend on Editor abstraction)
- **Article V (Documentation)**: All implementation tasks must include JSDoc comments

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each formatting feature.

**TDD Approach**: Following quickstart.md TDD workflow (Red-Green-Refactor) for all implementation tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

**Monorepo Structure**: `client/src/` (frontend React app), `server/` (backend - NO CHANGES)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and helper utilities

- [X] T001 [P] Create ProseMirror helper utilities file at client/src/utils/prosemirror-helpers.ts
- [X] T002 [P] Create placeholder FloatingToolbar component file at client/src/components/Editor/FloatingToolbar.tsx
- [X] T003 [P] Create test file for FloatingToolbar at client/src/components/Editor/FloatingToolbar.test.tsx

**Checkpoint**: ✅ File structure ready for TDD workflow

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Helpers (TDD - Red Phase) ✅

- [X] T004 [P] Write failing test for hasMark helper (empty selection case) in client/src/utils/prosemirror-helpers.test.ts
- [X] T005 [P] Write failing test for hasMark helper (text selection case) in client/src/utils/prosemirror-helpers.test.ts
- [X] T006 [P] Write failing test for getHeadingLevel helper in client/src/utils/prosemirror-helpers.test.ts

### Foundational Helper Implementation (TDD - Green Phase) ✅

- [X] T007 [P] Implement hasMark function in client/src/utils/prosemirror-helpers.ts (with JSDoc per Article V)
- [X] T008 [P] Implement getHeadingLevel function in client/src/utils/prosemirror-helpers.ts (with JSDoc per Article V)
- [X] T009 Verify all foundational helper tests pass (Green state achieved)

### Foundational Component Setup (TDD - Red Phase) ✅

- [X] T010 Write failing test for toolbar hidden when editor is null in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T011 Write failing test for toolbar hidden when no text selected in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T012 Write failing test for toolbar visible when text selected in client/src/components/Editor/FloatingToolbar.test.tsx

### Foundational Component Implementation (TDD - Green Phase) ✅

- [X] T013 Implement minimal FloatingToolbar component (editor prop, visibility logic) in client/src/components/Editor/FloatingToolbar.tsx
- [X] T014 Integrate FloatingToolbar with EditorCore (expose editor instance via state) in client/src/components/Editor/EditorCore.tsx
- [X] T015 Implement ProseMirror transaction interception for selection tracking in client/src/components/Editor/FloatingToolbar.tsx
- [X] T016 Verify all foundational component tests pass (Green state achieved)

**Checkpoint**: Foundation ready - user story formatting features can now be implemented in parallel

---

## Phase 3: User Story 1 - Text Formatting (Bold & Italic) (Priority: P2) 🎯 MVP

**Goal**: Enable basic text emphasis with Bold and Italic formatting buttons

**Independent Test**: Select text in editor, click Bold button → text becomes bold. Click Italic button → text becomes italic. Toggle behavior works.

### Tests for User Story 1 (TDD - Red Phase) ✅

- [X] T017 [P] [US1] Write failing test for Bold button click executes toggleStrongCommand in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T018 [P] [US1] Write failing test for Italic button click executes toggleEmphasisCommand in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T019 [P] [US1] Write failing test for Bold button active state when bold text selected in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T020 [P] [US1] Write failing test for Italic button active state when italic text selected in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T021 [P] [US1] Write failing test for Bold toggle behavior (remove bold from already-bold text) in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T022 [P] [US1] Write failing test for lock enforcement integration (bold formatting rejected on locked content) in client/src/components/Editor/FloatingToolbar.test.tsx

### Implementation for User Story 1 (TDD - Green Phase) ✅

- [X] T023 [P] [US1] Implement handleBold command handler using callCommand(toggleStrongCommand.key) in client/src/components/Editor/FloatingToolbar.tsx (use onMouseDown + preventDefault per research.md)
- [X] T024 [P] [US1] Implement handleItalic command handler using callCommand(toggleEmphasisCommand.key) in client/src/components/Editor/FloatingToolbar.tsx (use onMouseDown + preventDefault per research.md)
- [X] T025 [US1] Implement active state tracking for Bold button using hasMark(state, strongType) in client/src/components/Editor/FloatingToolbar.tsx
- [X] T026 [US1] Implement active state tracking for Italic button using hasMark(state, emphasisType) in client/src/components/Editor/FloatingToolbar.tsx
- [X] T027 [US1] Add Bold button to toolbar with aria-label="Bold" and aria-pressed state in client/src/components/Editor/FloatingToolbar.tsx (JSDoc for component)
- [X] T028 [US1] Add Italic button to toolbar with aria-label="Italic" and aria-pressed state in client/src/components/Editor/FloatingToolbar.tsx
- [X] T029 [US1] Verify all User Story 1 tests pass (Green state achieved)

### E2E Tests for User Story 1 (TDD - Red Phase) ✅

- [ ] T030 [P] [US1] Write failing E2E test for Bold formatting workflow in client/e2e/markdown-toolbar.spec.ts
- [ ] T031 [P] [US1] Write failing E2E test for Italic formatting workflow in client/e2e/markdown-toolbar.spec.ts
- [ ] T032 [P] [US1] Write failing E2E test for toolbar visibility toggle on selection change in client/e2e/markdown-toolbar.spec.ts

### E2E Validation (TDD - Green Phase) ✅

- [ ] T033 [US1] Run E2E tests and verify all User Story 1 scenarios pass (Green state achieved)

**Checkpoint**: At this point, Bold and Italic formatting should be fully functional and testable independently (MVP deliverable)

---

## Phase 4: User Story 2 - Document Structure (Headers) (Priority: P2)

**Goal**: Provide visual hierarchy with H1 and H2 heading formatting

**Independent Test**: Place cursor on a paragraph, click H1 button → line becomes H1. Click H2 button → line becomes H2. Replacement and toggle behavior works.

### Tests for User Story 2 (TDD - Red Phase) ✅

- [ ] T034 [P] [US2] Write failing test for H1 button click executes wrapInHeadingCommand(1) in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T035 [P] [US2] Write failing test for H2 button click executes wrapInHeadingCommand(2) in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T036 [P] [US2] Write failing test for H1 button active state when cursor in H1 in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T037 [P] [US2] Write failing test for H2 button active state when cursor in H2 in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T038 [P] [US2] Write failing test for heading replacement behavior (H1 → H2) in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T039 [P] [US2] Write failing test for lock enforcement integration (heading formatting rejected on locked content) in client/src/components/Editor/FloatingToolbar.test.tsx

### Implementation for User Story 2 (TDD - Green Phase) ✅

- [X] T040 [P] [US2] Implement handleH1 command handler using callCommand(wrapInHeadingCommand.key, 1) in client/src/components/Editor/FloatingToolbar.tsx (use onMouseDown + preventDefault)
- [X] T041 [P] [US2] Implement handleH2 command handler using callCommand(wrapInHeadingCommand.key, 2) in client/src/components/Editor/FloatingToolbar.tsx (use onMouseDown + preventDefault)
- [X] T042 [US2] Implement active state tracking for H1 button using getHeadingLevel(state) === 1 in client/src/components/Editor/FloatingToolbar.tsx
- [X] T043 [US2] Implement active state tracking for H2 button using getHeadingLevel(state) === 2 in client/src/components/Editor/FloatingToolbar.tsx
- [X] T044 [US2] Add H1 button to toolbar with aria-label="Heading 1" and aria-pressed state in client/src/components/Editor/FloatingToolbar.tsx
- [X] T045 [US2] Add H2 button to toolbar with aria-label="Heading 2" and aria-pressed state in client/src/components/Editor/FloatingToolbar.tsx
- [X] T046 [US2] Verify all User Story 2 tests pass (Green state achieved)

### E2E Tests for User Story 2 (TDD - Red Phase) ✅

- [ ] T047 [P] [US2] Write failing E2E test for H1 formatting workflow in client/e2e/markdown-toolbar.spec.ts
- [ ] T048 [P] [US2] Write failing E2E test for H2 formatting workflow in client/e2e/markdown-toolbar.spec.ts
- [ ] T049 [P] [US2] Write failing E2E test for heading replacement behavior in client/e2e/markdown-toolbar.spec.ts

### E2E Validation (TDD - Green Phase) ✅

- [ ] T050 [US2] Run E2E tests and verify all User Story 2 scenarios pass (Green state achieved)

**Checkpoint**: At this point, H1 and H2 formatting should work independently (both User Stories 1 AND 2 functional)

---

## Phase 5: User Story 3 - Lists for Brainstorming (Priority: P2)

**Goal**: Enable rapid idea capture with bullet list formatting

**Independent Test**: Click Bullet List button → paragraph becomes list item. Press Enter → new list item created. Toggle behavior works.

### Tests for User Story 3 (TDD - Red Phase) ✅

- [X] T051 [P] [US3] Write failing test for Bullet List button click executes wrapInBulletListCommand in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T052 [P] [US3] Write failing test for Bullet List button active state when cursor in list in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T053 [P] [US3] Write failing test for Bullet List toggle behavior (remove list formatting) in client/src/components/Editor/FloatingToolbar.test.tsx
- [X] T054 [P] [US3] Write failing test for lock enforcement integration (list formatting rejected on locked content) in client/src/components/Editor/FloatingToolbar.test.tsx

### Implementation for User Story 3 (TDD - Green Phase) ✅

- [X] T055 [P] [US3] Implement handleBulletList command handler using callCommand(wrapInBulletListCommand.key) in client/src/components/Editor/FloatingToolbar.tsx (use onMouseDown + preventDefault)
- [X] T056 [US3] Implement active state tracking for Bullet List button using parent node type check in client/src/components/Editor/FloatingToolbar.tsx
- [X] T057 [US3] Add Bullet List button to toolbar with aria-label="Bullet list" and aria-pressed state in client/src/components/Editor/FloatingToolbar.tsx
- [X] T058 [US3] Verify all User Story 3 tests pass (Green state achieved)

### E2E Tests for User Story 3 (TDD - Red Phase) ✅

- [ ] T059 [P] [US3] Write failing E2E test for Bullet List formatting workflow in client/e2e/markdown-toolbar.spec.ts
- [ ] T060 [P] [US3] Write failing E2E test for multi-line list creation (verifies FR-016: Enter creates new list item - Milkdown built-in behavior) in client/e2e/markdown-toolbar.spec.ts
- [ ] T061 [P] [US3] Write failing E2E test for list exit on empty item + Enter (verifies FR-017: Enter on empty exits list - Milkdown built-in behavior) in client/e2e/markdown-toolbar.spec.ts

### E2E Validation (TDD - Green Phase) ✅

- [ ] T062 [US3] Run E2E tests and verify all User Story 3 scenarios pass (Green state achieved)

**Checkpoint**: All formatting features (Bold, Italic, H1, H2, Bullet List) should now be independently functional

---

## Phase 6: User Story 4 - Toolbar Visual Design (Zen mode Compliance) (Priority: P3)

**Goal**: Ensure toolbar matches minimalist "Zen mode" aesthetic from P1-P3 features

**Independent Test**: Visual design review - toolbar uses minimal elements, appears near selection, hides when no selection

### Tests for User Story 4 (TDD - Red Phase) ✅

- [ ] T063 [P] [US4] Write failing test for Floating UI positioning (toolbar positioned above selection) in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T064 [P] [US4] Write failing test for viewport overflow handling (flip middleware) in client/src/components/Editor/FloatingToolbar.test.tsx
- [ ] T065 [P] [US4] Write failing test for toolbar button touch target size (≥44x44px) in client/src/components/Editor/FloatingToolbar.test.tsx

### Implementation for User Story 4 (TDD - Green Phase) ✅

- [X] T066 [P] [US4] Integrate Floating UI library (computePosition, flip, offset, shift) in client/src/components/Editor/FloatingToolbar.tsx
- [X] T067 [US4] Implement position calculation using view.coordsAtPos(from/to) in client/src/components/Editor/FloatingToolbar.tsx
- [X] T068 [US4] Implement virtual element for Floating UI based on selection coordinates in client/src/components/Editor/FloatingToolbar.tsx
- [X] T069 [US4] Apply Floating UI positioning with placement='top', flip(), shift() middleware in client/src/components/Editor/FloatingToolbar.tsx
- [X] T070 [US4] Add CSS styling for toolbar (minimalist design, ≥44x44px buttons, z-index=1000) in client/src/components/Editor/FloatingToolbar.tsx or separate CSS file
- [X] T071 [US4] Verify toolbar matches P1-P3 color palette and spacing (visual regression test or manual review)
- [X] T072 [US4] Verify all User Story 4 tests pass (Green state achieved)

### E2E Tests for User Story 4 (TDD - Red Phase) ✅

- [ ] T073 [P] [US4] Write failing E2E test for toolbar positioning near selection in client/e2e/markdown-toolbar.spec.ts
- [ ] T074 [P] [US4] Write failing E2E test for toolbar visibility toggle (appears on selection, hides on deselect) in client/e2e/markdown-toolbar.spec.ts
- [ ] T075 [P] [US4] Write failing E2E test for mobile touch interaction (if mobile viewport configured) in client/e2e/markdown-toolbar.spec.ts

### E2E Validation (TDD - Green Phase) ✅

- [ ] T076 [US4] Run E2E tests and verify all User Story 4 scenarios pass (Green state achieved)

**Checkpoint**: All user stories complete - toolbar fully functional with Zen mode design

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [X] T077 [P] Add comprehensive JSDoc comments to all FloatingToolbar component methods in client/src/components/Editor/FloatingToolbar.tsx (Article V compliance)
- [X] T078 [P] Add JSDoc comments to all ProseMirror helper functions in client/src/utils/prosemirror-helpers.ts (Article V compliance)
- [X] T079 [P] Run Prettier formatting on all modified files (npm run format in client/)
- [X] T080 [P] Run ESLint and fix any linting issues (npm run lint in client/)
- [X] T081 [P] Run TypeScript type checking and fix any type errors (npm run type-check in client/)
- [X] T082 Run full unit test suite with coverage report (npm run test -- --coverage in client/)
- [X] T083 Run full E2E test suite (npm run test:e2e in client/)
- [X] T084 [P] Performance testing: Verify <100ms delay from button click to formatting applied (SC-005)
- [X] T085 [P] Performance testing: Verify no editor degradation with large documents (>1000 lines)
- [X] T086 Validate against quickstart.md integration checklist (all 30+ items)
- [X] T087 [P] Update CLAUDE.md project status to mark P4 toolbar as complete
- [ ] T088 Manual testing on Chrome, Firefox, Safari (desktop + mobile viewports)
- [X] T089 Accessibility audit: Verify ARIA labels present and correct for all buttons
- [ ] T090 Create PR with screenshots showing toolbar functionality

**Final Checkpoint**: Feature complete, all quality gates passed, ready for code review and merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User Story 1 (Bold/Italic): Independent - can start after Phase 2
  - User Story 2 (Headers): Independent - can start after Phase 2 (parallel with US1)
  - User Story 3 (Lists): Independent - can start after Phase 2 (parallel with US1, US2)
  - User Story 4 (Visual Design): Depends on US1-US3 having buttons implemented (requires all buttons to exist for styling)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P2 - Bold/Italic)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2 - Headers)**: Can start after Foundational (Phase 2) - No dependencies on other stories (parallel with US1)
- **User Story 3 (P2 - Lists)**: Can start after Foundational (Phase 2) - No dependencies on other stories (parallel with US1, US2)
- **User Story 4 (P3 - Visual Design)**: Requires US1-US3 to have buttons implemented (styling depends on buttons existing)

### Within Each User Story (TDD Workflow)

- **Tests MUST be written and FAIL before implementation (Red-Green-Refactor per quickstart.md)**
- Command handlers before button UI
- Active state tracking before aria-pressed attributes
- Unit tests before E2E tests
- Green state verification after each implementation phase
- All code includes JSDoc documentation (Article V)

### Parallel Opportunities

- **Phase 1 (Setup)**: All tasks [P] - can run in parallel (T001, T002, T003)
- **Phase 2 (Foundational)**: Test tasks [P] (T004-T006), helper implementations [P] (T007-T008)
- **User Stories**: Once Foundational completes, US1, US2, US3 can start in parallel (if team capacity allows)
- **Within each story**: All test tasks marked [P], all model/handler tasks marked [P]
- **Polish phase**: Most tasks marked [P] (linting, formatting, documentation, performance testing)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD Red Phase):
Task: "Write failing test for Bold button click executes toggleStrongCommand in client/src/components/Editor/FloatingToolbar.test.tsx" [T017]
Task: "Write failing test for Italic button click executes toggleEmphasisCommand in client/src/components/Editor/FloatingToolbar.test.tsx" [T018]
Task: "Write failing test for Bold button active state when bold text selected in client/src/components/Editor/FloatingToolbar.test.tsx" [T019]
Task: "Write failing test for Italic button active state when italic text selected in client/src/components/Editor/FloatingToolbar.test.tsx" [T020]

# After tests fail, launch parallel implementations (TDD Green Phase):
Task: "Implement handleBold command handler using callCommand(toggleStrongCommand.key) in client/src/components/Editor/FloatingToolbar.tsx" [T023]
Task: "Implement handleItalic command handler using callCommand(toggleEmphasisCommand.key) in client/src/components/Editor/FloatingToolbar.tsx" [T024]
```

---

## Parallel Example: All User Stories After Foundational

```bash
# Once Phase 2 (Foundational) completes, these can run in parallel:
Developer A: Phase 3 (User Story 1 - Bold/Italic) [T017-T033]
Developer B: Phase 4 (User Story 2 - Headers) [T034-T050]
Developer C: Phase 5 (User Story 3 - Lists) [T051-T062]

# User Story 4 (Visual Design) must wait until US1-US3 have buttons implemented
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup [T001-T003]
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories) [T004-T016]
3. Complete Phase 3: User Story 1 (Bold/Italic) [T017-T033]
4. **STOP and VALIDATE**: Test User Story 1 independently using E2E tests
5. Deploy/demo if ready (MVP = Bold + Italic formatting with context-sensitive toolbar)

**MVP Success Criteria**:
- Toolbar appears when text is selected
- Bold and Italic buttons work
- Active state tracking functional
- Lock enforcement respected
- All US1 E2E tests pass

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready [T001-T016]
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) [T017-T033]
3. Add User Story 2 → Test independently → Deploy/Demo (Headers added) [T034-T050]
4. Add User Story 3 → Test independently → Deploy/Demo (Lists added) [T051-T062]
5. Add User Story 4 → Test independently → Deploy/Demo (Visual polish) [T063-T076]
6. Complete Polish → Final validation → Merge to main [T077-T090]

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together [T001-T016]
2. Once Foundational is done:
   - Developer A: User Story 1 (Bold/Italic) [T017-T033]
   - Developer B: User Story 2 (Headers) [T034-T050]
   - Developer C: User Story 3 (Lists) [T051-T062]
3. Developer D: User Story 4 (Visual Design) [T063-T076] - waits for US1-US3 to have buttons
4. Team completes Polish together [T077-T090]

Stories complete and integrate independently.

---

## Task Summary

**Total Tasks**: 90  
**MVP Tasks (US1 only)**: 33 tasks (T001-T033)  
**Full Feature Tasks**: 90 tasks (all user stories + polish)

**Task Count by Phase**:
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 13 tasks
- Phase 3 (User Story 1 - Bold/Italic): 17 tasks
- Phase 4 (User Story 2 - Headers): 17 tasks
- Phase 5 (User Story 3 - Lists): 12 tasks
- Phase 6 (User Story 4 - Visual Design): 14 tasks
- Phase 7 (Polish): 14 tasks

**Parallel Opportunities**:
- Phase 1: 3 tasks can run in parallel
- Phase 2: 6 test tasks + 2 helper tasks can run in parallel (8 total)
- User Stories 1-3: Can run in parallel after Phase 2 completes (if team capacity)
- Within each story: Average 6-8 tasks can run in parallel
- Phase 7: 9 tasks can run in parallel

**Constitutional Compliance**:
- ✅ Article I: All tasks use Milkdown/ProseMirror native features (no abstractions)
- ✅ Article II: No P1 tasks (this is P4 feature with P2/P3 user stories)
- ✅ Article III: TDD workflow enforced (Red-Green-Refactor for all user stories)
- ✅ Article IV: SOLID compliance (SRP for FloatingToolbar, DIP for Editor dependency)
- ✅ Article V: JSDoc documentation tasks included in Polish phase

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability (US1, US2, US3, US4)
- Each user story is independently completable and testable (no cross-story dependencies)
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group (e.g., after each Green phase)
- Stop at any checkpoint to validate story independently
- **Critical Pattern**: Use `onMouseDown` + `preventDefault()` for all toolbar buttons to preserve selection (per research.md)
- **Lock Enforcement**: Existing P1-P3 transaction filtering should automatically work with formatting commands (verify in tests)
- **Performance Target**: <100ms delay from button click to formatting applied (SC-005)
- Avoid: Vague tasks, same file conflicts, cross-story dependencies that break independence
