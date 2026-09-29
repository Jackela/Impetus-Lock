# R07: Make task version updates atomic

Tier: 2. Findings: B05. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

None

## Allowed scope

server/server/infrastructure/persistence/postgresql_task_repository.py; server/server/infrastructure/persistence/in_memory_task_repository.py; server/server/domain/repositories/task_repository.py; server/server/domain/errors.py; server/server/application/services/task_service.py; focused repository/service/API tests; existing backend CI job PostgreSQL test service configuration

## Pre-approved test seam

Two independent real PostgreSQL sessions on disposable per-test records and service/HTTP conflict seam; existing in-memory repository parity.

## Acceptance criteria

Two writes based on same version produce exactly one success and one version conflict with no lost update; current PUT maps to409 and winning version increments once. Legacy service methods keep their existing conflict contract. Missing task and foreign owner still404 as appropriate. Use native atomic conditional update or mapper versioning, no global process mutex/schema migration. Preserve metadata, lock IDs, title, timestamps and history. Use supplied postgres URL with unique records/schema and cleanup only test-created resources; never drop shared tables.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.

## Explicit environment handoff

The user already supplied and verified the local PostgreSQL URL: `postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres`. Use it directly for the real two-session regression (credentials are the provided local test container defaults). No user question or database setup investigation is needed. If the service genuinely fails to connect, preserve the exact failure and return; do not replace PostgreSQL acceptance with SQLite or memory. Use unique test-owned schema/records; never drop or reset shared tables. These facts apply even when DATABASE_URL is absent from the worker process environment.

## Main integration requirement

The new non-skipped PostgreSQL regression adds an actual database prerequisite. Existing backend CI has only Redis; keep the test honest and add a health-checked local PostgreSQL service to that existing job with the supplied test defaults. No remote run or new database schema is authorized. Do not skip the real PostgreSQL test to compensate for a missing CI service. Main observed this gap directly in `.github/workflows/ci.yml` backend-tests services.
