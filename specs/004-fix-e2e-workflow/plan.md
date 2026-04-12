# Implementation Plan: E2E Workflow Backend Import Fix

**Branch**: `004-fix-e2e-workflow` | **Date**: 2025-11-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-fix-e2e-workflow/spec.md`

## Summary

Fix the E2E workflow GitHub Actions failure caused by backend server failing to start. The root cause is that Poetry virtualenv cannot import the `server` module when running `uvicorn server.main:app` in the CI container environment. This blocks all integration testing and prevents automated validation that frontend and backend work together correctly.

**Technical Approach**: Fix Poetry package configuration, ensure backend server starts successfully in GitHub Actions Playwright container, and verify PostgreSQL service container connectivity.

## Technical Context

**Language/Version**: Python 3.11 (backend), Node.js LTS (frontend), GitHub Actions Ubuntu runner  
**Primary Dependencies**: Poetry 1.8+, FastAPI 0.115+, Uvicorn 0.32+, Playwright 1.56.1, PostgreSQL 16  
**Storage**: PostgreSQL 16 service container (postgresql://postgres:postgres@postgres:5432/impetus_lock_test)  
**Testing**: Playwright E2E tests, pytest (backend unit tests - not modified in this fix)  
**Target Platform**: GitHub Actions (ubuntu-latest runner, mcr.microsoft.com/playwright:v1.56.1-noble Docker container)  
**Project Type**: Web (monorepo with client/ and server/ directories, independent lock files)  
**Performance Goals**: Backend startup <30s, health check response <60s, total E2E workflow <5 minutes  
**Constraints**: Must run as user 1001 in Playwright container, PostgreSQL in separate service container network, Poetry virtualenv isolation  
**Scale/Scope**: Single E2E workflow fix, no code changes to backend/frontend source, CI-only modification

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Simplicity & Anti-Abstraction
- [x] Framework-native features prioritized over custom implementations (using Poetry's built-in package installation, GitHub Actions service containers)
- [x] Simplest viable implementation path chosen (fixing pyproject.toml configuration, not creating wrapper scripts)
- [x] No unnecessary wrapper classes or abstraction layers (direct Poetry + uvicorn commands)
- [x] Any abstractions justified by actual (not anticipated) multi-implementation scenarios (N/A - this is a bug fix)

**Justification**: This fix uses Poetry's native `packages` field and GitHub Actions service containers as designed. No custom abstractions introduced.

### Article II: Vibe-First Imperative
- [x] Un-deletable constraint is P1 priority (only this feature is P1)
- [x] All other features (UI polish, auxiliary functions) marked P2 or lower
- [x] P1 tasks scheduled for wave 1 implementation
- [x] P1 tasks represent ≥60% of story points

**Justification**: This is a **bug fix enabling P1 feature testing**, not a new feature. User Stories 1-2 are P1 because they unblock E2E testing of the un-deletable lock (P1 feature from Phase 5). User Story 3 (database connectivity) is P2 as it's not required for basic server startup validation.

### Article III: Test-First Imperative (NON-NEGOTIABLE)
- [x] Test tasks created for ALL P1 user stories BEFORE implementation tasks
- [x] TDD workflow enforced: failing test → verify failure → minimal implementation → refactor
- [x] Test coverage ≥80% for critical paths (un-deletable logic, lock enforcement)
- [x] P1 features have corresponding test files

**Justification**: This is an **infrastructure fix**, not feature code. Validation is through **GitHub Actions workflow execution** (the test IS the workflow running successfully). Existing E2E tests provide coverage once backend starts.

### Article IV: SOLID Principles
- [x] **SRP**: FastAPI endpoints delegate business logic to service layer classes
- [x] **DIP**: High-level logic depends on abstractions (protocols/interfaces), not concrete implementations
- [x] No endpoint handlers contain raw SQL or business rules
- [x] Service classes use constructor injection (no direct instantiation of infrastructure dependencies)

**Justification**: **Not applicable** - this fix modifies `.github/workflows/e2e.yml` and `server/pyproject.toml` only. No backend code changes. Existing backend already complies with SOLID (validated in Phase 5).

### Article V: Clear Comments & Documentation
- [x] **Frontend**: JSDoc comments for all exported functions/components
- [x] **Backend**: Python docstrings (Google/NumPy style) for all public functions/classes
- [x] Documentation present for all public interfaces
- [x] Missing documentation flagged as blocking if on critical path

**Justification**: **Not applicable** - no new code written. Workflow YAML changes are self-documenting via step names and comments where configuration is non-obvious.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-e2e-workflow/
├── plan.md              # This file
├── research.md          # Phase 0 output (Poetry package config, container networking, health check patterns)
├── data-model.md        # N/A (bug fix, no data model changes)
├── quickstart.md        # Phase 1 output (how to validate E2E workflow locally with Act CLI)
├── contracts/           # N/A (no API changes)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
.github/workflows/
└── e2e.yml              # MODIFIED - Fix Poetry install, backend startup, health check polling

server/
├── pyproject.toml       # VERIFIED - Already has packages = [{include = "server"}]
├── README.md            # VERIFIED - Already exists
└── server/
    └── main.py          # NOT MODIFIED - Already working, import issue is CI-only

client/
└── e2e/                 # NOT MODIFIED - Tests already written, waiting for backend to start
    └── *.spec.ts
```

