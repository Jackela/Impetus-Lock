# Feature Specification: E2E Workflow Backend Import Fix

**Feature Branch**: `004-fix-e2e-workflow`  
**Created**: 2025-11-08  
**Status**: Draft  
**Input**: User description: "fix the issues"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - E2E Tests Execute Successfully in CI (Priority: P1)

Developers need end-to-end tests to validate the entire system (frontend + backend) works together correctly. Currently, E2E tests fail in GitHub Actions because the backend server cannot start, blocking all integration testing and preventing developers from verifying their changes don't break the system.

**Why this priority**: Without working E2E tests, there is no automated validation that frontend and backend integrate correctly. This creates high risk of shipping broken integrations to production. P1 because it blocks critical quality assurance.

**Independent Test**: Can be fully tested by triggering GitHub Actions E2E workflow and verifying all Playwright tests execute and pass.

**Acceptance Scenarios**:

1. **Given** code is pushed to main branch, **When** GitHub Actions E2E workflow runs, **Then** backend server starts successfully within 30 seconds
2. **Given** backend server is running in CI, **When** Playwright attempts to connect to http://localhost:8000, **Then** connection succeeds and health endpoint returns 200 OK
3. **Given** E2E workflow completes, **When** viewing GitHub Actions results, **Then** all jobs show green (success) status with no red failures

---

### User Story 2 - Backend Module Imports Work in Poetry Virtualenv (Priority: P1)

The backend server relies on Poetry for dependency management and package installation. Currently, the `server` package cannot be imported when running `uvicorn server.main:app` inside Poetry's virtualenv, causing "Could not import module 'server.main'" errors.

**Why this priority**: Backend server startup is completely broken in CI environment. Without a working backend, no E2E tests can run. P1 because it's the root cause blocking all E2E testing.

**Independent Test**: Can be tested by running `poetry install` and `poetry run uvicorn server.main:app` in the GitHub Actions container environment and verifying the server starts without import errors.

**Acceptance Scenarios**:

1. **Given** Poetry dependencies are installed via `poetry install`, **When** running `poetry run uvicorn server.main:app`, **Then** server starts without "Could not import module" errors
2. **Given** server package is installed, **When** Poetry virtualenv activates, **Then** `server` module is available in Python import path
3. **Given** pyproject.toml is configured, **When** running poetry commands, **Then** package installation completes without missing file/folder errors

---

### User Story 3 - Database Connection Available for Tests (Priority: P2)

E2E tests need to interact with a real database to validate data persistence and backend functionality. The PostgreSQL service container must be accessible from the backend server running in the Playwright container.

**Why this priority**: P2 because backend startup (P1) must work first, but database connectivity is essential for most E2E tests to be meaningful.

**Independent Test**: Can be tested by verifying backend can connect to PostgreSQL service container at postgres:5432 and execute queries.

**Acceptance Scenarios**:

1. **Given** PostgreSQL service container is running, **When** backend server starts with DATABASE_URL=postgresql://postgres:postgres@postgres:5432/impetus_lock_test, **Then** database connection succeeds
2. **Given** database is accessible, **When** E2E tests create/read/update data, **Then** operations complete successfully without connection errors

---

### Edge Cases

- What happens when Poetry cache is stale or corrupted? (Should rebuild from lock file)
- How does system handle network timeouts connecting to PostgreSQL? (Should retry with exponential backoff)
- What if pyproject.toml is misconfigured (missing packages field)? (Should fail fast with clear error message)
- How does backend behave if uvicorn starts but database is unavailable? (Should log error and health check should reflect unhealthy state)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: E2E workflow MUST install Poetry in GitHub Actions Playwright container environment
- **FR-002**: Poetry MUST install all backend dependencies from poetry.lock file reproducibly
- **FR-003**: Backend server package (`server`) MUST be importable from Poetry virtualenv
- **FR-004**: Backend server MUST start via `poetry run uvicorn server.main:app` without module import errors
- **FR-005**: Backend server MUST bind to 0.0.0.0:8000 and respond to health check requests
- **FR-006**: PostgreSQL service container MUST be accessible at postgres:5432 from backend server
- **FR-007**: E2E workflow MUST wait for backend health endpoint (/health) to return 200 OK before running tests
- **FR-008**: E2E workflow MUST fail fast with clear error messages if backend fails to start
- **FR-009**: Backend server MUST run with TESTING=true environment variable to enable test endpoints
- **FR-010**: All E2E tests MUST execute against running backend server at http://localhost:8000

### Key Entities *(include if feature involves data)*

- **Backend Server**: FastAPI application serving REST API endpoints, must be started in CI environment
- **Poetry Package**: Python package manager handling dependency installation and virtualenv management
- **Service Container**: PostgreSQL database running in GitHub Actions service container network
- **Health Endpoint**: HTTP endpoint at /health returning service status for readiness checks

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: GitHub Actions E2E workflow completes successfully with all tests passing (green status, no failures)
- **SC-002**: Backend server starts within 30 seconds of Poetry installation completing
- **SC-003**: Health endpoint responds with 200 OK status within 60 seconds of uvicorn command execution
- **SC-004**: 100% of Playwright E2E tests execute (not skipped due to backend unavailability)
- **SC-005**: E2E workflow execution time remains under 5 minutes total (including backend startup)
- **SC-006**: Zero import errors appear in backend server startup logs

## Scope *(mandatory)*

### In Scope

- Fix Poetry package installation configuration (pyproject.toml packages field)
- Ensure `server` module is properly installed and importable
- Configure backend server startup in E2E workflow
- Add health check polling with timeout
- Verify PostgreSQL service container networking
- Update E2E workflow YAML configuration

### Out of Scope

- Backend code changes (server code is working, only CI environment is broken)
- Frontend code changes (frontend tests are not failing)
- New test creation (existing tests are sufficient once backend starts)
- Performance optimization of E2E tests
- Local development environment fixes (issue is CI-specific)

## Assumptions *(mandatory)*

- Poetry lock file (poetry.lock) is valid and up-to-date
- Backend code runs successfully when tested locally outside CI
- Playwright container image has Python 3.11+ available
- GitHub Actions runner has sufficient resources to run PostgreSQL + backend + frontend
- pyproject.toml missing `packages` field was root cause of import failures
- Backend requires `server` package installed (not just dependencies)

## Dependencies *(mandatory)*

### Technical Dependencies

- GitHub Actions runner (ubuntu-latest)
- Docker (for Playwright and PostgreSQL containers)
- Python 3.11+ (setup-python@v5 action)
- Poetry (installed via pip in workflow)
- PostgreSQL 16 (service container)
- Node.js LTS (for frontend)

### Blocking Dependencies

- None (this is a blocker for other work, not blocked by anything)

### Related Work

- Phase 5 completion (003-vibe-completion) - E2E tests were written but never verified in CI
- CI workflow already passing (lint, type-check jobs work correctly)
