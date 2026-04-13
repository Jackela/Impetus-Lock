# Task Persistence Technical Design

**Change ID**: add-task-persistence  
**Date**: 2026-04-09  
**Author**: Tech Lead  
**Status**: Draft  
**Related**: `openspec/changes/team-setup/tech-debt-report.md`

---

## 1. Context

### 1.1 Current State

The Impetus Lock application currently has basic task persistence implemented:

- **Backend**: Repository pattern with PostgreSQL storage
- **Frontend**: `useTaskSync` hook with optimistic locking
- **Features**: CRUD operations, intervention history, version control

### 1.2 Problem Statement

While basic persistence exists, several gaps need addressing for production readiness:

1. **No user isolation** - Tasks are global, not per-user
2. **Missing service layer** - Business logic in routes
3. **No caching strategy** - Every query hits database
4. **Incomplete pagination** - Inefficient count implementation
5. **No soft delete** - Permanent deletion only

### 1.3 Goals

- Enable multi-user task isolation
- Improve performance with caching
- Add soft delete for data recovery
- Implement proper service layer
- Maintain backward compatibility

### 1.4 Non-Goals

- Real-time collaboration (WebSockets)
- File attachments
- Full-text search (future phase)
- Task sharing between users

---

## 2. Key Technical Decisions

