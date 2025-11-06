# Domain Layer

**Purpose:** Core business logic, completely independent of external concerns.

## Structure

```
domain/
├── entities/       # Business entities (e.g., Task, User)
├── value_objects/  # Immutable value objects (e.g., TaskId, Email)
├── repositories/   # Repository interfaces (DIP)
└── events/         # Domain events
```

## Rules

✅ **Allowed:**
- Standard library imports only
- Pydantic for validation
- Type hints

❌ **Forbidden:**
- FastAPI dependencies
- Database imports (SQLAlchemy, etc.)
- External API clients
- Infrastructure code

## Example

```python
# domain/entities/task.py
from pydantic import BaseModel
from datetime import datetime

class Task(BaseModel):
    """Core Task entity - represents un-deletable locked task."""
    
    id: str
    content: str
    locked: bool
    locked_at: datetime | None
    
    def lock(self) -> None:
        """Apply un-deletable lock (core business rule)."""
        if self.locked:
            raise ValueError("Task already locked")
        self.locked = True
        self.locked_at = datetime.now()
```

---

**Article IV:** This layer embodies Dependency Inversion Principle (DIP).
