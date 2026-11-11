# 04: Publish idempotent success only after persistence commits

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: None

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: server/server/api/routes/intervention.py; new server/tests/test_intervention_commit_cache.py

## Behavior and acceptance

A08. Keep HTTP contract,15-second cache and no-session behavior. Move success cache publication after successful applicable session commit.

- [x] Two same-key HTTP requests with failing DB commit both return500 and rollback, never phantom200 (baseline fails on second).
- [x] Successful commit then same-key retry returns cached response and does not persist/generate twice.
- [x] With no session, successful response still caches.
- [x] Both handled commit exception types RuntimeError and OperationalError covered.
- [x] Backend gates pass.
      Test seam: minimal FastAPI app mounting actual router, real InterventionService + real AsyncIdempotencyCache; dependency overrides only external LLM/DB boundaries, no mocking internal service/cache. Use actual provider registry with a deterministic debug provider where possible. `poetry run pytest tests/test_intervention_commit_cache.py`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.

## Evidence retention correction

The file named `red-04.log` was overwritten with a GREEN run. The integrator reproduced the unchanged committed regression tests against archived baseline `aad9a2a` in a temporary directory: RuntimeError and OperationalError both return `[500, 200]` instead of `[500, 500]` (2 failed, 2 passed). New raw log: git common dir `audit-2026-09/04-red-reproduced.log`. This proves the baseline defect; it is a later reproduction, not the lost original chronological log. Final integrated gates provide fresh GREEN output.
