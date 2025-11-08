# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Impetus Lock** is a 5-day MVP sprint project building an un-deletable task pressure system using a monorepo architecture:
- **Frontend**: React + Vite + TypeScript (strict mode) with Framer Motion for animations and Milkdown for rich text
- **Backend**: FastAPI + Python 3.11+ with strict type checking (mypy) and Pydantic v2
- **Testing**: Vitest + Playwright (frontend), pytest + httpx (backend)

## Constitutional Requirements ⚖️

**CRITICAL**: This project follows strict constitutional principles defined in `.specify/memory/constitution.md` (v1.0.0). These are NON-NEGOTIABLE:

### Article I: Simplicity & Anti-Abstraction
- This is a **5-day MVP sprint** — over-engineering is strictly prohibited
- MUST use framework-native features over custom implementations
- MUST choose the simplest viable implementation path
- NO unnecessary wrapper classes or abstraction layers unless justified by actual (not anticipated) multi-implementation scenarios

### Article II: Vibe-First Imperative
- **P1 priority is RESERVED ONLY for un-deletable constraint implementation**
- All other features (UI polish, auxiliary functions) MUST be P2 or lower
- P1 tasks MUST represent ≥60% of story points and be scheduled for wave 1

### Article III: Test-First Imperative (TDD - NON-NEGOTIABLE)
- **Red-Green-Refactor cycle MUST be followed**:
  1. Write a failing test
  2. Verify test failure
  3. Write minimal implementation to pass test
  4. Refactor only after green tests
- Test tasks MUST be created for ALL P1 user stories BEFORE implementation tasks
- CI MUST block merges if:
  - P1 features lack corresponding test files
  - Test coverage falls below 80% for critical paths (un-deletable logic, lock enforcement)

### Article IV: SOLID Principles
- **SRP (Single Responsibility)**: FastAPI endpoints MUST delegate business logic to service layer classes
- **DIP (Dependency Inversion)**: High-level logic MUST depend on abstractions (protocols/interfaces), not concrete implementations
- Code review MUST reject:
  - Endpoint handlers containing raw SQL or business rules
  - Service classes directly instantiating infrastructure dependencies (must use constructor injection)

### Article V: Clear Comments & Documentation
- **Frontend**: JSDoc comments required for all exported functions/components
- **Backend**: Python docstrings (Google/NumPy style) required for all public functions/classes
- Missing documentation on critical paths blocks merge
- Linters enforce documentation presence (ESLint + `jsdoc` plugin, `pydocstyle`)

## Monorepo Structure

```
.
├── client/          # React + Vite + TypeScript frontend
│   ├── src/         # Application source code
│   ├── e2e/         # Playwright E2E tests
│   ├── package.json # Frontend dependencies (independent lock file)
│   └── vite.config.ts
├── server/          # FastAPI + Python backend
│   ├── server/      # Application code
│   ├── tests/       # pytest tests
│   └── pyproject.toml # Poetry configuration (independent lock file)
├── .github/
│   └── workflows/
│       └── ci.yml   # Separated jobs: lint, type-check, backend-tests, frontend-tests
└── .specify/
    ├── memory/
    │   └── constitution.md  # Project constitution (v1.0.0)
    └── templates/
        ├── plan-template.md
        ├── spec-template.md
        └── tasks-template.md
```

**Key Principle**: Frontend and backend have independent lock files and scripts. Root directory contains only CI and shared documentation.

## Local CI Validation (Act CLI)

**The ONLY recommended way to validate locally before pushing:**

```bash
# Test entire CI pipeline (all 4 jobs)
act

# Test specific job
act -j lint                # Linting only
act -j type-check          # Type checking only
act -j backend-tests       # Backend tests only
act -j frontend-tests      # Frontend tests only

# List available jobs
act -l

# Dry run (see what would execute)
act -n

# Use specific Docker image
act -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Why Act CLI instead of shell scripts?**
- ✅ Uses Docker to simulate exact GitHub Actions environment
- ✅ 100% consistent with CI (same image, same steps)
- ✅ No hanging issues (containerized isolation)
- ✅ Can test individual jobs quickly
- ✅ Works identically on Windows/macOS/Linux

**Configuration:** `.actrc` is pre-configured for optimal performance.

**Quick Quality Check (without full CI):**

```bash
# Backend (lint + type-check only, fast)
cd server && poetry run ruff check . && poetry run mypy .

# Frontend (lint + type-check only, fast)
cd client && npm run lint && npm run type-check
```

## Development Commands

### Backend (FastAPI + Poetry)

All backend commands MUST be run from the `server/` directory:

```bash
cd server

# Setup (first time)
pipx install poetry
poetry install --no-root

# Development server
poetry run uvicorn server.main:app --reload

# Testing (TDD workflow - MANDATORY)
poetry run pytest                    # Run all tests
poetry run pytest tests/test_main.py # Run specific test file
poetry run pytest -k test_health     # Run specific test by name
poetry run pytest -v                 # Verbose output
poetry run pytest --cov              # With coverage report