### 2.1 Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repository Pattern | **Keep** | Already implemented, clean abstraction |
| Service Layer | **Add** | Separate business logic from routes (SRP) |
| User Isolation | **Add user_id** | Simple foreign key approach |
| Caching | **Redis** | Fast, supports TTL, widely used |
| Soft Delete | **Add deleted_at** | Standard pattern, enables recovery |
| API Versioning | **Add /v1/** | Prepare for future breaking changes |

### 2.2 Repository vs Direct Service Access

**Decision**: Keep Repository pattern, add Service layer

```
API Routes → Service Layer → Repository → Database
                  ↓
              Cache (Redis)
```

**Rationale**:
- Repository already abstracts data access
- Service layer adds place for business logic
- Enables caching at service level
- Maintains testability (mock repository)

**Alternative Rejected**: Direct service access to DB
- Would couple business logic to ORM
- Harder to test, violates SRP

### 2.3 User Isolation Model

**Decision**: Add `user_id` foreign key to tasks table

```sql
-- Tasks belong to users
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    -- ... existing columns
);

-- Index for user-scoped queries
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_user_created ON tasks(user_id, created_at DESC);
```

**Rationale**:
- Simple, well-understood pattern
- Natural query patterns ("my tasks")
- Easy to enforce at repository level

**Alternative Rejected**: Row-level security (RLS)
- PostgreSQL RLS is powerful but complex
- Harder to debug, test
- Overkill for current requirements

### 2.4 Caching Strategy

**Decision**: Cache at service layer with Redis

| Data Type | Cache Key | TTL | Invalidation |
|-----------|-----------|-----|--------------|
| Task by ID | `task:{id}` | 5 min | On update/delete |
| User task list | `tasks:user:{user_id}` | 1 min | On any task change |
| Task count | `tasks:user:{user_id}:count` | 1 min | On create/delete |

**Rationale**:
- Service layer has context for invalidation
- Redis supports TTL for automatic expiration
- Cache-aside pattern (lazy loading)

**Alternative Rejected**: Database query cache
- Less control over invalidation
- Doesn't scale across multiple app instances

### 2.5 Soft Delete Implementation

**Decision**: Add `deleted_at` timestamp column

```sql
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Default filter in queries
SELECT * FROM tasks WHERE deleted_at IS NULL;

-- Index for cleanup queries
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NOT NULL;
```

**Rationale**:
- Standard pattern, widely understood
- Enables data recovery
- Can be hard-deleted later via cleanup job

**Alternative Rejected**: Separate deleted_tasks table
- More complex, requires transaction
- Harder to implement undo

---

## 3. Database Schema Design

### 3.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────────────┐
│    users    │       │    tasks    │       │ intervention_actions│
├─────────────┤       ├─────────────┤       ├─────────────────────┤
│ id (PK)     │──┐    │ id (PK)     │◄──────│ id (PK)             │
│ email       │  │    │ user_id(FK) │       │ task_id (FK)        │
│ created_at  │  └──►│ content     │       │ action_type         │
└─────────────┘       │ lock_ids    │       │ content             │
                      │ version     │       │ anchor              │
                      │ deleted_at  │       │ mode                │
                      │ created_at  │       │ created_at          │
                      │ updated_at  │       └─────────────────────┘
                      └─────────────┘
```

### 3.2 Schema Changes

#### Migration 1: Add User Association

```python
# alembic/versions/xxx_add_user_to_tasks.py
"""Add user_id to tasks table.

Revision ID: xxx
Revises: previous
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers
revision = 'xxx'
down_revision = 'previous'
branch_labels = None
depends_on = None


def upgrade():
    # Add user_id column (nullable initially for migration)
    op.add_column(
        'tasks',
        sa.Column('user_id', UUID(as_uuid=True), nullable=True)
    )

    # Create foreign key
    op.create_foreign_key(
        'fk_tasks_user_id',
        'tasks', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )

    # Create indexes
    op.create_index('idx_tasks_user_id', 'tasks', ['user_id'])
    op.create_index(
        'idx_tasks_user_created',
        'tasks',
        ['user_id', 'created_at'],
        postgresql_using='btree',
        postgresql_ops={'created_at': 'DESC'}
    )

    # Backfill existing tasks with default user (migration script)
    op.execute("""
        UPDATE tasks
        SET user_id = (
            SELECT id FROM users ORDER BY created_at LIMIT 1
        )
        WHERE user_id IS NULL
    """)

    # Make non-nullable
    op.alter_column('tasks', 'user_id', nullable=False)


def downgrade():
    op.drop_index('idx_tasks_user_created', table_name='tasks')
    op.drop_index('idx_tasks_user_id', table_name='tasks')
    op.drop_constraint('fk_tasks_user_id', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'user_id')
```

#### Migration 2: Add Soft Delete

```python
# alembic/versions/xxx_add_soft_delete.py
"""Add soft delete to tasks table.

Revision ID: yyy
Revises: xxx
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Add deleted_at column
    op.add_column(
        'tasks',
        sa.Column(
            'deleted_at',
            sa.TIMESTAMP(timezone=True),
            nullable=True
        )
    )

    # Create partial index for deleted tasks (cleanup queries)
    op.create_index(
        'idx_tasks_deleted_at',
        'tasks',
        ['deleted_at'],
        postgresql_where=sa.text('deleted_at IS NOT NULL')
    )

    # Update existing queries to filter deleted
    # (Handled in repository layer)


def downgrade():
    op.drop_index('idx_tasks_deleted_at', table_name='tasks')
    op.drop_column('tasks', 'deleted_at')
```

### 3.3 Updated ORM Models

```python
# server/infrastructure/persistence/models.py

class TaskModel(Base):
    """Task ORM model with user association and soft delete."""

    __tablename__ = 'tasks'

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)

    # User association
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Existing fields
    content: Mapped[str] = mapped_column(Text, nullable=False)
    lock_ids: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, server_default='{}')
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
        index=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC)
    )

    # Relationships
    user: Mapped['UserModel'] = relationship('UserModel', back_populates='tasks')
    actions: Mapped[list['InterventionActionModel']] = relationship(
        'InterventionActionModel',
        back_populates='task',
        cascade='all, delete-orphan'
    )

    __table_args__ = (
        CheckConstraint('length(content) > 0', name='chk_tasks_content_not_empty'),
        Index('idx_tasks_user_created', 'user_id', 'created_at'),
    )

    @property
    def is_deleted(self) -> bool:
        """Check if task is soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark task as deleted."""
        self.deleted_at = datetime.now(UTC)

    def restore(self) -> None:
        """Restore soft-deleted task."""
        self.deleted_at = None
```

---

## 4. API Interface Design

### 4.1 Route Structure

```
/api/v1/tasks           GET    List tasks (paginated)
/api/v1/tasks           POST   Create task
/api/v1/tasks/{id}      GET    Get task
/api/v1/tasks/{id}      PUT    Update task
/api/v1/tasks/{id}      DELETE Soft delete task
/api/v1/tasks/{id}/restore POST Restore soft-deleted task
/api/v1/tasks/{id}/actions GET List intervention history
```

### 4.2 Request/Response Schemas

```python
# server/api/routes/tasks.py

class TaskCreateRequest(BaseModel):
    """Request to create a new task."""
    content: str = Field(..., min_length=1, max_length=100000)
    lock_ids: list[str] = Field(default_factory=list)


class TaskUpdateRequest(BaseModel):
    """Request to update a task."""
    content: str = Field(..., min_length=1, max_length=100000)
    lock_ids: list[str] = Field(...)
    version: int = Field(..., ge=0, description='Optimistic lock version')


class TaskResponse(BaseModel):
    """Task response model."""
    id: str
    user_id: str
    content: str
    lock_ids: list[str]
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """Paginated task list response."""
    data: list[TaskResponse]
    meta: PaginationMeta


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    total: int
    limit: int
    offset: int
    has_more: bool
```

### 4.3 Endpoint Implementation

```python
@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    limit: Annotated[int, Query(ge=1, le=100)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    include_deleted: Annotated[bool, Query()] = False,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskListResponse:
    """List tasks for current user.

    Args:
        limit: Maximum items per page (1-100).
        offset: Items to skip.
        include_deleted: Include soft-deleted tasks.
        current_user: Authenticated user.
        service: Task service instance.

    Returns:
        Paginated list of tasks.
    """
    result = await service.list_tasks(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        include_deleted=include_deleted,
    )
    return TaskListResponse(
        data=[TaskResponse.model_validate(t) for t in result.tasks],
        meta=PaginationMeta(
            total=result.total,
            limit=limit,
            offset=offset,
            has_more=offset + len(result.tasks) < result.total,
        ),
    )


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    request: TaskCreateRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Create a new task for current user."""
    task = await service.create_task(
        user_id=current_user.id,
        content=request.content,
        lock_ids=request.lock_ids,
    )
    return TaskResponse.model_validate(task)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Get task by ID (must belong to current user)."""
    task = await service.get_task(task_id, user_id=current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    request: TaskUpdateRequest,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Update task with optimistic locking."""
    try:
        task = await service.update_task(
            task_id=task_id,
            user_id=current_user.id,
            content=request.content,
            lock_ids=request.lock_ids,
            expected_version=request.version,
        )
        return TaskResponse.model_validate(task)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
    except VersionMismatchError:
        raise HTTPException(
            status_code=409,
            detail="Task was modified by another user. Please refresh and try again."
        )


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> None:
    """Soft delete task."""
    try:
        await service.soft_delete_task(task_id, user_id=current_user.id)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/restore", response_model=TaskResponse)
async def restore_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    service: TaskService = Depends(get_task_service),
) -> TaskResponse:
    """Restore soft-deleted task."""
    try:
        task = await service.restore_task(task_id, user_id=current_user.id)
        return TaskResponse.model_validate(task)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")
```

---

## 5. Service Layer Design

### 5.1 Service Interface

```python
# server/application/services/task_service.py

class TaskService:
    """Service for task business logic.

    Coordinates between API layer and repository,
    handles caching and business rules.
    """

    def __init__(
        self,
        repository: TaskRepository,
        cache: Cache | None = None,
    ):
        self._repository = repository
        self._cache = cache

    async def create_task(
        self,
        user_id: UUID,
        content: str,
        lock_ids: list[str],
    ) -> Task:
        """Create a new task for user."""
        task = Task.create(
            user_id=user_id,
            content=content,
            lock_ids=lock_ids,
        )
        saved = await self._repository.save(task)

        # Invalidate list cache
        await self._invalidate_list_cache(user_id)

        return saved

    async def get_task(
        self,
        task_id: UUID,
        user_id: UUID,
    ) -> Task | None:
        """Get task by ID with caching."""
        cache_key = f"task:{task_id}"

        # Try cache first
        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                task = Task.model_validate(cached)
                if task.user_id == user_id:
                    return task

        # Fetch from database
        task = await self._repository.get_by_id(task_id)
        if not task or task.user_id != user_id or task.is_deleted:
            return None

        # Cache result
        if self._cache:
            await self._cache.set(cache_key, task.model_dump(), ttl=300)

        return task

    async def list_tasks(
        self,
        user_id: UUID,
        limit: int,
        offset: int,
        include_deleted: bool = False,
    ) -> TaskListResult:
        """List tasks for user with caching."""
        cache_key = f"tasks:user:{user_id}:list:{limit}:{offset}:{include_deleted}"

        if self._cache:
            cached = await self._cache.get(cache_key)
            if cached:
                return TaskListResult.model_validate(cached)

        tasks = await self._repository.list_by_user(
            user_id=user_id,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted,
        )
        total = await self._repository.count_by_user(
            user_id=user_id,
            include_deleted=include_deleted,
        )

        result = TaskListResult(tasks=tasks, total=total)

        if self._cache:
            await self._cache.set(cache_key, result.model_dump(), ttl=60)

        return result

    async def update_task(
        self,
        task_id: UUID,
        user_id: UUID,
        content: str,
        lock_ids: list[str],
        expected_version: int,
    ) -> Task:
        """Update task with optimistic locking."""
        task = await self._repository.get_by_id(task_id)

        if not task or task.user_id != user_id:
            raise TaskNotFoundError(f"Task {task_id} not found")

        if task.is_deleted:
            raise TaskNotFoundError(f"Task {task_id} has been deleted")

        if task.version != expected_version:
            raise VersionMismatchError(
                f"Version mismatch: expected {expected_version}, got {task.version}"
            )

        task.update_content(content, lock_ids)
        updated = await self._repository.update(task)

        # Invalidate caches
        await self._invalidate_task_cache(task_id)
        await self._invalidate_list_cache(user_id)

        return updated

    async def soft_delete_task(
        self,
        task_id: UUID,
        user_id: UUID,
    ) -> None:
        """Soft delete task."""
        task = await self._repository.get_by_id(task_id)

        if not task or task.user_id != user_id:
            raise TaskNotFoundError(f"Task {task_id} not found")

        task.soft_delete()
        await self._repository.update(task)

        # Invalidate caches
        await self._invalidate_task_cache(task_id)
        await self._invalidate_list_cache(user_id)

    async def restore_task(
        self,
        task_id: UUID,
        user_id: UUID,
    ) -> Task:
        """Restore soft-deleted task."""
        task = await self._repository.get_by_id(task_id, include_deleted=True)

        if not task or task.user_id != user_id:
            raise TaskNotFoundError(f"Task {task_id} not found")

        if not task.is_deleted:
            raise TaskError("Task is not deleted")

        task.restore()
        restored = await self._repository.update(task)

        # Invalidate caches
        await self._invalidate_task_cache(task_id)
        await self._invalidate_list_cache(user_id)

        return restored

    async def _invalidate_task_cache(self, task_id: UUID) -> None:
        """Invalidate task cache."""
        if self._cache:
            await self._cache.delete(f"task:{task_id}")

    async def _invalidate_list_cache(self, user_id: UUID) -> None:
        """Invalidate list caches for user."""
        if self._cache:
            # Pattern delete for all list caches
            await self._cache.delete_pattern(f"tasks:user:{user_id}:list:*")
```

### 5.2 Repository Updates

```python
# server/domain/repositories/task_repository.py

class TaskRepository(ABC):
    """Repository for task persistence."""

    @abstractmethod
    async def save(self, task: Task) -> Task:
        """Save new task."""
        pass

    @abstractmethod
    async def get_by_id(
        self,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> Task | None:
        """Get task by ID."""
        pass

    @abstractmethod
    async def update(self, task: Task) -> Task:
        """Update existing task."""
        pass

    @abstractmethod
    async def list_by_user(
        self,
        user_id: UUID,
        limit: int,
        offset: int,
        include_deleted: bool = False,
    ) -> list[Task]:
        """List tasks for user."""
        pass

    @abstractmethod
    async def count_by_user(
        self,
        user_id: UUID,
        include_deleted: bool = False,
    ) -> int:
        """Count tasks for user."""
        pass
```

---

## 6. Frontend Integration

### 6.1 Updated API Client

```typescript
// client/src/services/api/taskClient.ts

export interface TaskRecord {
  id: string;
  user_id: string;
  content: string;
  lock_ids: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  data: TaskRecord[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export async function fetchTasks(
  options: { limit?: number; offset?: number } = {}
): Promise<TaskListResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const response = await fetch(`/api/v1/tasks?${params}`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw await parseAPIError(response);
  }

  return response.json();
}

export async function restoreTask(taskId: string): Promise<TaskRecord> {
  const response = await fetch(`/api/v1/tasks/${taskId}/restore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw await parseAPIError(response);
  }

  return response.json();
}
```

### 6.2 Updated useTaskSync Hook

```typescript
// client/src/hooks/useTaskSync.ts

export interface UseTaskSyncOptions {
  externalTaskId?: string | null;
  onConflict?: () => void;
}

export function useTaskSync(
  defaultContent: string,
  options: UseTaskSyncOptions = {}
): TaskSyncState {
  // ... existing implementation ...

  const restore = useCallback(async () => {
    if (!taskId) return;

    setStatus('loading');
    try {
      const restored = await restoreTask(taskId);
      setContent(restored.content);
      setLockIds(restored.lock_ids);
      setVersion(restored.version);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }, [taskId]);

  return {
    // ... existing state ...
    restore,
  };
}
```

---

## 7. Security Considerations

### 7.1 Authorization Model

```
User Authentication (JWT)
        ↓
Route Dependency (get_current_user)
        ↓
Service Layer (user_id check)
        ↓
Repository (query scoped to user)
```

**Enforcement Points**:
1. **Route**: JWT validation, extract user
2. **Service**: Verify resource ownership
3. **Repository**: Query with user_id filter

### 7.2 Input Validation

```python
# server/api/validation.py

from bleach import clean

def sanitize_content(content: str) -> str:
    """Sanitize task content to prevent XSS.

    Allows Markdown formatting while removing dangerous HTML.
    """
    # Allow specific HTML tags that Markdown might generate
    allowed_tags = ['p', 'br', 'strong', 'em', 'code', 'pre']
    allowed_attrs = {}

    return clean(content, tags=allowed_tags, attributes=allowed_attrs, strip=True)


# In service layer
async def create_task(self, user_id: UUID, content: str, lock_ids: list[str]) -> Task:
    sanitized_content = sanitize_content(content)
    # ... continue with creation
```

### 7.3 Rate Limiting

```python
# server/api/middleware/rate_limit.py

from fastapi import Request, HTTPException
from redis.asyncio import Redis

class RateLimiter:
    """Rate limiting middleware."""

    def __init__(self, redis: Redis, requests_per_minute: int = 60):
        self._redis = redis
        self._rpm = requests_per_minute

    async def check(self, request: Request) -> None:
        """Check if request is within rate limit."""
        user_id = getattr(request.state, 'user_id', None)
        if not user_id:
            return

        key = f"rate_limit:{user_id}:{request.url.path}"
        current = await self._redis.incr(key)

        if current == 1:
            await self._redis.expire(key, 60)

        if current > self._rpm:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again later."
            )
```

---

## 8. Migration Plan

### 8.1 Phase 1: Schema Changes (Week 1)

1. Create Alembic migrations
2. Deploy to staging
3. Run migrations with zero downtime
4. Verify data integrity

### 8.2 Phase 2: Service Layer (Week 1-2)

1. Implement TaskService
2. Add caching infrastructure
3. Write service tests
4. Update repository implementations

### 8.3 Phase 3: API Updates (Week 2)

1. Add /v1/ prefix to routes
2. Update route implementations
3. Add authorization checks
4. Update API documentation

### 8.4 Phase 4: Frontend Updates (Week 2-3)

1. Update API client
2. Add user context
3. Update hooks
4. Add restore UI

### 8.5 Phase 5: Cleanup (Week 3)

1. Remove deprecated endpoints
2. Archive old migrations
3. Update documentation
4. Performance testing

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration data loss | Low | High | Backup before migration, test on staging |
| Cache inconsistency | Medium | Medium | Short TTL, explicit invalidation |
| Performance regression | Low | High | Load testing, query analysis |
| Breaking API changes | Medium | High | Version prefix, backward compat period |
| Auth bypass | Low | Critical | Security review, audit logs |

---

## 10. Open Questions

1. **User model**: Do we need to extend the existing user model or is current sufficient?
2. **Cache eviction**: Should we use Redis pub/sub for cross-instance cache invalidation?
3. **Soft delete retention**: How long should soft-deleted tasks be retained?
4. **Audit logging**: Should we log all task operations for compliance?

---

## Appendix: Key Files

| File | Purpose |
|------|---------|
| `server/application/services/task_service.py` | New service layer |
| `server/domain/repositories/task_repository.py` | Updated repository interface |
| `server/infrastructure/persistence/models.py` | Updated ORM models |
| `server/api/routes/tasks.py` | Updated API routes |
| `client/src/services/api/taskClient.ts` | Updated API client |
| `client/src/hooks/useTaskSync.ts` | Updated sync hook |
