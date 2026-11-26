# API Layer

FastAPI routes handle HTTP requests, authentication, response schemas, and HTTP errors. They delegate ownership, optimistic version checks, and persistence to application services.

| Path                               | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| [routes/](routes/)                 | HTTP route handlers                   |
| [schemas/](schemas/)               | Pydantic request and response schemas |
| [dependencies.py](dependencies.py) | FastAPI dependency wiring             |
| [main.py](main.py)                 | FastAPI app and mounted routers       |

For example, [GET /tasks/](routes/tasks.py) injects the current user and the result of `get_task_service`, then calls `TaskService.list_tasks_for_user` with that user's ID and the requested pagination.

Run this from `server/` to inspect the route and dependency.

```bash
poetry run python - <<'PY'
from server.api.dependencies import get_task_service
from server.api.main import app
from server.application.services.task_service import TaskService

assert callable(get_task_service)
assert hasattr(TaskService, "list_tasks_for_user")
print(app.openapi()["paths"]["/tasks/"]["get"]["operationId"])
PY
```

See the [HTTP API contract](../../../API_CONTRACT.md) for the task update path and the [architecture guards](../../../ARCHITECTURE_GUARDS.md) for enforced import rules.
