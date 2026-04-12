# Development Standards

**Project**: Impetus Lock  
**Version**: 1.0.0  
**Effective Date**: 2026-04-09  
**Owner**: Tech Lead

---

## 1. Code Review Checklist

### 1.1 General Requirements

- [ ] Code follows project conventions (see Section 2)
- [ ] All CI checks pass (lint, type-check, tests)
- [ ] No console.log or debug statements left in code
- [ ] No secrets or credentials in code
- [ ] Documentation updated (JSDoc/docstrings)
- [ ] Tests added for new functionality
- [ ] Tests pass locally (`act` or direct commands)

### 1.2 Backend Review Checklist

- [ ] **SRP Compliance**: Each function/class has single responsibility
- [ ] **DIP Compliance**: Dependencies injected, not instantiated
- [ ] **Type Safety**: All functions have type annotations
- [ ] **Docstrings**: Google/NumPy style for all public APIs
- [ ] **Error Handling**: Specific exceptions, not bare `except:`
- [ ] **Database**: Proper session management, no N+1 queries
- [ ] **Security**: Input validation, no SQL injection risks

**Backend-Specific Checks**:

```python
# ❌ INCORRECT: Business logic in route
@router.post("/tasks")
async def create_task(data: TaskCreate):
    # Validation logic here - WRONG
    if len(data.content) < 10:
        raise HTTPException(400, "Too short")
    # Direct DB access - WRONG
    db.add(Task(**data.dict()))
    await db.commit()

# ✅ CORRECT: Delegate to service layer
@router.post("/tasks")
async def create_task(
    data: TaskCreate,
    service: TaskService = Depends(get_task_service)
) -> TaskResponse:
    """Create new task.

    Args:
        data: Task creation payload.
        service: Injected task service.

    Returns:
        TaskResponse: Created task.

    Raises:
        HTTPException: 400 if validation fails.
    """
    return await service.create(data)
```

### 1.3 Frontend Review Checklist

- [ ] **Component Size**: Under 200 lines (extract if larger)
- [ ] **Hook Layer**: Components use hooks, not direct service imports
- [ ] **Type Safety**: No `any` types (strict mode enforced)
- [ ] **JSDoc**: All exported functions/components documented
- [ ] **Error Boundaries**: Async operations have error handling
- [ ] **Accessibility**: ARIA labels, keyboard navigation
- [ ] **Performance**: No unnecessary re-renders

**Frontend-Specific Checks**:

```typescript
// ❌ INCORRECT: Direct service import in component
import { taskClient } from "../services/api/taskClient";

export function TaskEditor() {
  // Component directly calls service - WRONG
  const save = () => taskClient.update(...);
}

// ✅ CORRECT: Use hook abstraction
import { useTaskSync } from "../hooks/useTaskSync";

export function TaskEditor() {
  /** Editor component with auto-sync capabilities. */
  const { content, onChange, isSaving } = useTaskSync("");
  // Hook encapsulates service communication
}
```

### 1.4 Test Review Checklist

- [ ] **TDD Compliance**: Tests written before/at same time as implementation
- [ ] **Coverage**: Critical paths have ≥80% coverage
- [ ] **Naming**: `test_<function>_<scenario>` (backend) or descriptive (frontend)
- [ ] **Isolation**: Tests don't depend on each other
- [ ] **Mocking**: External services mocked appropriately
- [ ] **Assertions**: Specific assertions, not just "no exception"

---

## 2. Coding Conventions

### 2.1 Python (Backend)

#### Style Guide

- **Line Length**: 100 characters
- **Formatter**: Ruff (replaces black)
- **Import Order**: stdlib → third-party → first-party (enforced by Ruff)
- **Type Hints**: Required for all function signatures

```python
# ✅ CORRECT: Imports organized
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from server.domain.entities.task import Task
from server.infrastructure.persistence.database import get_session

# ✅ CORRECT: Type annotations + docstring
async def get_task(
    task_id: UUID,
    repository: TaskRepository = Depends(get_task_repository),
) -> Task | None:
    """Retrieve task by ID.

    Args:
        task_id: Unique task identifier.
        repository: Task repository (injected).

    Returns:
        Task instance if found, None otherwise.

    Example:
        >>> task = await get_task(UUID("..."))
        >>> if task:
        ...     print(task.content)
    """
    return await repository.get_task(task_id)
```

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `TaskRepository`, `InterventionService` |
| Functions | snake_case | `get_task`, `create_intervention` |
| Variables | snake_case | `task_id`, `content` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT` |
| Private | _leading_underscore | `_internal_helper`, `_cached_value` |
| Abstract | ABC suffix optional | `TaskRepository` (ABC), `TaskService` |

#### Error Handling

```python
# ✅ CORRECT: Specific exceptions with context
from server.domain.exceptions import TaskNotFoundError, ValidationError

