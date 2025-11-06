# Testing Guide

**Impetus Lock** - Comprehensive testing guide for TDD workflow compliance with Article III (Constitutional requirement).

## TDD Principles (Article III - NON-NEGOTIABLE)

**Red-Green-Refactor Cycle**:

1. **🔴 RED**: Write a failing test first
2. **🟢 GREEN**: Write minimal code to make it pass
3. **🔵 REFACTOR**: Improve code while keeping tests green

**Constitutional Requirements**:
- Tests MUST be written before implementation
- P1 features require ≥80% test coverage
- CI blocks merges if P1 features lack tests

## Quick Command Reference

### Backend Tests (pytest)

```bash
cd server

# Run all tests
poetry run pytest

# Watch mode (TDD recommended)
poetry run pytest-watch  # Install: poetry add -D pytest-watch

# Specific test
poetry run pytest tests/test_main.py::test_health_endpoint_returns_200

# Verbose
poetry run pytest -v

# Coverage
poetry run pytest --cov=server --cov-report=html
open htmlcov/index.html  # View coverage report
```

### Frontend Tests (Vitest + Playwright)

```bash
cd client

# Unit tests (Vitest)
npm run test              # Run once
npm run test:watch        # TDD watch mode ⭐
npm run test -- --ui      # Visual UI mode

# E2E tests (Playwright)
npm run test:e2e          # Run E2E tests
npx playwright test --ui  # Interactive mode
npx playwright test --headed --debug  # Debug mode

# Coverage
npm run test -- --coverage
```

## Backend Testing (pytest + FastAPI TestClient)

### Test File Structure

```
server/
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # Shared fixtures
│   ├── test_main.py          # API endpoint tests
│   ├── test_task_service.py  # Service layer tests
│   └── test_task_lock.py     # P1 feature: un-deletable logic
```

### Writing Tests

**API Endpoint Test (Contract Test)**:

```python
# tests/test_main.py
from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)

def test_health_endpoint_returns_200() -> None:
    """Test that health endpoint returns successful status code.
    
    Article III: This test was written BEFORE implementing /health endpoint.
    """
    response = client.get("/health")
    assert response.status_code == 200
    
def test_health_endpoint_returns_correct_structure() -> None:
    """Test that health endpoint returns expected JSON structure."""
    response = client.get("/health")
    body = response.json()
    
    assert "status" in body
    assert "service" in body
    assert "version" in body
```

**Service Layer Test (Unit Test)**:

```python
# tests/test_task_service.py
import pytest
from server.services.task_service import TaskService
from server.models.task import Task

@pytest.fixture
def task_service() -> TaskService:
    """Provide a TaskService instance for testing."""
    return TaskService()

def test_create_task_returns_task(task_service: TaskService) -> None:
    """Test that creating a task returns a Task object.
    
    Article III: Write this test BEFORE implementing TaskService.create_task().
    """
    task = task_service.create_task(title="Test Task")
    
    assert isinstance(task, Task)
    assert task.title == "Test Task"
    assert task.locked is False  # Not locked by default
```

**P1 Feature Test (Lock Logic - Article II Compliance)**:

```python
# tests/test_task_lock.py
import pytest
from server.services.task_service import TaskService
from server.exceptions import TaskLockedError

def test_locked_task_cannot_be_deleted(task_service: TaskService) -> None:
    """Test that locked tasks cannot be deleted (P1 un-deletable constraint).
    
    Article II: This is P1 priority - core "Vibe" feature.
    Article III: Write this test FIRST, ensure it FAILS, then implement.
    """
    # Create and lock a task
    task = task_service.create_task(title="Important Task")
    task_service.lock_task(task.id)
    
    # Attempt to delete should raise error
    with pytest.raises(TaskLockedError):
        task_service.delete_task(task.id)
    
    # Verify task still exists
    assert task_service.get_task(task.id) is not None
```

### Shared Fixtures

```python
# tests/conftest.py
"""Shared pytest fixtures for all tests."""

import pytest
from fastapi.testclient import TestClient
from server.main import app

@pytest.fixture
def client() -> TestClient:
    """Provide FastAPI test client."""
    return TestClient(app)

@pytest.fixture
def sample_task_data() -> dict[str, str]:
    """Provide sample task data for testing."""
    return {
        "title": "Test Task",
        "description": "Test description",
    }
```

### Running Backend Tests

