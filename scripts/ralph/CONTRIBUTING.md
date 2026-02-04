# Contributing to Impetus Lock

Thank you for your interest in contributing to Impetus Lock! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Constitutional Requirements](#constitutional-requirements)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

- Be respectful and constructive in all interactions
- Welcome new contributors and help them learn
- Focus on what is best for the project and community
- Show empathy towards other contributors

## Getting Started

### Prerequisites

- **Python 3.11+** with [Poetry](https://python-poetry.org/)
- **Node.js 20+** (LTS)
- **Git**
- **Docker** (optional, for local CI testing with [Act](https://github.com/neektos/act))

### Environment Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/impetus-lock.git
   cd impetus-lock
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/impetus-lock.git
   ```

#### Backend Setup

```bash
cd server

# Install dependencies with Poetry
poetry install

# Set up environment variables
cp .env.example .env
# Edit .env and add your LLM API key (e.g., OPENAI_API_KEY)

# Run development server
poetry run uvicorn server.main:app --reload
```

#### Frontend Setup

```bash
cd client

# Install dependencies
npm ci

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Follow [Conventional Commits](https://www.conventionalcommits.org/) naming:
- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 2. Test-Driven Development (TDD)

This project follows **TDD as a non-negotiable practice**:

```bash
# Backend TDD cycle
cd server
# 1. Write failing test
# 2. Verify test fails
poetry run pytest tests/test_your_feature.py
# 3. Write minimal implementation
# 4. Verify test passes
poetry run pytest tests/test_your_feature.py
# 5. Refactor (keep tests green)

# Frontend TDD cycle
cd client
npm run test:watch  # Watch mode for Red-Green-Refactor
```

### 3. Quality Checks

Before committing, ensure all quality checks pass:

```bash
# Backend
cd server
poetry run ruff check .              # Lint
poetry run ruff format .             # Format
poetry run mypy .                    # Type check
poetry run pytest                    # Tests

# Frontend
cd client
npm run lint                         # ESLint
npm run format                       # Prettier
npm run type-check                   # TypeScript
npm run test                         # Vitest
```

### 4. Local CI Testing (Recommended)

Use [Act CLI](https://github.com/neektos/act) to test GitHub Actions workflows locally:

```bash
# Install Act CLI
# macOS: brew install act
# Windows: choco install act-cli
# Linux: curl https://raw.githubusercontent.com/neektos/act/master/install.sh | sudo bash

# Run all CI jobs
act

# Run specific job
act -j lint
act -j type-check
act -j backend-tests
act -j frontend-tests
```

---

## Constitutional Requirements

This project operates under 5 constitutional articles that all contributions must follow:

### Article I: Simplicity & Anti-Abstraction

- This is a **5-day MVP sprint** — over-engineering is prohibited
- Use framework-native features over custom implementations
- Choose the simplest viable implementation path
- No unnecessary wrapper classes or abstraction layers

### Article II: Vibe-First Imperative

- **P1 priority is RESERVED ONLY for un-deletable constraint implementation**
- All other features (UI polish, auxiliary functions) MUST be P2 or lower
- P1 tasks MUST represent >=60% of story points

### Article III: Test-First Imperative (TDD - NON-NEGOTIABLE)

- Follow the **Red-Green-Refactor cycle**:
  1. Write a failing test
  2. Verify test failure
  3. Write minimal implementation to pass test
  4. Refactor only after green tests
- Test tasks MUST be created for ALL P1 user stories BEFORE implementation
- >=80% test coverage required for critical paths (un-deletable logic, lock enforcement)

### Article IV: SOLID Principles

- **SRP (Single Responsibility)**: FastAPI endpoints MUST delegate business logic to service layer classes
- **DIP (Dependency Inversion)**: High-level logic MUST depend on abstractions (protocols/interfaces), not concrete implementations

### Article V: Clear Comments & Documentation

- **Frontend**: JSDoc comments required for all exported functions/components
- **Backend**: Python docstrings (Google/NumPy style) required for all public functions/classes

---

## Code Standards

### Backend (Python)

```python
# CORRECT: Endpoint delegates to service layer
@app.post("/tasks")
def create_task(
    task: TaskCreate,
    service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """Create a new task.

    Args:
        task: Task creation payload
        service: Task service instance (injected)

    Returns:
        Created task response
    """
    return service.create_task(task)

# WRONG: Business logic in endpoint (violates SRP)
@app.post("/tasks")
def create_task(task: TaskCreate):
    # Direct database access - FORBIDDEN
    db_task = Task(**task.dict())
    session.add(db_task)
    session.commit()
    return db_task
```

**Requirements:**
- Ruff linting (line-length=100)
- mypy strict mode type checking
- Pydantic v2 for data validation
- Google/NumPy style docstrings

### Frontend (TypeScript + React)

```typescript
// CORRECT: Component uses hook abstraction
import { useManualTrigger } from "../../hooks/useManualTrigger";

export function TriggerButton() {
  const { trigger, isLoading } = useManualTrigger();
  return <button onClick={trigger}>Provoke</button>;
}

// WRONG: Direct service import in component
import { interventionClient } from "../../services/api/interventionClient";

export function TriggerButton() {
  // Components cannot import from services
  const handleClick = async () => {
    await interventionClient.provoke({ mode: "muse" });
  };
  return <button onClick={handleClick}>Provoke</button>;
}
```

**Requirements:**
- TypeScript strict mode
- ESLint with `@typescript-eslint/no-explicit-any = error`
- JSDoc for all exported functions/components
- Components -> Hooks -> Services architecture (enforced by ESLint)

---

## Testing Requirements

### Backend (pytest)

```bash
cd server

# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=server --cov-report=html

# Run specific test
poetry run pytest tests/test_main.py::test_health_endpoint_returns_200
```

**Requirements:**
- Tests MUST be in `tests/` directory
- Test files prefixed with `test_`
- Test naming: `test_<function>_<scenario>`
- Fixtures defined in `conftest.py` and reused

### Frontend (Vitest + Playwright)

```bash
cd client

# Unit tests (Vitest)
npm run test              # Run once
npm run test:watch        # Watch mode for TDD

# E2E tests (Playwright)
npm run test:e2e

# Interactive E2E debugging
npx playwright test --ui
```

**Requirements:**
- Unit tests: `src/**/*.test.tsx`
- E2E tests: `e2e/*.spec.ts`
- Use `@testing-library/react` for component testing
- Use QueryClient wrapper for React Query hook tests

---

## Submitting Changes

### 1. Commit Your Changes

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```bash
git add .
git commit -m "feat: add task list component with filtering"
```

### 2. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 3. Create a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out the PR template (see `.github/PULL_REQUEST_TEMPLATE.md`)
5. Include:
   - Description of changes
   - Related issue numbers
   - Testing steps
   - Constitutional compliance checklist

### 4. CI Checks

Your PR must pass all CI checks:
- **lint**: Ruff (backend) + ESLint/Prettier (frontend)
- **type-check**: mypy (backend) + tsc (frontend)
- **backend-tests**: pytest
- **frontend-tests**: Vitest + Playwright

### 5. Code Review

- Address reviewer feedback promptly
- Keep discussions constructive and focused
- All constitutional requirements must be met before merge

---

## Reporting Issues

### Bug Reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- **Description**: Clear description of the bug
- **Steps to reproduce**: Minimal reproduction steps
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, browser, Python/Node versions
- **Logs**: Relevant error messages or stack traces

### Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- **Problem statement**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other approaches did you consider?
- **Priority assessment**: Is this P1 (un-deletable constraint) or P2/P3?

### Questions

For questions, please use [GitHub Discussions](https://github.com/YOUR_USERNAME/impetus-lock/discussions) rather than issues.

---

## Additional Resources

- [CLAUDE.md](CLAUDE.md) - AI assistant development guide
- [README.md](README.md) - Project overview and quickstart
- [API_CONTRACT.md](API_CONTRACT.md) - OpenAPI specification
- [ARCHITECTURE_GUARDS.md](ARCHITECTURE_GUARDS.md) - Architecture patterns
- [DEVELOPMENT.md](DEVELOPMENT.md) - Comprehensive development guide
- [TESTING.md](TESTING.md) - Testing strategy and guidelines

---

## License

By contributing to Impetus Lock, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

**Thank you for contributing to Impetus Lock!**