async def update_task(task_id: UUID, content: str) -> Task:
    """Update task content."""
    task = await repository.get_task(task_id)
    if not task:
        raise TaskNotFoundError(f"Task {task_id} not found")

    if len(content) < 10:
        raise ValidationError("Content must be at least 10 characters")

    try:
        return await repository.update(task)
    except OptimisticLockError as e:
        logger.warning(f"Concurrent update conflict: {task_id}")
        raise ConflictError("Task was modified by another user") from e

# ❌ INCORRECT: Bare except, no context
try:
    await repository.update(task)
except:  # Never do this
    pass
```

### 2.2 TypeScript (Frontend)

#### Style Guide

- **Line Length**: 100 characters
- **Formatter**: Prettier
- **Strict Mode**: Enabled (no implicit any)
- **Semicolons**: Required

```typescript
// ✅ CORRECT: Interface naming and JSDoc
/**
 * Task synchronization state.
 *
 * Tracks content, locks, and sync status for real-time
 * collaboration with optimistic locking.
 */
export interface TaskSyncState {
  /** Current markdown content. */
  content: string;
  /** Active lock IDs preventing deletion. */
  lockIds: string[];
  /** Server-assigned task ID (null if not synced). */
  taskId: string | null;
  /** Optimistic lock version for conflict detection. */
  version: number;
  /** Current synchronization status. */
  status: "loading" | "ready" | "error";
  /** Error message if status is 'error'. */
  error: string | null;
  /** Whether save operation is in progress. */
  isSaving: boolean;
}

// ✅ CORRECT: Function with JSDoc
/**
 * Classify error into specific type for handling.
 *
 * @param error - Error to classify
 * @returns Error type classification
 *
 * @example
 * ```typescript
 * const type = classifyError(error);
 * if (type === "conflict") {
 *   showConflictResolution();
 * }
 * ```
 */
function classifyError(error: unknown): TaskSyncErrorType {
  if (error instanceof TaskAPIError) {
    if (error.status === 409) return "conflict";
    if (error.status >= 500) return "server";
  }
  return "unknown";
}
```

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskEditor`, `FloatingToolbar` |
| Hooks | camelCase, use* prefix | `useTaskSync`, `useWritingState` |
| Interfaces | PascalCase | `TaskSyncState`, `EditorConfig` |
| Types | PascalCase | `TaskSyncErrorType` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT_MS`, `LOCAL_CACHE_KEY` |
| Enums | PascalCase | `WritingState`, `AgentMode` |
| Private | _leading_underscore | `_internalState`, `_cache` |

#### Component Structure

```typescript
// ✅ CORRECT: Component structure
import { useTaskSync } from "../../hooks/useTaskSync";
import { useSensoryFeedback } from "../../hooks/useSensoryFeedback";

/**
 * Task editor with lock enforcement and AI interventions.
 *
 * Provides a Milkdown-based editor with:
 * - Un-deletable lock blocks
 * - Auto-save with optimistic locking
 * - Sensory feedback for interventions
 *
 * @example
 * ```tsx
 * <TaskEditor defaultContent="# My Task" />
 * ```
 */
export function TaskEditor({ defaultContent }: TaskEditorProps) {
  // Hooks first
  const { content, onChange, isSaving } = useTaskSync(defaultContent);
  const { triggerFeedback } = useSensoryFeedback();

  // Local state
  const [isToolbarVisible, setToolbarVisible] = useState(false);

  // Callbacks
  const handleContentChange = useCallback(
    (markdown: string) => {
      onChange(markdown, []);
    },
    [onChange]
  );

  // Render
  return (
    <div className={styles.editorContainer}>
      <EditorCore content={content} onChange={handleContentChange} />
      {isToolbarVisible && <FloatingToolbar />}
    </div>
  );
}
```

---

## 3. API Design Standards

### 3.1 REST API Conventions

#### URL Structure

```
/api/v1/{resource}/{id}/{sub-resource}
```

| Pattern | Example | Description |
|---------|---------|-------------|
| List | `GET /api/v1/tasks` | List with pagination |
| Create | `POST /api/v1/tasks` | Create new resource |
| Get | `GET /api/v1/tasks/{id}` | Get specific resource |
| Update | `PUT /api/v1/tasks/{id}` | Full update |
| Partial | `PATCH /api/v1/tasks/{id}` | Partial update (if supported) |
| Delete | `DELETE /api/v1/tasks/{id}` | Remove resource |
| Sub-resource | `GET /api/v1/tasks/{id}/actions` | Nested collection |

#### HTTP Status Codes

| Code | Usage | Example |
|------|-------|---------|
| 200 | Success (GET, PUT) | Task updated successfully |
| 201 | Created (POST) | New task created |
| 204 | No content (DELETE) | Task deleted |
| 400 | Bad request | Validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Permission denied |
| 404 | Not found | Task doesn't exist |
| 409 | Conflict | Version mismatch (optimistic locking) |
| 422 | Unprocessable | Business rule violation |
| 429 | Rate limited | Too many requests |
| 500 | Server error | Unexpected error |

#### Request/Response Format

```typescript
// ✅ CORRECT: Consistent response structure
interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Example success
{
  "data": {
    "id": "task-123",
    "content": "# My Task",
    "version": 5
  },
  "meta": {
    "total": 1,
    "limit": 100,
    "offset": 0
  }
}

