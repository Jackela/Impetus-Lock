# Development Guide

**Impetus Lock** — local workflow for the React/Vite frontend, FastAPI backend, and WeChat mini program.

`AGENTS.md` is the authority for precedence, protected files, task routing, and quality gates. This guide is the practical local path; `.github/workflows/ci.yml` is the gate implementation.

## Prerequisites

- Python 3.15 (`.python-version`, CI and Docker); the compatibility matrix also tests 3.11 and 3.12
- [Poetry](https://python-poetry.org/) 2.5.1 (matches `server/poetry.lock`)
- Node.js 26.x (`.nvmrc`, CI and Docker); the Web client also supports 22.22.1+ within 22.x and 24.x
- Docker, only for the local PostgreSQL helper
- Optional: [Act](https://github.com/nektos/act) for local CI simulation

## Quick start

```bash
git clone <repo-url>
cd Impetus-Lock

cd server && poetry install && cd ..
cd client && npm ci && cd ..

./scripts/dev-start.sh        # PostgreSQL + backend :8000 + Vite :5173
./scripts/dev-stop.sh         # stop what the helper started
```

Windows PowerShell: `./scripts/dev-start.ps1`.

Manual startup:

```bash
export DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres'
cd server
cp .env.example .env          # edit LLM provider/keys; never commit .env
poetry run alembic upgrade head
poetry run uvicorn server.api.main:app --reload
# another terminal
cd client && npm run dev
```

The backend reads `server/.env`; Alembic reads the process `DATABASE_URL`. An exported `DATABASE_URL` wins over `.env`.

## Repository layout

```text
Impetus-Lock/
├── server/                 # FastAPI application + pytest suite
│   ├── server/             # api → application → domain + infrastructure
│   ├── tests/              # unit / integration / tooling suites
│   └── pyproject.toml      # Poetry, Ruff, mypy, pytest, coverage
├── client/                 # React 19 + Vite + Milkdown/ProseMirror
│   ├── src/                # components → hooks → services
│   ├── tests/              # shared unit/integration tests
│   ├── e2e/                # Playwright suites and helpers
│   ├── eslint.config.js    # flat ESLint config
│   └── vitest.config.ts    # unit tests + coverage thresholds
├── miniprogram/            # native WeChat pages, build scripts, and Node tests
├── .github/                # CI, security, issue/PR templates, Dependabot
├── docs/                   # current guides + archived evidence (see docs/INDEX.md)
├── openspec/               # current specs and change proposals (authority)
├── specs/                  # frozen legacy feature specs 001–007
├── scripts/                # dev-start/stop, deployment, E2E runners, evaluation
└── AGENTS.md               # working agreement and quality gates
```

## Backend development

```bash
cd server
poetry run uvicorn server.api.main:app --reload
poetry run pytest tests/ -n auto
poetry run pytest tests/unit -q -n auto
```

Write a failing test first for behavior changes. P1 lock-core files are listed in `AGENTS.md`; changing them requires a failing test and extra review. Backend dependency direction is `api → application → domain`, enforced by `poetry run lint-imports`.

## Frontend development

```bash
cd client
npm run dev
npm run test:watch
```

Respect the import boundaries: `components` must not import `features` or `services`; use hooks/contexts at the boundary. `npm run lint` enforces this.

## WeChat mini program development

To run the complete story and sharing flow with local sample identities and a local story provider, see the [local integration runner](scripts/verify-wechat-local/README.md). Its `serve` mode can also supply the API for a local Developer Tools project.

The mini program uses FastAPI. With the backend dependencies installed, start or reuse a local PostgreSQL instance and create an empty development database for the mini program. Substitute your local account, password, port, and dedicated database name below. Use the same URL for migrations and FastAPI.

```bash
cd server
export DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/impetus_lock_wechat_dev'
poetry run alembic upgrade head
poetry run alembic current
poetry run uvicorn server.api.main:app --reload
```

The migration check uses a fresh schema in a test PostgreSQL database. Run it from `server/` with `POSTGRES_TEST_URL` pointing to that database. It tests upgrade, downgrade and re-upgrade while preserving a sample Web draft and its lock.

```bash
POSTGRES_TEST_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/impetus_lock_wechat_test' \
  poetry run pytest tests/test_wechat_migration.py -q
```

Set the following FastAPI environment variables through `server/.env` or the backend process environment. Keep credentials server-side.

| Variables                                                             | Used for                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WECHAT_APP_ID`, `WECHAT_APP_SECRET`                                  | Login code exchange and checking the text of works before publication. Select the matching AppID in WeChat Developer Tools when testing with WeChat.                                                         |
| `WECHAT_SESSION_SECRET`                                               | Secret for mini program sessions, at least 32 bytes.                                                                                                                                                         |
| `WECHAT_STORY_BASE_URL`, `WECHAT_STORY_MODEL`, `WECHAT_STORY_API_KEY` | Provider endpoint prefix, model ID, and key for the story service. The server appends `/chat/completions`. The target environment needs access to a compatible provider that supports JSON-object responses. |

From the repository root, build the mini program and run its checks.

```bash
cd miniprogram
npm ci
npm run type-check
npm test
WECHAT_API_ORIGIN=http://127.0.0.1:8000 npm run build
```

Import `miniprogram/` in WeChat Developer Tools. Its `project.config.json` points to `dist/`. The build accepts `WECHAT_API_ORIGIN` as an HTTPS origin or a local HTTP loopback origin. Omit the `/api/wechat` path because the client adds it. With the variable unset, the build can show the first screen and network actions report missing configuration. Local loopback testing may require the Developer Tools domain-check override. On devices, build with the reachable HTTPS origin registered as a request domain for the AppID and keep domain checks enabled.

Build with `WECHAT_SPEECH_ENABLED=1` to include the WechatSI plugin for an authorized AppID. Leave it off to develop the story options and keyboard path without the plugin. `WECHAT_DEV_TIMINGS=1` enables local timing measurements. Use the default setting for release builds.

`npm test` simulates WeChat APIs and checks the compiled pages and client behavior. Use a real AppID, configured services, and WeChat on iOS and Android to verify identity, permissions, recording and interruption, native TXT handoff, and opening or withdrawing a card with two accounts. The milestone acceptance scenarios are in the [roadmap](ROADMAP.md). See the [product definition](PRODUCT.md), [first story walkthrough](docs/product/first-story.md), and [mini program interface](docs/product/miniapp-interface.md) for the agreed behavior.

## Quality gates

Run the full gate before opening a PR. From `server/`:

```bash
poetry run ruff check .
poetry run pydocstyle server/
poetry run ruff format --check
poetry run lint-imports
poetry run mypy .
poetry run pytest tests/ -n auto --cov=server --cov-report=term-missing
poetry run python check_critical_coverage.py
```

From `client/`:

```bash
npm run lint
npm run format
npm run type-check
npm run api:check
npm run test -- --coverage
npm run test:coverage-gate
npm run build
```

E2E when the flow changes:

```bash
npm run test:e2e:ci-like      # main suite, one worker
npm run test:e2e:ci           # CI-shaped suite
npm run test:e2e:auth         # real cookies/CSRF, isolated data
npm run test:e2e:story        # Muse/Loki story flow
```

Do not add ignore directives, lower thresholds, skip tests, or use `--no-verify` to get a green result. If a gate fails outside your scope, write `.scratch/<date>-<topic>/handoff.md` with the evidence and stop.

## CI and local CI

PR gates are defined in `.github/workflows/ci.yml` plus `e2e.yml` and `authenticated-editor.yml`:

- `Lint (Backend + Frontend)`
- `Type Check (Backend + Frontend)`
- `Backend Tests`
- `Frontend Tests`
- `Validate (API Types + OpenSpec)`
- `Playwright E2E Tests`, `Muse/Loki Story E2E`, `browser-authentication`

`Backend Tests` uses PostgreSQL/Redis services and branch coverage (floor 78%). `Frontend Tests` runs Vitest with coverage, the `node:test` coverage gate, and uploads JUnit/coverage artifacts. E2E uploads failure evidence; teardown only prunes artifacts older than seven days.

Act CLI:

```bash
./scripts/act-sync.sh act -j e2e -W .github/workflows/e2e.yml --artifact-server-path /tmp/act-artifacts
```

The helper mirrors the repo to `$HOME/impetus-lock-act`, exports `ACT_WORKSPACE_BASE` / `ACT_CACHE_DIR`, and avoids port conflicts with the local PostgreSQL container.

## Testing

See [`TESTING.md`](TESTING.md) for the test pyramid, marker layout, coverage gates, and E2E configuration. Test counts and the latest measured coverage are recorded in `docs/reports/20261111-test-suite-optimization.md`.

## OpenSpec

New behavior, public API, schema, architecture, or dependency changes require an approved OpenSpec change. For bugs that restore intended behavior, write the failing test first and fix directly. Read `openspec/AGENTS.md` before creating or applying a proposal.

## Troubleshooting

**`poetry: command not found`**

```bash
python -m pip install --user pipx && python -m pipx ensurepath
pipx install "poetry==2.5.1"
```

**Port already in use** — `./scripts/dev-stop.sh`, or stop the process shown by `lsof -i :8000` / `lsof -i :5173`.

**Playwright browsers missing**

```bash
cd client && npx playwright install --with-deps chromium
```

**Vitest hangs** — run once with `npm run test -- --run` (the default script already runs once).

**Alembic cannot connect** — export `DATABASE_URL` in the shell that runs `alembic upgrade head`; `.env` alone is not enough for migrations.

## Resources

- [`AGENTS.md`](AGENTS.md) — precedence, gates, protected files
- [`CONTEXT.md`](CONTEXT.md) — product/architecture context
- [`docs/INDEX.md`](docs/INDEX.md) — documentation map
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR workflow
- [`SECURITY.md`](SECURITY.md) — vulnerability reporting
- [`openspec/AGENTS.md`](openspec/AGENTS.md) — change proposal workflow
- [`API_CONTRACT.md`](API_CONTRACT.md), [`ARCHITECTURE_GUARDS.md`](ARCHITECTURE_GUARDS.md) — contracts and guardrails