```bash
cd server

# TDD workflow: Run tests on every save
poetry run pytest-watch

# Or use pytest with auto-reload
poetry run pytest --looponfail

# Run specific test file
poetry run pytest tests/test_task_lock.py -v

# Run tests matching pattern
poetry run pytest -k "lock" -v

# Stop on first failure (fast feedback)
poetry run pytest -x

# Show print statements
poetry run pytest -s

# Coverage for P1 features only
poetry run pytest tests/test_task_lock.py --cov=server.services.task_service
```

## Frontend Testing (Vitest + Testing Library + Playwright)

### Test File Structure

```
client/
├── src/
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   └── TaskCard.test.tsx      # Unit test
│   └── hooks/
│       ├── useTaskLock.ts
│       └── useTaskLock.test.ts    # Hook test
├── e2e/
│   ├── smoke.spec.ts              # Smoke tests
│   └── task-lock.spec.ts          # P1 E2E: lock feature
└── vitest.setup.ts                # Global test setup
```

### Unit Tests (Vitest + Testing Library)

**Component Test**:

```typescript
// src/components/TaskCard.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TaskCard } from "./TaskCard";

describe("TaskCard", () => {
  it("renders task title", () => {
    // Article III: Write this test FIRST
    render(<TaskCard title="Test Task" locked={false} />);
    
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });
  
  it("shows lock icon when task is locked", () => {
    // P1 feature indicator
    render(<TaskCard title="Locked Task" locked={true} />);
    
    const lockIcon = screen.getByTestId("lock-icon");
    expect(lockIcon).toBeInTheDocument();
  });
  
  it("disables delete button when task is locked", () => {
    // Article II: P1 feature - un-deletable constraint
    render(<TaskCard title="Locked Task" locked={true} onDelete={vi.fn()} />);
    
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });
  
  it("calls onDelete when unlocked task delete is clicked", () => {
    const onDelete = vi.fn();
    render(<TaskCard title="Task" locked={false} onDelete={onDelete} />);
    
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
```

**Hook Test**:

```typescript
// src/hooks/useTaskLock.test.ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTaskLock } from "./useTaskLock";

describe("useTaskLock", () => {
  it("initializes with unlocked state", () => {
    const { result } = renderHook(() => useTaskLock());
    
    expect(result.current.isLocked).toBe(false);
  });
  
  it("locks task and prevents deletion", () => {
    // Article III: Write BEFORE implementing lock logic
    const { result } = renderHook(() => useTaskLock());
    
    act(() => {
      result.current.lock();
    });
    
    expect(result.current.isLocked).toBe(true);
    expect(result.current.canDelete).toBe(false);
  });
});
```

### E2E Tests (Playwright)

**Smoke Test**:

```typescript
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("homepage renders successfully", async ({ page }) => {
  await page.goto("/");
  
  await expect(page).toHaveTitle(/Vite \+ React/);
  await expect(page.locator("h1")).toBeVisible();
});
```

**P1 Feature E2E Test**:

```typescript
// e2e/task-lock.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Task Lock Feature (P1)", () => {
  test("user can create and lock task", async ({ page }) => {
    // Article III: Write BEFORE implementing lock UI
    await page.goto("/");
    
    // Create task
    await page.fill('[data-testid="task-input"]', "Important Meeting");
    await page.click('[data-testid="create-button"]');
    
    // Verify task appears
    await expect(page.locator('[data-testid="task-card"]')).toContainText(
      "Important Meeting"
    );
    
    // Lock task (P1 feature)
    await page.click('[data-testid="lock-button"]');
    
    // Verify locked state
    await expect(page.locator('[data-testid="lock-icon"]')).toBeVisible();
  });
  
  test("locked task cannot be deleted", async ({ page }) => {
    // Article II: Core "Vibe" - un-deletable constraint
    await page.goto("/");
    
    // Create and lock task
    await page.fill('[data-testid="task-input"]', "Critical Task");
    await page.click('[data-testid="create-button"]');
    await page.click('[data-testid="lock-button"]');
    
    // Delete button should be disabled
    const deleteButton = page.locator('[data-testid="delete-button"]');
    await expect(deleteButton).toBeDisabled();
    
    // Task should still exist after attempted deletion
    await expect(page.locator('[data-testid="task-card"]')).toContainText(
      "Critical Task"
    );
  });
});
```

### Running Frontend Tests

```bash
cd client

# Unit tests (Vitest)
npm run test:watch          # TDD mode ⭐
npm run test                # Single run
npm run test -- --ui        # Visual interface
npm run test -- --coverage  # With coverage

# E2E tests (Playwright)
npm run test:e2e                     # Headless
npx playwright test --ui             # Interactive
npx playwright test --headed         # Show browser
npx playwright test --debug          # Debug mode
npx playwright test e2e/task-lock.spec.ts  # Specific file

# Install browsers (first time)
npx playwright install --with-deps
```

