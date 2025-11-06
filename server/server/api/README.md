# API Layer

**Purpose:** HTTP interface (FastAPI routes, schemas, dependencies).

## Structure

```
api/
├── routes/         # FastAPI routers
├── schemas/        # Pydantic request/response models
├── dependencies/   # Dependency injection
└── main.py         # FastAPI app
```

## Rules

✅ **Allowed:**
- Import from all layers (outermost layer)
- Use FastAPI dependencies
- Handle HTTP requests/responses

❌ **Forbidden:**
- Business logic implementation (belongs in domain/application)

## Example

```python
# api/routes/tasks.py
from fastapi import APIRouter, Depends
from server.server.application.use_cases.lock_task import LockTaskUseCase
from server.server.api.dependencies import get_lock_task_use_case

router = APIRouter(prefix="/tasks", tags=["tasks"])

@router.post("/{task_id}/lock")
def lock_task(
    task_id: str,
    use_case: LockTaskUseCase = Depends(get_lock_task_use_case)
):
    """Lock a task to make it un-deletable."""
    task = use_case.execute(task_id)
    return {"id": task.id, "locked": task.locked}
```

---

**Article IV:** This layer uses dependency injection (DIP) to wire implementations.