**Structure Decision**: Monorepo with independent client/ and server/ directories (existing). This fix targets only `.github/workflows/e2e.yml` workflow configuration. No changes to source code structure.

## Complexity Tracking

**No Constitution violations detected.**

All gates passed cleanly:
- Article I: Using framework-native features (Poetry, GitHub Actions service containers)
- Article II: Bug fix enabling P1 feature testing (unblocking un-deletable lock E2E validation)
- Article III: Workflow execution IS the test (pass = backend starts + E2E tests run)
- Article IV: Not applicable (no backend code changes)
- Article V: Not applicable (workflow changes are self-documenting)

## Phase 0: Research Plan

**Unknowns to Resolve**:

1. **Poetry Package Import in CI** - Why does `poetry install` succeed but `poetry run uvicorn server.main:app` fail with "Could not import module 'server.main'"?
   - Research: Poetry package installation mechanics, PYTHONPATH in virtualenv, --no-root vs package install
   - Decision needed: Correct pyproject.toml configuration for package imports

2. **Container Networking** - How do service containers communicate in GitHub Actions when using container: directive?
   - Research: Docker container-to-container networking, hostname resolution (postgres:5432 vs localhost:5432)
   - Decision needed: Correct DATABASE_URL format for service container access

3. **Health Check Reliability** - What retry parameters ensure backend is ready without timing out?
   - Research: FastAPI startup time, Uvicorn binding delays, best practices for polling loops
   - Decision needed: Polling interval, timeout threshold, failure handling

4. **Act CLI Validation** - How to test workflow changes locally before pushing to avoid 10+ failed commits?
   - Research: Act CLI usage patterns, Docker image selection, service container support
   - Decision needed: Act CLI commands for E2E workflow validation

**Output**: `research.md` with decisions and rationale for each unknown

## Phase 1: Design Artifacts

### Data Model
**Not applicable** - This is a CI workflow fix. No database schema or entity changes.

### API Contracts
**Not applicable** - No API endpoint changes. Backend health endpoint already exists at `/health`.

### Agent Context Update
Required after research phase:
- Add: GitHub Actions service container patterns
- Add: Poetry package installation troubleshooting
- Add: Act CLI workflow validation workflow
- Preserve: Existing Phase 5 context (AI intervention, lock enforcement)

### Quickstart Guide
**Required**: Document how developers should validate E2E workflow changes locally using Act CLI to prevent future "10 failed commits" scenarios.

**Content**:
- Prerequisites: Docker, Act CLI installation
- Commands: `act -j e2e` for local E2E workflow execution
- Debugging: Container logs, health check verification
- Common issues: Service container networking, Playwright browser installation

## Phase 2: Task Breakdown

**Deferred to `/speckit.tasks` command** - Not created by `/speckit.plan`.

## Next Steps

1. ✅ Phase 0: Generate `research.md` resolving all unknowns
2. ✅ Phase 1: Generate `quickstart.md` (Act CLI validation guide)
3. ✅ Phase 1: Update agent context (`.claude/CLAUDE.md` or agent-specific file)
4. ⏳ Phase 2: Run `/speckit.tasks` to generate implementation tasks
