# Development Guide

**Impetus Lock** - Development workflow and testing guide for TDD with monorepo structure.

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [CI/CD Validation](#cicd-validation)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- **Python 3.11+** with Poetry
- **Node.js LTS** (20+)
- **Git**
- **Act CLI** (optional, for local CI testing)

### Initial Setup

```bash
# Clone and navigate to project
git clone <repo-url>
cd Impetus-Lock

# Backend setup
cd server
poetry install --no-root
cd ..

# Frontend setup
cd client
npm ci
cd ..
```

## Project Structure

```
Impetus-Lock/
├── server/              # FastAPI backend
│   ├── server/          # Application code
│   │   ├── __init__.py
│   │   └── main.py      # FastAPI app with health endpoint
│   ├── tests/           # pytest test suite
│   │   ├── __init__.py
│   │   └── test_main.py # Health endpoint tests
│   ├── pyproject.toml   # Poetry config + Ruff/mypy settings
│   └── .gitignore
│
├── client/              # React + Vite frontend
│   ├── src/             # React application code
│   ├── e2e/             # Playwright E2E tests
│   │   └── smoke.spec.ts
│   ├── package.json     # npm scripts + dependencies
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── .eslintrc.cjs
│   ├── .prettierrc
│   └── .gitignore
│
├── .github/
│   └── workflows/
│       └── ci.yml       # GitHub Actions CI (4 parallel jobs)
│
├── scripts/
│   ├── validate-local.sh      # Bash validation (Linux/macOS)
│   ├── validate-local.ps1     # PowerShell validation (Windows)
│   └── quick-validate.bat     # Windows fast check (skips tests)
│
├── .specify/            # Project templates and constitution
├── CLAUDE.md            # Claude Code operational guide
└── README.md
```

## Development Workflow

### Backend Development (TDD with FastAPI)

**Article III (TDD) - Red-Green-Refactor Cycle**:

```bash
cd server

# 1. RED: Write failing test first
# Edit tests/test_task_service.py
poetry run pytest tests/test_task_service.py -v
# Expected: FAILED (test should fail)

# 2. GREEN: Write minimal implementation
# Edit server/services/task_service.py
poetry run pytest tests/test_task_service.py -v
# Expected: PASSED

# 3. REFACTOR: Improve while keeping tests green
poetry run pytest tests/test_task_service.py -v
# Expected: PASSED
```

**Quality Gates (run before committing)**:

```bash
cd server

# Linting (auto-fix available)
poetry run ruff check .              # Check for issues
poetry run ruff check --fix .        # Auto-fix issues
poetry run ruff format .             # Format code

# Type checking (strict mode)
poetry run mypy .

# Tests (with coverage)
poetry run pytest -v
poetry run pytest --cov=server --cov-report=term-missing
```

**Development Server**:

```bash
cd server
poetry run uvicorn server.main:app --reload
# Server: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Frontend Development (TDD with React + Vitest)

**Article III (TDD) - Red-Green-Refactor Cycle**:

```bash
cd client

# 1. RED: Write failing test first
# Create src/components/TaskCard.test.tsx
npm run test:watch  # Vitest watch mode
# Expected: FAILED

# 2. GREEN: Write minimal implementation
# Create src/components/TaskCard.tsx
# Watch mode auto-reruns
# Expected: PASSED

# 3. REFACTOR: Improve while keeping tests green
# Watch mode continues to validate
# Expected: PASSED
```

**Quality Gates (run before committing)**:

```bash
cd client

# Linting (auto-fix available)
npm run lint                  # ESLint check
npx eslint --fix "src/**/*.{ts,tsx}"  # Auto-fix

# Formatting
npm run format                # Prettier check
npx prettier --write .        # Auto-format

# Type checking
npm run type-check            # tsc --noEmit (strict mode)

# Unit tests (Vitest)
npm run test                  # Run once
npm run test:watch            # Watch mode for TDD

# E2E tests (Playwright) - Run locally before pushing
npm run test:e2e              # Headless mode (CI-style)
npx playwright test --ui      # Interactive UI mode (recommended for development)
```

**Development Server**:

```bash
cd client
npm run dev
# Server: http://localhost:5173
```

## Testing Strategy

### Backend Testing (pytest + FastAPI TestClient)

**Test Structure**:

```python
# tests/test_main.py
from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)

def test_health_endpoint_returns_200() -> None:
    """Test that health endpoint returns successful status code."""
    response = client.get("/health")
    assert response.status_code == 200
```

**Running Tests**:

```bash
cd server

# Run all tests
poetry run pytest

# Run specific test file
poetry run pytest tests/test_main.py

# Run specific test
poetry run pytest tests/test_main.py::test_health_endpoint_returns_200

# Verbose output
poetry run pytest -v

# With coverage
poetry run pytest --cov=server --cov-report=html
# Open: htmlcov/index.html
```

### Frontend Testing (Vitest + Playwright)

**Unit Tests (Vitest + Testing Library)**:

```typescript
// src/components/TaskCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TaskCard } from "./TaskCard";

describe("TaskCard", () => {
  it("renders task title", () => {
    render(<TaskCard title="Test Task" />);
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });
});
```

**E2E Tests (Playwright)**:

```typescript
// e2e/task-flow.spec.ts
import { test, expect } from "@playwright/test";

test("user can create and lock task", async ({ page }) => {
  await page.goto("/");
  
  // Create task
  await page.fill('[data-testid="task-input"]', "Important Task");
  await page.click('[data-testid="create-button"]');
  
  // Lock task (P1 feature - un-deletable constraint)
  await page.click('[data-testid="lock-button"]');
  
  // Verify delete button is disabled
  await expect(page.locator('[data-testid="delete-button"]')).toBeDisabled();
});
```

**Running Frontend Tests**:

```bash
cd client

