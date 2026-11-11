# Contributing

Thanks for helping improve Impetus Lock. This project is pre-1.0 and prioritizes a small, testable surface over feature volume.

## Ground rules

- Read [`AGENTS.md`](AGENTS.md) first. It defines precedence, protected files, and the current quality gates.
- New behavior, public API, schema, architecture, or dependency changes require an approved OpenSpec proposal. Bug fixes that restore intended behavior can go directly, with a failing test first.
- Never commit `.env` files, API keys, cookies, or generated browser sessions.
- Do not disable, skip, or weaken a gate to make a change pass. If a gate fails outside your scope, report it instead of bypassing it.

## Setup

Prerequisites: Python 3.11+ (CI uses 3.12), Node.js 22.13+/24.x, and Docker for the local PostgreSQL helper.

```bash
cd server && poetry install
cd ../client && npm ci
cd .. && ./scripts/dev-start.sh   # PostgreSQL + backend :8000 + Vite :5173
```

`./scripts/dev-stop.sh` stops the helper services. On Windows, use `./scripts/dev-start.ps1`.

## Quality gates

The authoritative list is in [`AGENTS.md`](AGENTS.md) and `.github/workflows/ci.yml`. Run the same commands locally:

```bash
# Backend, from server/
poetry run ruff check .
poetry run pydocstyle server/
poetry run ruff format --check
poetry run lint-imports
poetry run mypy .
poetry run pytest tests/ -n auto --cov=server --cov-report=term-missing
poetry run python check_critical_coverage.py

# Frontend, from client/
npm run lint
npm run format
npm run type-check
npm run api:check
npm run test -- --coverage
npm run test:coverage-gate
npm run build
```

E2E suites are documented in [`client/e2e/README.md`](client/e2e/README.md). Use `npm run test:e2e:ci` for the CI-shaped main suite.

## Pull requests

1. Branch from `main` and keep the change focused.
2. Add or update tests for behavior changes; preserve the existing test contracts.
3. Use a conventional commit message and reference the issue or OpenSpec change.
4. In the PR body, state the user-visible change, commands run, failures observed, checks not run and why, and environments not verified.
5. A local pass or a merged PR is not deployment or user acceptance.

## Documentation

- Current product/architecture context: [`CONTEXT.md`](CONTEXT.md) and [`docs/INDEX.md`](docs/INDEX.md).
- Historical material lives under `docs/archive/` and is evidence, not current status.
- Keep documentation links valid; `docs/INDEX.md` is the map, not a second source of truth.

## Security

Do not report vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md).
