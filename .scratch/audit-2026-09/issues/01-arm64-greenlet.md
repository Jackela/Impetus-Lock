# 01: Ensure Poetry installs greenlet for Apple arm64

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: None

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: server/pyproject.toml, server/poetry.lock, server/.gitignore; new focused dependency contract test under server/tests

## Behavior and acceptance

A05. SQLAlchemy asyncio requires greenlet on arm64 too. Add an explicit direct greenlet requirement compatible with currently locked 3.5.5 if needed; regenerate via Poetry (no broad update or hand-edited lock). Keep Python ^3.11.

- [x] Public installation contract test evaluates effective greenlet package marker for Darwin arm64 Python3.12 and Linux x86_64 Python3.11; baseline arm64 assertion fails. Missing marker means unconditional. Use installed packaging, stdlib tomllib.
- [x] Poetry lock check passes and unrelated package versions remain unchanged.
- [x] Clean temporary Poetry environment (not baseline venv) installs from lock and imports greenlet and sqlalchemy.ext.asyncio; record interpreter path.
- [x] Backend gates pass.
      Test seam: lock installation eligibility via packaging.markers; `poetry run pytest tests/test_dependency_contract.py`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.

## Integrator correction after isolation

The baseline lock exists locally but is ignored by server/.gitignore:30 and absent from HEAD. Main copied the exact local baseline lock into this worktree for marker RED. Preserve its package versions while generating the repaired lock; remove that ignore rule and commit the lock so clean clones receive the validated installation contract. The main baseline copy is in git common dir audit-2026-09/poetry-baseline.lock. This is part of A05 reproducibility, not a broad dependency update.
