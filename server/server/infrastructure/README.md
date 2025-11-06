# Infrastructure Layer

**Purpose:** Implementations of domain interfaces for external systems.

## Structure

```
infrastructure/
├── persistence/  # Database implementations
├── external/     # External API clients (e.g., OpenAI)
├── messaging/    # Message queues
└── filesystem/   # File storage
```

## Rules

✅ **Allowed:**
- Import from `domain/` and `application/`
- Implement repository interfaces
- Use external libraries (SQLAlchemy, httpx, etc.)

❌ **Forbidden:**
- Import from `api/`
- HTTP request/response handling

## Example

```python
# infrastructure/persistence/in_memory_task_repository.py
from server.server.domain.entities.task import Task
from server.server.domain.repositories.task_repository import ITaskRepository

class InMemoryTaskRepository(ITaskRepository):
    """In-memory implementation (for MVP)."""
    
    def __init__(self):
        self._tasks: dict[str, Task] = {}
    
    def get_by_id(self, task_id: str) -> Task:
        if task_id not in self._tasks:
            raise ValueError(f"Task {task_id} not found")
        return self._tasks[task_id]
    
    def save(self, task: Task) -> None:
        self._tasks[task.id] = task
```

---

**Article IV:** This layer implements interfaces defined in domain (DIP).