# Linting & Formatting (Ruff)
poetry run ruff check .              # Lint
poetry run ruff format .             # Format
poetry run ruff check --fix .        # Auto-fix linting issues

# Type Checking (mypy strict mode - MANDATORY)
poetry run mypy .                    # Type check all files
poetry run mypy server/main.py       # Type check specific file
```

**Backend Quality Gates**:
- Ruff: line-length=100, select=["E","F","I","UP","B","A","T20","SIM"]
- mypy: strict mode (disallow_untyped_defs, no_implicit_optional, etc.)
- pytest: tests MUST be in `tests/` directory, files prefixed with `test_`

### Frontend (React + Vite + TypeScript)

All frontend commands MUST be run from the `client/` directory:

```bash
cd client

# Setup (first time)
npm ci  # Use ci for reproducible builds (locks to package-lock.json)

# Development server
npm run dev

# Testing (TDD workflow - MANDATORY)
npm run test              # Run Vitest unit tests
npm run test:watch        # Watch mode for TDD Red-Green-Refactor
npm run test:e2e          # Run Playwright E2E tests
npx vitest run src/App.test.tsx  # Run specific test file

# Linting, Formatting, Type Checking
npm run lint              # ESLint (max-warnings=0)
npm run format            # Prettier check
npm run type-check        # TypeScript (tsc --noEmit)

# Build
npm run build             # Production build
npm run preview           # Preview production build
```

**Frontend Quality Gates**:
- TypeScript: strict mode (noUncheckedIndexedAccess, noImplicitOverride, etc.)
- ESLint: @typescript-eslint/no-explicit-any = error
- Vitest: environment=jsdom, setupFiles=./vitest.setup.ts
- Playwright: baseURL=http://localhost:5173

### CI Workflow

GitHub Actions runs 4 parallel jobs on push/PR to `main`:

1. **lint**: Ruff (backend) + ESLint/Prettier (frontend)
2. **type-check**: mypy (backend) + tsc --noEmit (frontend)
3. **backend-tests**: pytest
4. **frontend-tests**: Vitest + Playwright (with browser installation)

**Caching**: Python (Poetry) and Node (npm) dependencies are cached. Playwright browsers installed on-demand.

## Architecture Patterns

### Backend: Service Layer Pattern (SOLID Compliance)

**MUST follow this structure** to comply with Article IV (SRP + DIP):

```python
# ❌ WRONG: Endpoint contains business logic (violates SRP)
@app.post("/tasks")
def create_task(task: TaskCreate):
    # Direct database access in endpoint - FORBIDDEN
    db_task = Task(**task.dict())
    session.add(db_task)
    session.commit()
    return db_task

# ✅ CORRECT: Endpoint delegates to service layer
@app.post("/tasks")
def create_task(
    task: TaskCreate,
    service: TaskService = Depends(get_task_service)  # DIP: depend on abstraction
) -> TaskResponse:
    """Create a new task.
    
    Args:
        task: Task creation payload
        service: Task service instance (injected)
        
    Returns:
        Created task response
    """
    return service.create_task(task)

# Service layer (business logic)
class TaskService:
    def __init__(self, repository: TaskRepositoryProtocol):  # DIP: protocol, not concrete
        self._repository = repository
    
    def create_task(self, task: TaskCreate) -> TaskResponse:
        """Business logic for task creation."""
        # Validation, business rules here
        return self._repository.save(task)
```

### Frontend: Component + Service Pattern

**Recommended structure** (but simplicity per Article I takes precedence):

```typescript
// Components: UI logic only
export function TaskList() {
  const { data, error } = useTasksQuery(); // Service layer handles API
  
  if (error) return <ErrorBoundary error={error} />;
  return <div>{/* Render tasks */}</div>;
}

// Services: API communication (can use openapi-typescript-codegen)
export async function fetchTasks(): Promise<Task[]> {
  const response = await fetch('/api/tasks');
  if (!response.ok) throw new Error('Failed to fetch tasks');
  return response.json();
}
```

## Testing Strategy

### TDD Red-Green-Refactor Workflow (Article III)

**MANDATORY for all P1 features**:

```bash
# 1. RED: Write failing test first
cd server
poetry run pytest tests/test_task_lock.py  # Should fail

# 2. GREEN: Write minimal implementation
# Edit server/services/task_service.py
poetry run pytest tests/test_task_lock.py  # Should pass

