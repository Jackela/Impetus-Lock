# Tasks: E2E Workflow Backend Import Fix

**Input**: Design documents from `/specs/004-fix-e2e-workflow/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**CONSTITUTIONAL REQUIREMENTS**:
- **Article I (Simplicity)**: Use framework-native features (Poetry, GitHub Actions), no custom abstractions
- **Article II (Vibe-First)**: This is a bug fix enabling P1 feature testing (E2E tests for un-deletable lock)
- **Article III (TDD)**: Workflow execution IS the test - green GitHub Actions = success
- **Article IV (SOLID)**: Not applicable (no backend code changes)
- **Article V (Documentation)**: Workflow YAML self-documenting via step names and comments

**Organization**: Tasks are organized by user story (US1: E2E Tests Pass in CI, US2: Backend Module Imports Work, US3: Database Connection Available)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a monorepo web application:
- **Workflows**: `.github/workflows/` (e2e.yml, ci.yml)
- **Backend**: `server/` (pyproject.toml, README.md)
- **Frontend**: `client/` (no changes needed)

---

## Phase 1: Setup (Verification & Documentation)

**Purpose**: Verify current state and ensure local validation workflow is in place

- [x] T001 Verify `server/pyproject.toml` has `packages = [{include = "server"}]` (already exists per research.md)
- [x] T002 Verify `server/README.md` exists (already exists per research.md)
- [x] T003 [P] Verify `.github/workflows/e2e.yml` line 62 uses `poetry install` without `--no-root` (already correct per research.md)

**Checkpoint**: Current configuration verified - ready to fix remaining CI workflow issues

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix CI workflow `--no-root` issues that block ALL user stories

**⚠️ CRITICAL**: This phase MUST be complete before E2E tests can pass

- [x] T004 Fix `.github/workflows/ci.yml` line 43: Change `poetry install --no-root` to `poetry install` (lint job)
- [x] T005 Fix `.github/workflows/ci.yml` line 105: Change `poetry install --no-root` to `poetry install` (type-check job)  
- [x] T006 Fix `.github/workflows/ci.yml` line 153: Change `poetry install --no-root` to `poetry install` (backend-tests job)

**Checkpoint**: All Poetry install commands correct - backend server should now be importable in CI

---

## Phase 3: User Story 1 - E2E Tests Execute Successfully in CI (Priority: P1) 🎯 MVP

**Goal**: GitHub Actions E2E workflow completes with all Playwright tests passing (green status)

**Independent Test**: Push to main branch → GitHub Actions E2E workflow runs → All jobs green, backend starts within 30s, E2E tests execute

### Validation for User Story 1 (Infrastructure Testing)

> **NOTE**: This is an infrastructure fix. The test IS the workflow execution itself (not TDD code tests).

- [x] T007 [US1] Validate fix with Act CLI locally: Run `act -j lint` and `act -j type-check` to verify syntax (per quickstart.md)
- [x] T008 [US1] Validate backend startup with Docker Compose: Follow quickstart.md Docker Compose guide to verify `poetry install` + `poetry run uvicorn server.main:app` starts without import errors
- [x] T009 [US1] Verify health endpoint responds: `curl http://localhost:8000/health` returns `{"status":"ok"}` within 60s

### Implementation for User Story 1

- [x] T010 [US1] Commit CI workflow fixes with message: `fix: Remove --no-root from poetry install in CI workflows`
- [x] T011 [US1] Push to branch `004-fix-e2e-workflow` and verify GitHub Actions E2E workflow status
- [x] T012 [US1] Monitor E2E workflow execution: Verify backend server starts without "Could not import module 'server.main'" error
- [x] T013 [US1] Verify Playwright tests execute: Confirm all E2E tests run (not skipped due to backend unavailability)
- [x] T014 [US1] Confirm success criteria SC-001: E2E workflow completes with green status, no failures

**Checkpoint**: E2E workflow should now pass completely - backend starts, tests execute, all jobs green ✅

---

## Phase 4: User Story 2 - Backend Module Imports Work in Poetry Virtualenv (Priority: P1)

**Goal**: `poetry run uvicorn server.main:app` succeeds without "Could not import module" errors in CI

**Independent Test**: Run `poetry install` + `poetry run python -c "import server.main; print('✅ Import successful')"` in GitHub Actions container

### Validation for User Story 2 (Already Complete via Phase 2)

> **NOTE**: User Story 2 is satisfied by the same fixes in Phase 2 (removing `--no-root` flag). No additional tasks needed.

**Status**: ✅ **COMPLETE** after Phase 2 fixes

**Evidence**:
- Research.md identified root cause: `--no-root` prevents package installation
- Phase 2 removed all `--no-root` flags from CI workflows
- Poetry will now install `server` package making `import server.main` work

**Checkpoint**: Backend module imports working - confirmed by E2E workflow success in US1

---

## Phase 5: User Story 3 - Database Connection Available for Tests (Priority: P2)

**Goal**: PostgreSQL service container accessible from backend server for E2E test data operations

**Independent Test**: E2E tests create/read/update data successfully, backend connects to `postgresql://postgres:postgres@postgres:5432/impetus_lock_test`

### Validation for User Story 3 (Already Complete - No Changes Needed)

> **NOTE**: Research.md confirmed current configuration is already correct.

**Status**: ✅ **ALREADY CORRECT** - No fixes needed

