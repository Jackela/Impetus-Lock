## 1. Implementation
- [x] 1.1 Update `scripts/dev-start.sh` to provision/reuse the `impetus-lock-postgres` Docker container (localhost:5432, postgres/postgres) and export fallback env vars (`DATABASE_URL`, `LLM_ALLOW_DEBUG_PROVIDER`, `LLM_DEFAULT_PROVIDER`, placeholder `OPENAI_API_KEY`).
- [x] 1.2 Force backend port 8000, add opt-out env flags (`AUTO_START_FRONTEND`, `AUTO_START_POSTGRES`), and persist PID files for both processes so headless runs can manage them.
- [x] 1.3 Run `poetry run alembic upgrade head` every startup and fail fast if migrations cannot run; ensure Playwright helpers can skip Vite by setting `AUTO_START_FRONTEND=0`.
- [x] 1.4 Update `.gitignore` (or equivalent) to ignore `.backend.pid`/`.frontend.pid` artifacts.

## 2. Validation
- [x] 2.1 `./scripts/dev-start.sh` boots backend+frontend; verify `/health` responds and tables exist (psql `\dt`).
- [x] 2.2 `AUTO_START_FRONTEND=0 ./scripts/dev-start.sh` followed by `cd client && VITE_API_URL=http://127.0.0.1:8000 npx playwright test e2e/database-persistence.spec.ts --project=chromium --workers=1` passes.
- [x] 2.3 Full suite: `AUTO_START_FRONTEND=0 ./scripts/dev-start.sh` then `cd client && VITE_API_URL=http://127.0.0.1:8000 npx playwright test` completes with ≥79 passed and 0 new failures.
