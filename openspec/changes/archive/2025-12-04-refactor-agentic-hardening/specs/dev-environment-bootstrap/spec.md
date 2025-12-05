## ADDED Requirements
### Requirement: Testing Mode Runs Without Postgres
The backend SHALL start in TESTING/debug mode without requiring Postgres, using an in-memory stub while preserving contract behavior.

#### Scenario: TESTING without DATABASE_URL still boots
- **GIVEN** `TESTING=1` and no `DATABASE_URL` is set
- **WHEN** the backend process starts
- **THEN** it SHALL skip Postgres initialization/migrations, use an in-memory repository, and return 200 for `/health`.

#### Scenario: Fallback path is opt-in only
- **GIVEN** `TESTING` is unset (or `0`)
- **WHEN** `./scripts/dev-start.sh` runs
- **THEN** it SHALL continue to provision Postgres and run Alembic migrations before starting Uvicorn (no silent downgrade to in-memory mode).