// Example error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "content": ["Must be at least 10 characters"]
    }
  }
}
```

#### Pagination

```python
# ✅ CORRECT: Consistent pagination
@router.get("/")
async def list_tasks(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TaskListResponse:
    """List tasks with pagination.

    Args:
        limit: Items per page (1-100, default 100).
        offset: Items to skip (default 0).

    Returns:
        TaskListResponse with data and pagination metadata.
    """
    tasks = await repository.list_tasks(limit=limit, offset=offset)
    total = await repository.count_tasks()  # Efficient count

    return TaskListResponse(
        data=[TaskResponse.from_entity(t) for t in tasks],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )
```

### 3.2 API Versioning Strategy

**Current Version**: v1 (no prefix yet - see Debt Report)

**Migration Plan**:
1. Add `/api/v1/` prefix to all existing routes
2. Maintain backward compatibility during transition
3. Document breaking changes in CHANGELOG

**Version Header** (future):
```
Accept: application/json; version=2.0
```

---

## 4. Database Schema Change Process

### 4.1 Change Workflow

```
1. Design → 2. Review → 3. Migration → 4. Test → 5. Deploy
```

#### Step 1: Design

- Document proposed changes in PR description
- Include ERD snippet showing before/after
- Identify data migration needs

#### Step 2: Review

- Database changes require Tech Lead approval
- Review checklist:
  - [ ] Indexes added for new foreign keys
  - [ ] Default values for non-nullable columns
  - [ ] Backward compatibility (old code works with new schema)
  - [ ] Rollback plan documented

#### Step 3: Migration

```bash
# Generate migration
cd server
alembic revision --autogenerate -m "add_user_preferences_table"

# Review generated migration before committing
# - Check upgrade() logic
# - Check downgrade() logic
# - Verify no data loss
```

#### Step 4: Test

```bash
# Test upgrade
cd server
alembic upgrade head
poetry run pytest tests/ -k "database"

# Test downgrade
alembic downgrade -1
alembic upgrade head  # Verify idempotent
```

#### Step 5: Deploy

- Migrations run automatically in CI/CD
- Monitor for errors post-deployment
- Keep rollback script ready

### 4.2 Schema Standards

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Tables | plural, snake_case | `tasks`, `intervention_actions` |
| Columns | snake_case | `created_at`, `lock_ids` |
| Indexes | idx_{table}_{column} | `idx_tasks_created_at` |
| Constraints | chk_{table}_{rule} | `chk_tasks_content_not_empty` |
| Foreign Keys | fk_{table}_{ref} | `fk_actions_task_id` |

#### Required Columns

All tables must include:

```python
id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC))
updated_at: Mapped[datetime] = mapped_column(
    default=lambda: datetime.now(UTC),
    onupdate=lambda: datetime.now(UTC)
)
```

#### Column Constraints

```python
# ✅ CORRECT: Proper constraints
content: Mapped[str] = mapped_column(
    Text,
    nullable=False,
    comment="Task content in Markdown format"
)

# Add table-level constraints
__table_args__ = (
    CheckConstraint("length(content) > 0", name="chk_tasks_content_not_empty"),
    Index("idx_tasks_created_at", "created_at"),
)
```

---

## 5. Error Handling Standards

### 5.1 Backend Error Handling

#### Exception Hierarchy

```python
# server/domain/exceptions.py
class DomainError(Exception):
    """Base domain error."""
    pass

class NotFoundError(DomainError):
    """Resource not found."""
    code = "NOT_FOUND"
    status_code = 404

class ValidationError(DomainError):
    """Input validation failed."""
    code = "VALIDATION_ERROR"
    status_code = 400

class ConflictError(DomainError):
    """Resource conflict (e.g., optimistic locking)."""
    code = "CONFLICT"
    status_code = 409

class AuthenticationError(DomainError):
    """Authentication failed."""
    code = "AUTHENTICATION_ERROR"
    status_code = 401
