# Change Proposal: stabilize-dev-stack-bootstrap

## Why
- FastAPI backend failed at startup because `DATABASE_URL` was unset, so `DatabaseManager` raised `ValueError` before `/health` could respond, causing the SPA to see only 500s.
- No Postgres instance or migrations were provisioned by the old `scripts/dev-start.sh`, so even manual requests hit `relation "tasks" does not exist`.
- Local developers and Playwright relied on this script, so dozens of runs failed until someone manually exported env vars, started Docker, and ran Alembic.

## What Changes
- Update the dev bootstrap flow to provision (or reuse) a local `impetus-lock-postgres` Docker container on localhost:5432 with `postgres/postgres` credentials.
- Export sane defaults for `DATABASE_URL`, LLM debug provider flags, placeholder `OPENAI_API_KEY`, and force backend port 8000 to match Playwright helpers.
- Run `poetry run alembic upgrade head` every startup so schemas exist before Uvicorn answers requests.
- Add opt-out envs (`AUTO_START_FRONTEND`, `AUTO_START_POSTGRES`) and PID cleanup so headless/test workflows can skip unneeded services.

## Impact
- Devs can run `./scripts/dev-start.sh` (or `AUTO_START_FRONTEND=0 ./scripts/dev-start.sh` for headless) and immediately have a working stack with migrations applied.
- Playwright specs regain a deterministic backend, avoiding flaky "relation does not exist"/500 regressions.
- CI parity improves because the local bootstrap sequence matches the now-green end-to-end runs.
