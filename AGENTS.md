<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Precedence

When sources conflict, resolve in this order:

1. This file (`AGENTS.md`).
2. [`openspec/AGENTS.md`](openspec/AGENTS.md) — proposal/approval workflow.
3. [`CONTEXT.md`](CONTEXT.md) — current product and architecture context.
4. `docs/agents/*` — agent-facing role and task notes.
5. Everything else is **historical evidence, not current status**: the rest of `docs/`, `.zcode/plans/`, `.scratch/`, `docs/archive/`.

Explicitly **retired** (kept only as history, never as instructions):

- The prompt in `server/.claude/ralph-loop.local.md` (now `active: false`).
- The "merge automatically once CI is green" rule in `docs/AI-OPERATION-GUIDELINES.md`. Human approval remains mandatory for merge and release.
- Root `prd.json` (moved to `docs/archive/2026-11/prd.json`).
- `.claude/claude-backup/` (removed; it held stale hooks and the only `run-ci` command, now replaced by the Quality gates below).

# Quality gates

`.github/workflows/ci.yml` is the single authority. Run the same commands locally, from the stated directory.

Backend (in `server/`):

```bash
poetry run ruff check .
poetry run pydocstyle server/
poetry run ruff format --check
poetry run lint-imports
poetry run mypy .
poetry run pytest tests/ --cov=server --cov-report=term-missing -n auto
poetry run python check_critical_coverage.py
```

Frontend (in `client/`):

```bash
npm run lint
npm run format
npm run type-check
npm run api:check
npm run test -- --coverage
npm run build
npm run test:e2e:ci-like   # when a user flow changes
npm run test:e2e:auth      # when authentication changes
```

Never buy a green result: do not add eslint/ruff/mypy ignore directives, do not use `--no-verify`, do not skip or `xfail` tests to get past a failure, do not lower coverage thresholds or the critical-path set, and do not edit gate configuration (workflow files, linter configs, coverage configs) to make a check pass. A failing gate is fixed or reported.

# File boundaries

P1 lock core — changing any of these requires a failing test first and extra review:

- Frontend: `client/src/components/Editor/TransactionFilter.ts`, `client/src/services/ContentInjector.ts`, `client/src/services/LockManager.ts`, `client/src/components/Editor/LockDecorations.ts`, `client/src/utils/prosemirror-helpers*.ts`, `client/src/contexts/LockManagerContext.tsx`, `client/src/styles/locked-content.css`.
- Backend: `server/server/application/services/task_service.py` (lock persistence) and `server/server/api/routes/tasks.py`.

Layering:

- Backend dependency direction is `api → application → domain`; enforced by `poetry run lint-imports`.
- Frontend: `components` must not import `features` (`components ✗→ features`) and must not import `services` (`components ✗→ services`); enforced by ESLint `no-restricted-imports`.

Read-only (do not edit in the course of a feature change):

- `openspec/specs/**` — current truth; changed only through an archived OpenSpec change.
- `.github/workflows/**` — gate authority; changes need their own approved scope.
- `docs/archive/**` and `.scratch/**` — evidence. Never edit or delete to make a report look better.

# Prohibited

- Changing behavior, architecture, public API, schema, or dependencies without an approved OpenSpec proposal.
- Altering anything under `.scratch/` — it is evidence, not working state.
- Committing `.env*`, secrets, API keys or cookies.
- Running `git reset --hard`, `git clean`, or `rm -rf` against paths you did not create.
- Deleting worktrees, branches, or uncommitted work you were not explicitly authorized to remove.
- Presenting a local pass, green CI, or a merged PR as a deployment or as user acceptance.

# Task routing

| Request                                                    | Route                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Bug / regression restoring intended behavior               | Fix directly, writing the failing test first                |
| New behavior, API, schema, architecture, or new dependency | OpenSpec Stage 1; stop before implementation until approved |
| Docs, formatting, comments only                            | Change directly                                             |
| Tests for behavior that already exists                     | Change directly                                             |
| Ambiguous scope                                            | Treat as a proposal (the safer default)                     |

# Delivery evidence and Stop conditions

Every delivery report states:

- base SHA and head SHA, and the branch name;
- each command executed with its result;
- failures observed;
- checks not run, and why;
- critical coverage numbers;
- environments not verified (real browser, real provider, isolated database, CI runner, deployment).

Stop and write `.scratch/<date>-<topic>/handoff.md` instead of guessing when:

- the work needs an unapproved proposal;
- a gate fails for a reason outside your scope;
- you need credentials, a real model provider, or a browser you cannot launch.

# Current AI working agreement

Read [CONTEXT.md](CONTEXT.md), [DEVELOPMENT.md](DEVELOPMENT.md), and the applicable OpenSpec requirement before changing behavior. This file is the shared entry for all coding agents; CLAUDE.md points here. Historical sprint reports are evidence, not current status.

- Work from the triggering commit on an isolated branch; preserve other worktrees and uncommitted work.
- Restore specified behavior directly for bugs. New behavior or architecture needs an approved OpenSpec proposal; existing approval remains valid within its scope.
- Keep changes simple and framework native. Reserve P1 for lock enforcement; write a failing test before changing critical behavior.
- Preserve component → hook → service boundaries and backend API → application → domain contracts. Keep public JSDoc and Python docstrings. Never commit credentials or local investigation records.
- AI-first maintenance means executable checks and structured source are authoritative; use reproducible scripts and APIs for repeatable work. Human review still owns significant product decisions and release approval.
- Run frontend lint, formatting, full type checks, tests/critical coverage and build; run backend Ruff, pydocstyle, mypy, import contracts and tests/critical coverage as defined by current package files and CI. Do not disable gates to obtain green results. Validate changed workflow syntax with actionlint.
- Authentication acceptance uses real cookies/CSRF and a normal browser against isolated data. Test bypasses or disabled browser security cannot prove acceptance. Stub paid model requests at the test boundary.
- Report source/base/head SHAs, executed checks, observed failures and specific unverified environments. A local pass or merged PR is not deployment or user acceptance.

The original constitutional requirements and sprint notes are retained in [the historical guide](docs/archive/CLAUDE-2025.md). Their simplicity, critical-path testing, architecture and documentation constraints remain effective; the five-day schedule and dated status sections do not describe the current project.