```

#### Global Exception Handler

```python
# server/api/errors.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    """Handle domain errors with consistent response format."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": str(exc),
                "details": getattr(exc, "details", None),
            }
        },
    )
```

### 5.2 Frontend Error Handling

#### Error Classification

```typescript
// services/api/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "APIError";
  }
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
```

#### Error Boundaries

```typescript
// components/ErrorBoundary/ErrorBoundary.tsx
/**
 * Error boundary for catching React rendering errors.
 *
 * Prevents entire app crash and shows user-friendly error UI.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service
    logger.error("React error boundary caught:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

#### User-Facing Errors

```typescript
// hooks/useTaskSync.ts
const ERROR_MESSAGES: Record<TaskSyncErrorType, string> = {
  network: "Connection failed. Please check your internet.",
  server: "Server error. Please try again later.",
  conflict: "Content was modified elsewhere. Refreshing...",
  auth: "Please sign in again.",
  validation: "Please check your input and try again.",
  unknown: "An unexpected error occurred.",
};

function getUserMessage(error: unknown): string {
  const type = classifyError(error);
  return ERROR_MESSAGES[type];
}
```

---

## 6. Git Workflow Standards

### 6.1 Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{description}` | `feature/task-persistence` |
| Bugfix | `fix/{description}` | `fix/lock-enforcement-race` |
| Refactor | `refactor/{description}` | `refactor/extract-hooks` |
| Docs | `docs/{description}` | `docs/api-examples` |
| Hotfix | `hotfix/{description}` | `hotfix/security-patch` |

### 6.2 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(tasks): add optimistic locking for concurrent edits

Implements version-based conflict detection to prevent
overwrites when multiple users edit the same task.

Closes #123

---

fix(editor): prevent lock bypass via keyboard shortcut

The Ctrl+D shortcut was bypassing the transaction filter.
Added keyboard event interception to maintain lock integrity.

---

docs(api): add error response examples to OpenAPI spec
```

### 6.3 Pull Request Template

```markdown
## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Test

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Testing
<!-- How was this tested? -->

## Screenshots (if UI)
<!-- Before/after screenshots -->
```

---

## 7. Documentation Standards

### 7.1 Code Documentation

**Python Docstrings** (Google style):

```python
def process_intervention(
    task_id: UUID,
    action: InterventionAction,
    context: str,
) -> InterventionResult:
    """Process an intervention action for a task.

    Applies the intervention to the task content and records
    the action in the history. Handles rollback on failure.

    Args:
        task_id: Target task identifier.
        action: Intervention action to apply.
        context: User context at time of intervention.

    Returns:
        InterventionResult containing updated content and metadata.

    Raises:
        TaskNotFoundError: If task doesn't exist.
        InterventionError: If action cannot be applied.

    Example:
        >>> action = InterventionAction.create(...)
        >>> result = await process_intervention(task_id, action, "context")
        >>> print(result.new_content)
    """
```

**TypeScript JSDoc**:

```typescript
/**
 * Synchronize editor content with task API.
 *
 * Provides automatic debounced saving with optimistic locking
 * and conflict resolution. Falls back to local storage on
 * network failures.
 *
 * @param defaultContent - Initial content for new tasks
 * @param options - Configuration options
 * @returns Task sync state and change handler
 *
 * @example
 * ```tsx
 * function Editor() {
 *   const { content, onChange, isSaving } = useTaskSync('# Hello');
 *   return <Editor value={content} onChange={onChange} />;
 * }
 * ```
 *
 * @see {@link TaskSyncState} for returned state shape
 * @see {@link useWritingState} for writing activity detection
 */
export function useTaskSync(
  defaultContent: string,
  options?: UseTaskSyncOptions
): TaskSyncState {
```

### 7.2 Architecture Documentation

Architecture Decision Records (ADRs) should be created for:
- New dependencies or frameworks
- Significant architectural changes
- Security-related decisions
- Performance optimizations

**ADR Template**:
```markdown
# ADR-XXX: Title

## Status
- Proposed / Accepted / Deprecated / Superseded

## Context
- What is the issue we're deciding?

## Decision
- What did we decide?

## Consequences
- Positive: Benefits
- Negative: Trade-offs
- Risks: What could go wrong?

## Alternatives Considered
- Option A: Why rejected
- Option B: Why rejected
```

---

## Appendix: Quick Reference

### Running Quality Checks

```bash
# Backend
cd server
poetry run ruff check .
poetry run ruff format --check
poetry run mypy .
poetry run pytest

# Frontend
cd client
npm run lint
npm run format
npm run type-check
npm run test

# Full CI (local)
act
```

### Pre-commit Setup

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

---

**Last Updated**: 2026-04-09  
**Next Review**: 2026-05-09