## Coverage Requirements (Article III)

**Constitutional Mandate**:
- **P1 Features** (un-deletable constraint): ≥80% coverage REQUIRED
- **P2 Features**: Best effort, not blocking
- **Infrastructure**: Coverage not required

**Check Coverage**:

```bash
# Backend
cd server
poetry run pytest --cov=server --cov-report=term-missing
poetry run pytest --cov=server --cov-report=html

# Frontend
cd client
npm run test -- --coverage
```

**Coverage Report Format**:

```
Name                           Stmts   Miss  Cover   Missing
------------------------------------------------------------
server/services/task_service.py   45      3    93%   102-104
server/models/task.py              20      0   100%
------------------------------------------------------------
TOTAL                             65      3    95%
```

## CI Validation

### Local CI Testing (Act CLI)

```bash
# Run all jobs
act

# Run specific job
act -j backend-tests
act -j frontend-tests

# List available jobs
act -l

# Dry run
act -n
```

### Manual Pre-Commit Check

```bash
# Backend
cd server
poetry run ruff check .
poetry run mypy .
poetry run pytest -v

# Frontend
cd client
npm run lint
npm run type-check
npm run test
```

## TDD Best Practices

### 1. Always Start with Red

```bash
# ❌ DON'T: Write implementation first
# ✅ DO: Write failing test first

cd server
# 1. Write test in tests/test_task_lock.py
poetry run pytest tests/test_task_lock.py
# Expected: FAILED

# 2. Implement in server/services/task_service.py
poetry run pytest tests/test_task_lock.py
# Expected: PASSED
```

### 2. Keep Tests Fast

- **Unit tests**: <100ms each
- **Integration tests**: <1s each
- **E2E tests**: <10s each

### 3. Use Descriptive Names

```python
# ❌ Bad
def test_1():
    ...

# ✅ Good
def test_locked_task_cannot_be_deleted():
    ...
```

### 4. One Assert per Concept

```python
# ❌ Bad: Multiple unrelated asserts
def test_task():
    assert task.title == "Test"
    assert task.locked is False
    assert user.name == "Alice"  # Unrelated!

# ✅ Good: Focused test
def test_task_is_not_locked_by_default():
    task = create_task("Test")
    assert task.locked is False
```

### 5. Use Fixtures for Setup

```python
# ✅ Good: DRY with fixtures
@pytest.fixture
def locked_task(task_service):
    task = task_service.create_task("Test")
    task_service.lock_task(task.id)
    return task

def test_locked_task_cannot_be_deleted(task_service, locked_task):
    with pytest.raises(TaskLockedError):
        task_service.delete_task(locked_task.id)
```

## Debugging Tests

### Backend (pytest)

```bash
# Show print statements
poetry run pytest -s

# Drop into debugger on failure
poetry run pytest --pdb

# Stop on first failure
poetry run pytest -x

# Verbose output
poetry run pytest -vv
```

### Frontend (Vitest)

```bash
# UI mode (visual debugging)
npm run test -- --ui

# Debug specific test
npm run test -- --run src/components/TaskCard.test.tsx

# Show console.log
npm run test -- --reporter=verbose
```

### E2E (Playwright)

```bash
# Debug mode (opens inspector)
npx playwright test --debug

# Headed mode (show browser)
npx playwright test --headed

# Slow motion (easier to follow)
npx playwright test --headed --slow-mo=1000

# Trace viewer (after test)
npx playwright test --trace on
npx playwright show-trace trace.zip
```

## Troubleshooting

**Test hangs indefinitely**:
- Check for open connections (databases, servers)
- Use `--run` flag with Vitest (not watch mode)
- Set timeout in test: `test("...", async () => {}, { timeout: 5000 })`

**Import errors in tests**:
- Verify `vitest.setup.ts` is configured
- Check `tsconfig` includes test files
- Ensure `@testing-library/jest-dom` is imported

**Playwright browser not found**:
```bash
npx playwright install --with-deps
```

**Coverage not accurate**:
- Ensure all source files are imported (not just tested files)
- Check coverage configuration in `vitest.config.ts` or `pytest.ini`

## Resources

- **Backend**: [pytest docs](https://docs.pytest.org/)
- **Frontend Unit**: [Vitest docs](https://vitest.dev/)
- **Frontend E2E**: [Playwright docs](https://playwright.dev/)
- **Testing Library**: [testing-library.com](https://testing-library.com/)
- **Constitution**: `.specify/memory/constitution.md` (Article III)