# Unit tests (Vitest)
npm run test              # Run once
npm run test:watch        # Watch mode for TDD
npm run test -- --ui      # UI mode
npm run test -- --coverage # With coverage

# E2E tests (Playwright)
npm run test:e2e          # Headless mode
npx playwright test --ui  # Interactive mode
npx playwright test --headed  # Show browser
npx playwright test --debug   # Debug mode

# Specific test file
npx playwright test e2e/smoke.spec.ts
```

## CI/CD Validation

### GitHub Actions Workflow

**Workflow Structure** (`.github/workflows/ci.yml`):

```yaml
jobs:
  lint:              # Ruff (backend) + ESLint/Prettier (frontend)
  type-check:        # mypy (backend) + tsc (frontend)
  backend-tests:     # pytest
  frontend-tests:    # Vitest + Playwright
```

**Triggers**:
- Push to `main`
- Pull requests to `main`

### Local CI Testing with Act

**Install Act CLI**:

```bash
# Windows (via Chocolatey)
choco install act-cli

# macOS (via Homebrew)
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**Run Full CI Pipeline Locally**:

```bash
# Run all jobs (simulates GitHub Actions)
act

# Run specific job
act -j lint
act -j type-check
act -j backend-tests
act -j frontend-tests

# List available workflows
act -l

# Dry run (show what would run)
act -n

# Use specific Docker image (Ubuntu 22.04)
act -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Act Configuration** (`.actrc`):

```ini
-P ubuntu-latest=catthehacker/ubuntu:act-latest
--container-architecture linux/amd64
```

**Expected Output**:

```
[CI/lint] 🚀  Start image=catthehacker/ubuntu:act-latest
[CI/lint]   🐳  docker pull image=catthehacker/ubuntu:act-latest
[CI/lint]   🐳  docker create image=catthehacker/ubuntu:act-latest
[CI/lint]   🐳  docker run image=catthehacker/ubuntu:act-latest
[CI/lint] ⭐ Run actions/checkout@v4
[CI/lint] ⭐ Run Set up Python 3.11
[CI/lint] ⭐ Run Install Poetry
[CI/lint] ⭐ Run Install backend dependencies
[CI/lint] ⭐ Run Ruff check
[CI/lint]   ✅ Success - All files passed linting!
```

### Pre-Commit Validation

**Recommended: Use Act CLI for full CI validation**

```bash
# Full validation (all 4 jobs)
act

# Or test specific areas
act -j backend-tests
act -j frontend-tests
```

**Quick Quality Check (fast, no tests)**

```bash
# Backend
cd server
poetry run ruff check .
poetry run ruff format --check
poetry run mypy .

# Frontend
cd client
npm run lint
npm run format
npm run type-check
```

**Manual Test Run (if Act not available)**

```bash
# Backend
cd server && poetry run pytest -v

# Frontend
cd client && npm run test -- --run
```

## Troubleshooting

### Common Issues

**Issue**: `poetry: command not found`

```bash
# Install Poetry via pipx
python -m pip install --user pipx
python -m pipx ensurepath
pipx install poetry
```

**Issue**: `npm ERR! EPERM: operation not permitted`

```bash
# Kill any running Node/Vite processes
# Windows:
taskkill /F /IM node.exe
# Linux/macOS:
killall node

# Clear npm cache
npm cache clean --force

# Reinstall
cd client
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Vitest hangs on first run

```bash
# Force run mode (not watch)
npm run test -- --run

# Or manually:
npx vitest run
```

**Issue**: Playwright browsers not installed

```bash
cd client
npx playwright install --with-deps
```

**Issue**: TypeScript errors in tests

```typescript
// Add to vitest.setup.ts or individual test files
import '@testing-library/jest-dom'

// Ensure tsconfig includes test files
// tsconfig.app.json: "include": ["src", "**/*.test.ts", "**/*.test.tsx"]
```

**Issue**: Need to validate before pushing

Use Act CLI for complete CI simulation:

```bash
# Test everything
act

# Or test specific job
act -j backend-tests
```

**Issue**: Act fails with Docker errors

```bash
# Ensure Docker Desktop is running
# Use smaller image for faster iteration:
act -P ubuntu-latest=catthehacker/ubuntu:act-22.04
```

### Constitutional Compliance Checklist

Before committing, verify:

- ✅ **Article I**: No unnecessary abstractions (keep it simple)
- ✅ **Article II**: P1 features are only un-deletable constraint related
- ✅ **Article III**: Tests written before implementation (TDD)
- ✅ **Article IV**: Backend follows SOLID (SRP, DIP with constructor injection)
- ✅ **Article V**: All public functions have JSDoc/Docstrings

## Resources

- **Constitution**: `.specify/memory/constitution.md` - Project governance
- **Claude Guide**: `CLAUDE.md` - AI assistant operational guide
- **Templates**: `.specify/templates/` - Spec, plan, tasks templates
- **CI Workflow**: `.github/workflows/ci.yml` - GitHub Actions config

## Next Steps

1. **Start TDD Loop**: Write failing test → Implement → Refactor
2. **Run Quality Gates**: Lint, type-check, test before commit
3. **Validate with Act**: Run `act` to simulate CI before pushing
4. **Constitutional Review**: Verify compliance with 5 articles
5. **Commit**: Use conventional commits format
