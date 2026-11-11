# Testing Guide

The authoritative gates are [`AGENTS.md`](AGENTS.md) and `.github/workflows/ci.yml`. This page describes the suite layout and the commands you will actually use.

## Test layers

| Layer                     | Location                                                        | Current shape                                          |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Backend unit              | `server/tests/unit/**` + root files marked `unit`               | 432 nodes; no real DB/HTTP                             |
| Backend integration       | `server/tests/integration/**` + root files marked `integration` | 478 nodes; API, middleware, PostgreSQL/Redis contracts |
| Backend tooling           | `server/tests/test_*` marked `tooling`                          | 49 nodes; repository scripts/coverage gates            |
| Frontend unit/integration | `client/src/**/*.test.*`, `client/tests/**`                     | 986 tests; Vitest + Testing Library                    |
| E2E main                  | `client/e2e/*.spec.ts`                                          | 115 tests; 111 pass, 4 explicit `fixme`                |
| E2E authenticated         | `client/e2e/authenticated-editor*.spec.ts`                      | Real cookies/CSRF, isolated PostgreSQL                 |
| E2E story                 | `client/e2e/muse-loki-story.spec.ts`                            | Real backend + provider boundary                       |

The 4 `fixme` cases are the unimplemented sensory-feedback flows (T066); they are annotated, not silently skipped.

## Backend

```bash
cd server

poetry run pytest tests/ -n auto                       # full suite
poetry run pytest -m unit -q -n auto                   # fast layer
poetry run pytest -m integration -q -n auto            # needs PostgreSQL/Redis
poetry run pytest -m tooling -q                        # repo tooling
poetry run pytest tests/test_tasks.py -k version       # focused
poetry run pytest --durations=25                       # slowest tests
```

Configuration (`server/pyproject.toml`):

- `asyncio_mode = "auto"`; function-scoped event loops
- `pytest-timeout` 120s per test
- `--strict-markers`, `--strict-config`, `xfail_strict`
- Branch coverage enabled; `fail_under = 78`
- Critical per-file coverage enforced by `check_critical_coverage.py` (current 94.40%)

Integration tests expect:

```bash
export DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres'
export REDIS_URL='redis://127.0.0.1:6379/0'
export REQUIRE_REDIS_TESTS=1
poetry run alembic upgrade head
```

`REQUIRE_REDIS_TESTS=1` turns the Redis contract from skip-if-absent into fail-if-absent. Do not use `TESTING=1` as evidence of real authentication; dedicated tests unset it and the authenticated E2E suite uses real cookies.

## Frontend

```bash
cd client

npm run test                 # Vitest once
npm run test:watch           # watch mode
npm run test -- --coverage   # coverage thresholds
npm run test:coverage-gate   # node:test guard over the coverage gate
```

Configuration (`client/vitest.config.ts`):

- `pool: "forks"`, per-file isolation enabled; do not disable isolation
- `clearMocks` / `restoreMocks`; setup globals are installed without `vi.stubGlobal`
- 10s test/hook timeouts
- Coverage thresholds: lines 78 / statements 77 / functions 72 / branches 75
- Six critical files require 80% lines; the custom `criticalInventory` reporter fails when a critical file disappears from the report
- CI writes `reports/vitest-junit.xml`

The performance tests in `FloatingToolbar.performance.test.tsx` always run; CI uses a wider timing budget (500ms / 1000ms) than the local contract (100ms / 500ms).

## E2E

| Command                    | Config                      | Use                                                               |
| -------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `npm run test:e2e`         | `playwright.config.ts`      | local main suite                                                  |
| `npm run test:e2e:ci`      | `playwright.config.ts`      | CI-shaped main suite                                              |
| `npm run test:e2e:ci-like` | `playwright.config.ts`      | one worker + retries, closer to CI                                |
| `npm run test:e2e:auth`    | `playwright.auth.config.ts` | real auth/CSRF, isolated data                                     |
| `npm run test:e2e:story`   | `scripts/run-story-e2e.py`  | Muse/Loki story; needs disposable `DATABASE_URL` and free `:8001` |

Key rules:

- `--strictPort` is required; a port conflict must fail, not silently drift.
- `**/*.test.mjs` is excluded from spec collection (Node test guards live next to Playwright).
- CI uses one retry; a second attempt must not hide a flaky test.
- Teardown preserves the current run's trace/screenshot/error context and prunes only artifacts older than seven days.
- Failure evidence is uploaded from `client/test-results/`; HTML/JSON/JUnit reports from `client/playwright-report/`.

See [`client/e2e/README.md`](client/e2e/README.md) for fixtures, storage state, and debugging.

## What good looks like

- A new behavior has a failing test first; a regression test names the failure mode.
- Tests assert observable behavior, not implementation details or copied logic.
- No `.only`, no silent skip, no unconditional assertions, no `waitForTimeout` when a state wait exists.
- New tests do not lower coverage or rely on execution order.
- Local passes are reported with commands and failures; they are not described as CI, deployment, or user acceptance.

## Historical material

The 2026-09 test summaries and the pre-refactor lock test package are in `docs/archive/`. They are evidence, not current instructions. The 2026-11 test-suite results are in [`docs/reports/20261111-test-suite-optimization.md`](docs/reports/20261111-test-suite-optimization.md).
