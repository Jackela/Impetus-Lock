# Development Guide

**Impetus Lock** — local workflow for the React/Vite frontend, FastAPI backend, and WeChat mini program.

`AGENTS.md` is the authority for precedence, protected files, task routing, and quality gates. The [workflow table](AGENTS.md#quality-gates) identifies the source for each check.

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

The startup helper supervises services it starts in this checkout. To reuse
an existing PostgreSQL service, explicitly set `AUTO_START_POSTGRES=0` and
`DATABASE_URL` when running `./scripts/dev-start.sh`. `AUTO_START_FRONTEND=0`
starts the backend without Vite. A normal stop retains the database.
Use `./scripts/dev-stop.sh --clean` only when you want to remove this
checkout's recorded development database resources. The helper checks
ownership before stopping or removing resources.

On Windows, run the same Bash commands inside WSL. WSL was not exercised in
this review. The legacy PowerShell launcher expects an already configured,
migrated database. Native Windows one-command startup remains unverified.

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

## Web Muse/Loki model configuration

A saved browser model is sent explicitly with the writer's provider and API key.
If LLM Settings marks a saved model as retired, choose **Use recommended model**
and then **Save**. You can also enter a model ID manually. Unlock the vault first
if you keep the key encrypted.

Deployment variables `ANTHROPIC_MODEL`, `CLAUDE_MODEL` and `GEMINI_MODEL`
remain explicit pins. If an existing pin points to a retired model, update it
or remove it to use the current fallback, then restart the Web API process.
See [server environment examples](server/.env.example) for the current IDs.

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

Use hooks and contexts as the component boundary for service calls. [Architecture guards](ARCHITECTURE_GUARDS.md) records the ESLint rules and existing exceptions.

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

Run the applicable [local gates](AGENTS.md#quality-gates) before opening a PR.
If a check fails outside your scope, follow
[the handoff instructions](AGENTS.md#delivery-evidence-and-stop-conditions).

## CI and local CI

Use the [workflow table and local commands](AGENTS.md#quality-gates) to select
checks. The [branch protection record](docs/BRANCH-PROTECTION-SETUP.md) links
the live merge-check configuration.

Act CLI:

```bash
./scripts/act-sync.sh act -j e2e -W .github/workflows/e2e.yml --artifact-server-path /tmp/act-artifacts
```

The helper mirrors the repo to `$HOME/impetus-lock-act`, exports `ACT_WORKSPACE_BASE` / `ACT_CACHE_DIR`, and avoids port conflicts with the local PostgreSQL container.

## Testing

See [TESTING.md](TESTING.md) for suite layout, setup, thresholds and links to revision-specific evidence.

## OpenSpec

New behavior, public API, schema, architecture, or dependency changes require an approved OpenSpec change. For bugs that restore intended behavior, write the failing test first and fix directly. Read `openspec/AGENTS.md` before creating or applying a proposal.

From the repository root, list open changes and inspect the named change
under `openspec/changes/`.

```bash
npm exec --yes --package=@fission-ai/openspec@1.16.1 -- openspec list
```

Check its proposal, task checklist and approval record. Use the linked
PR, CI run and deployment evidence to establish those statuses.

## Troubleshooting

**`poetry: command not found`**

```bash
python -m pip install --user pipx && python -m pipx ensurepath
pipx install "poetry==2.5.1"
```

**Port already in use** — use `lsof -i :8000` or `lsof -i :5173` to
identify the listener. Run `./scripts/dev-stop.sh` for this checkout's services.
For another listener, choose another port or have its owner stop it.

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