# 3. REFACTOR: Improve code while keeping tests green
poetry run pytest tests/test_task_lock.py  # Still passes
```

### Test Organization

**Backend** (pytest):
- `tests/test_main.py`: API contract tests (FastAPI TestClient)
- `tests/test_services.py`: Service layer unit tests
- Fixtures MUST be reused (define in `conftest.py`)
- Test naming: `test_<function>_<scenario>` (e.g., `test_create_task_locks_deletion`)

**Frontend** (Vitest + Playwright):
- `src/**/*.test.tsx`: Component unit tests (Vitest + @testing-library/react)
- `e2e/*.spec.ts`: End-to-end user journeys (Playwright)
- Setup: `vitest.setup.ts` imports `@testing-library/jest-dom`

### Coverage Requirements

- **Critical paths** (un-deletable logic, lock enforcement): **≥80% coverage MANDATORY**
- Non-critical features: Best effort, not blocking

## Security & Environment

- **NEVER commit secrets** (.env files in .gitignore)
- Use `.env.example` to document required environment variables
- CI injects secrets via GitHub Secrets
- Dependencies use lock files (poetry.lock, package-lock.json)

## Git Workflow

- **Conventional Commits** format (e.g., `feat:`, `fix:`, `docs:`, `test:`)
- Small, frequent PRs with screenshots or logs for UI changes
- All PRs must pass CI (lint, type-check, tests) before merge

## Speckit Templates

Feature development follows `.specify/templates/`:
- **plan-template.md**: Implementation plan with Constitution Check
- **spec-template.md**: Feature specification with P1/P2 prioritization
- **tasks-template.md**: Task list with TDD requirements

**Constitutional gates are embedded in templates** — follow them strictly.

## Common Pitfalls to Avoid

❌ Creating abstractions without actual multi-implementation need (violates Article I)  
❌ Marking UI polish or auxiliary features as P1 (violates Article II - only un-deletable constraint is P1)  
❌ Writing implementation before tests (violates Article III - TDD is non-negotiable)  
❌ Putting business logic in API endpoints (violates Article IV - SRP)  
❌ Omitting JSDoc/docstrings for public interfaces (violates Article V)  
❌ Running commands from wrong directory (backend in server/, frontend in client/)  
❌ Using `npm install` instead of `npm ci` (breaks reproducibility)  
❌ Skipping type checks to save time (mypy strict + tsc strict are mandatory)

## Current Project Status (2025-11-08)

### ✅ PRODUCTION READY - Phase 6 Complete (P3 Vibe Completion)

**Test Status**:
- E2E: **17/17 passing** ✅
- Unit: **126/126 tests** (122 passing, 4 skipped) ✅
  - 4 skipped tests: Web Audio API tests require complex AudioContext mocking
- Lint: ✅ **0 errors** (Ruff + ESLint + Prettier)
- Type-check: ✅ **0 errors** (mypy strict + tsc strict)
- CI: ✅ **All jobs passing**
- Build: ✅ Ready

**Editor Implementation**:
- Currently using **EditorCore** (`client/src/components/Editor/EditorCore.tsx`)
- ✅ Full lock enforcement system active (P1)
- ✅ AI intervention system integrated (P2)
- ✅ Sensory feedback system integrated (P2+P3) ✅ **COMPLETE**
- ✅ React 19 + Milkdown compatibility fixed

**Active Features - P1 (Lock Enforcement)**:
- ✅ Un-deletable content blocks
- ✅ Transaction filtering with lock enforcement
- ✅ Lock ID extraction from Markdown
- ✅ Lock state management
- ✅ **API error feedback (red flash + buzz sound)** ✅ **NEW P3**

**Active Features - P2 (AI Intervention) - COMPLETE**:
- ✅ Muse mode (STUCK state detection)
- ✅ Loki mode (random chaos timer)
- ✅ Manual trigger button with immediate feedback
- ✅ Sensory feedback (Glitch animation on Provoke)
- ✅ Mode selector (Off/Muse/Loki)
- ✅ State management (App-level trigger coordination)

**Active Features - P3 (Vibe Completion) - COMPLETE** ✅ **NEW**:
- ✅ **US3 (P1): API Error Feedback** - Red flash + buzz sound for network/API failures
- ✅ **US4 (P2): Animation Queue Management** - Cancel-and-replace for clean animations
- ✅ **US2 (P2): Lock Rejection Feedback** - Shake animation + bonk sound
- ✅ **US1 (P2): Delete Feedback** - Fade-out animation + whoosh sound (dev button)

**Technical Debt**:
- [x] ~~Debug EditorCore React 19 + Milkdown v7 compatibility~~ **FIXED**
- [x] ~~Test timeout issues~~ **FIXED**
- [x] ~~File naming cleanup~~ **COMPLETE**
- [x] ~~Manual trigger integration~~ **COMPLETE**
- [x] ~~Sensory feedback trigger~~ **COMPLETE**
- [x] ~~P3 Vibe Completion implementation~~ **COMPLETE**
- [x] ~~P3 Validation (lint, type-check, format)~~ **COMPLETE** ✅ **NEW**
- [ ] ESLint ignore warning (migrate to `ignores` property)
- [ ] Playwright webServer timeout investigation (Windows-specific)
- [ ] Vitest hanging process cleanup (Windows Git Bash limitation)

**Documentation**: 
- See `specs/003-vibe-completion/` for P3 implementation details
- See `PHASE5_COMPLETE.md` for Phase 5 integration
- See `PHASE3_COMPLETE.md` for React 19 fixes
