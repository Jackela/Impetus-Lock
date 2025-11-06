# Application Layer

**Purpose:** Use cases and application services orchestrating business logic.

## Structure

```
application/
├── use_cases/   # Business use cases (e.g., LockTaskUseCase)
├── services/    # Application services
└── dtos/        # Data Transfer Objects
```

## Rules

✅ **Allowed:**
- Import from `domain/`
- Use repository interfaces
- Orchestrate business logic

❌ **Forbidden:**
- FastAPI dependencies
- Direct database access
- HTTP request/response handling

## Example

```python
# application/use_cases/lock_task.py
from server.server.domain.entities.task import Task
from server.server.domain.repositories.task_repository import ITaskRepository

class LockTaskUseCase:
    """Use case: Lock a task to make it un-deletable."""
    
    def __init__(self, task_repo: ITaskRepository):
        self.task_repo = task_repo
    
    def execute(self, task_id: str) -> Task:
        task = self.task_repo.get_by_id(task_id)
        task.lock()  # Core business logic in domain
        self.task_repo.save(task)
        return task
```

---

**Article IV:** This layer uses DIP to depend on abstractions (interfaces).
