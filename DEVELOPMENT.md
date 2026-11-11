# Development Guide

**Impetus Lock** — local workflow for the React/Vite frontend and FastAPI backend.

`AGENTS.md` is the authority for precedence, protected files, task routing, and quality gates. This guide is the practical local path; `.github/workflows/ci.yml` is the gate implementation.

## Prerequisites

- Python 3.11+ (CI uses 3.12; `.python-version` pins 3.12 for local tooling)
- [Poetry](https://python-poetry.org/) 2.5.1 (matches `server/poetry.lock`)
- Node.js 22.13+ or 24.x (`.nvmrc` pins 24)
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