**Evidence**:
- `.github/workflows/e2e.yml` line 68 already uses `@postgres:5432` (correct service container hostname)
- PostgreSQL service container already configured with health checks (lines 20-33)
- Port mapping already correct: `5432:5432` (line 32-33)

**Checkpoint**: Database connectivity working - E2E tests should be able to interact with PostgreSQL

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and documentation updates

- [x] T015 [P] Update `CLAUDE.md` "Current Project Status" section: Change from "❌ FAILING" to "✅ PASSING" for E2E tests
- [x] T016 [P] Create `specs/004-fix-e2e-workflow/COMPLETION.md` documenting fix and validation results
- [x] T017 Verify all CI workflows green: Check lint, type-check, backend-tests, frontend-tests, E2E all passing
- [x] T018 Run local validation per quickstart.md: Act CLI + Docker Compose to confirm local reproducibility
- [ ] T019 Create PR from `004-fix-e2e-workflow` to `main` with summary of fixes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: Depends on Setup verification - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) - E2E workflow fixes
- **User Story 2 (Phase 4)**: ✅ **COMPLETE** after Phase 2 (same root cause)
- **User Story 3 (Phase 5)**: ✅ **ALREADY CORRECT** (no fixes needed)
- **Polish (Phase 6)**: Depends on US1 success

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 completion - No dependencies on other stories
- **User Story 2 (P1)**: ✅ Solved by Phase 2 fixes (Poetry package installation)
- **User Story 3 (P2)**: ✅ Already working (container networking already correct)

### Critical Path

```
Phase 1 (Verification) → Phase 2 (Fix --no-root) → Phase 3 (US1: E2E Tests Pass) → Phase 6 (Polish)
                              ↓
                       Phase 4 (US2: ✅ Complete)
                       Phase 5 (US3: ✅ Already Correct)
```

### Parallel Opportunities

- **Phase 1**: Tasks T001, T002, T003 can run in parallel (different file reads)
- **Phase 6**: Tasks T015, T016 can run in parallel (different file writes)
- **User Stories**: US2 and US3 require no additional work after Phase 2

---

## Parallel Example: Verification Phase

```bash
# Launch all verification tasks together (Phase 1):
Task: "Verify server/pyproject.toml has packages field"
Task: "Verify server/README.md exists"
Task: "Verify .github/workflows/e2e.yml uses poetry install"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Complete Phase 1**: Verify current configuration (T001-T003)
2. **Complete Phase 2**: Fix CI workflow `--no-root` issues (T004-T006) - **CRITICAL BLOCKER**
3. **Complete Phase 3**: Validate E2E workflow success (T007-T014)
4. **STOP and VALIDATE**: Verify GitHub Actions E2E workflow green status
5. **Success Criteria Met**:
   - ✅ SC-001: E2E workflow completes with green status
   - ✅ SC-002: Backend starts within 30s
   - ✅ SC-003: Health endpoint responds within 60s
   - ✅ SC-004: 100% of E2E tests execute
   - ✅ SC-005: Workflow completes under 5 minutes
   - ✅ SC-006: Zero import errors in logs

### Incremental Delivery

1. **Phase 1 + 2**: Foundation ready (CI workflows fixed)
2. **Phase 3 (US1)**: E2E tests passing → **MVP COMPLETE** ✅
3. **Phase 4 (US2)**: ✅ Already complete (same fix as Phase 2)
4. **Phase 5 (US3)**: ✅ Already working (no changes needed)
5. **Phase 6**: Documentation updates and PR creation

### Single Developer Strategy

Sequential execution (recommended):

1. Verify current state (Phase 1) - 5 minutes
2. Fix CI workflows (Phase 2) - 10 minutes
3. Validate E2E success (Phase 3) - 15 minutes
4. Polish and document (Phase 6) - 20 minutes

**Total Estimated Time**: ~50 minutes

---

## Task Summary

**Total Tasks**: 19  
**Critical Path Tasks**: 14 (T001-T014)  
**Polish Tasks**: 5 (T015-T019)

**Tasks by User Story**:
- **US1 (E2E Tests Pass)**: 8 tasks (T007-T014)
- **US2 (Backend Imports)**: ✅ 0 tasks (solved by Phase 2)
- **US3 (Database Connection)**: ✅ 0 tasks (already correct)

**Parallel Opportunities**:
- Phase 1: 3 tasks can run in parallel
- Phase 6: 2 tasks can run in parallel

**Success Metrics (per spec.md)**:
- ✅ SC-001: GitHub Actions E2E workflow green
- ✅ SC-002: Backend startup <30s
- ✅ SC-003: Health endpoint <60s response
- ✅ SC-004: 100% E2E tests execute
- ✅ SC-005: Workflow <5min total
- ✅ SC-006: Zero import errors

**Format Validation**: ✅ All tasks follow `- [ ] [ID] [P?] [Story] Description with file path` format

---

## Notes

- This is a **bug fix**, not new feature development - minimal code changes
- **Root cause**: `poetry install --no-root` prevents package installation
- **Fix**: Remove `--no-root` flag from 3 lines in `.github/workflows/ci.yml`
- **Validation**: GitHub Actions E2E workflow green status = success
- US2 and US3 require no additional work (solved by same fix or already correct)
- Follow quickstart.md for local validation before pushing
- Commit message: `fix: Remove --no-root from poetry install in CI workflows`
