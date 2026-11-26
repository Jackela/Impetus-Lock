# Testing Guide

[AGENTS.md](AGENTS.md#quality-gates) lists workflows and the corresponding local
checks. Each GitHub Actions run records its revision, jobs and artifacts.

## Test layers

| Layer                     | Location                                                     | Coverage                                          |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Backend unit              | `server/tests/unit/**` and files marked `unit`               | Application logic and offline provider protocols  |
| Backend integration       | `server/tests/integration/**` and files marked `integration` | API, middleware, PostgreSQL and Redis contracts   |
| Backend tooling           | Tests marked `tooling`, plus `scripts/tests/`                | Repository scripts and coverage gates             |
| Frontend unit/integration | `client/src/**/*.test.*` and `client/tests/**`               | Vitest and Testing Library                        |
| E2E main                  | `client/e2e/` via `playwright.config.ts`                     | Editor, interactions and lock enforcement         |
| E2E authenticated         | `client/e2e/` via `playwright.auth.config.ts`                | Real cookies/CSRF and isolated PostgreSQL         |
| E2E story                 | `client/e2e/muse-loki-story.spec.ts`                         | FastAPI with deterministic provider responses     |
| WeChat mini program       | `miniprogram/tests/`                                         | Compiled pages, simulated WeChat APIs and FastAPI |

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
- Critical per-file coverage enforced by `check_critical_coverage.py`

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
npm run test:runtime-metadata # runtime compatibility metadata contract
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

## WeChat mini program

Install the backend dependencies for the SQLite contract fixture. From the
repository root, run the following with the repository's Python and Node.js
versions.

```bash
(cd server && poetry install)
(cd miniprogram && npm ci && npm test && npm run test:contract)
(cd miniprogram && WECHAT_API_ORIGIN=http://127.0.0.1:8000 WECHAT_SPEECH_ENABLED=1 npm run build)
```

The [WeChat workflow](.github/workflows/wechat-miniprogram.yml) also checks the
WechatSI declaration in the built package. For the isolated PostgreSQL flow,
see the [local WeChat runner](scripts/verify-wechat-local/README.md).
Record a real AppID, plugin, device or provider check only if that environment was tested.

## Development scripts and production images

From the repository root, run
`python3 -m unittest discover -s scripts/tests -p test_dev_helpers.py -v`
to exercise local process ownership. The production job also runs
`python3 -m unittest discover -s scripts/tests -p test_deployment.py -v`.
Use the [CI production smoke job](.github/workflows/ci.yml) for the Linux build
commands and the temporary API/client image tags for the smoke and recovery
scripts. The [deployment guide](docs/guides/deployment.md) describes
the backup and rollback procedures.

## What good looks like

- A new behavior has a failing test first; a regression test names the failure mode.
- Tests assert observable behavior, not implementation details or copied logic.
- No `.only`, no silent skip, no unconditional assertions, no `waitForTimeout` when a state wait exists.
- New tests do not lower coverage or rely on execution order.
- Local passes are reported with commands and failures; they are not described as CI, deployment, or user acceptance.

## Revision-specific evidence

Compare test counts and observed coverage against the run for the exact source
commit. The baseline
[`daab9e2e7b04dcb5a75b3acdea7c1d76bb7ee516` CI run](https://github.com/Jackela/Impetus-Lock/actions/runs/45787548732)
shows backend and Web counts and coverage, and its
[E2E run](https://github.com/Jackela/Impetus-Lock/actions/runs/45787548588)
shows browser counts and results. See the [historical reports index](docs/INDEX.md#dated-reports-and-migration-records) for earlier records.
