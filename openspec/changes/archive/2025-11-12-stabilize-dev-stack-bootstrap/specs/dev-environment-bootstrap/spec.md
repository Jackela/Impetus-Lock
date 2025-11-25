## ADDED Requirements
### Requirement: Dev bootstrap provisions database + schema
`scripts/dev-start.sh` MUST ensure the backend always has a running Postgres instance, populated schema, and required env vars before Uvicorn starts.

#### Scenario: Default run auto-provisions stack
- **GIVEN** a developer runs `./scripts/dev-start.sh` with no extra env vars
- **WHEN** the script executes
- **THEN** it MUST start (or reuse) a local Docker container named `impetus-lock-postgres` listening on `localhost:5432` with `postgres/postgres`
- **AND** set `DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres`, `LLM_ALLOW_DEBUG_PROVIDER=1`, `LLM_DEFAULT_PROVIDER=debug`, a placeholder `OPENAI_API_KEY`, and backend port 8000 before launching Uvicorn
- **AND** run `poetry run alembic upgrade head` so `tasks`/`intervention_actions` tables exist before serving traffic.

#### Scenario: Headless mode skips Vite but keeps backend ready
- **GIVEN** `AUTO_START_FRONTEND=0` is exported
- **WHEN** the script runs
- **THEN** it MUST skip launching the Vite dev server while still starting the backend+Postgres stack with the guarantees above
- **AND** write `.backend.pid` (and `.frontend.pid` when frontend runs) so automation can terminate processes reliably.
