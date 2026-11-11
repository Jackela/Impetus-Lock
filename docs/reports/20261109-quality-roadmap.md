# 2026-11-09 Quality Roadmap Delivery Report

> Branch: `codex/quality-roadmap-20261109`
> Base: `b9df4c6` · Head: `79f8d76` · 13 commits (this report adds one more)
> Local work only. Not pushed, not merged, not deployed.

## Scope delivered

### 1. Governance and documentation

- Added precedence, quality gates, file boundaries, prohibited actions, task routing, and delivery-evidence rules to `AGENTS.md`.
- Retired the stale `ralph-loop` prompt (`active: false`), the auto-merge policy, root `prd.json` (moved to `docs/archive/2026-11/`), and `.claude/claude-backup/`.
- Corrected architecture/API/changelog/spec drift, including the 3-contract import-linter reality, current metric names, `lock_id` anchor status, and the retired Revert Token.
- Archived `complete-authenticated-editor-entry` and merged its five requirements into `openspec/specs/editor-agentic-ui/spec.md`.

### 2. Dead code, dependencies, repository hygiene

- Removed the parallel `Task/` and `Toast/` trees, orphaned style-history/comparison UI, simple editor, demo component, and protected-route stub.
- Removed `react-router-dom`, `recharts`, `ffmpeg-static`, and `openapi-typescript-codegen`.
- Added `.scratch/`, `.dsh-code-index/`, `.commandcode/`, `.zcode/`, `client/audit-screenshots/`, and `client/e2e-results/` to `.gitignore`; stopped tracking the already-ignored evidence/screenshot paths.
- Moved Windows helper scripts under `scripts/windows/`.

### 3. Backend safety and data loop

- Fixed rate limiting to match `/impetus/generate-intervention`; added 429 + `Retry-After` coverage and an explicit fail-open warning when Redis is unavailable.
- Replaced four stale authentication skips with real 401/404 assertions.
- Removed the fake `/stats/period/{period}` route and the legacy non-user-scoped `TaskService` methods, including the `limit=10000` count landmine.
- Editor now sends `X-Task-Id`, closing the intervention-history loop; production builds no longer expose window test hooks; four unique audio assets are loaded once for six actions.

### 4. UI shell and accessibility

- Converged the header to a transport bar: brand + waveform, mode control, status signal, and one overflow menu; DEV-only triggers are gated.
- Made sidebar error and empty states mutually exclusive with Retry/Create actions.
- Turned the mobile sidebar into a dismissible sheet with an inert backdrop.
- Added `Button`, `IconButton`, `Modal`, and inline SVG icon primitives; styled Stats and Achievements; removed the legacy purple/light-theme fallbacks.
- Raised muted text contrast, unified icon language, and added overlay background isolation, scroll lock, and level-aware Escape handling.

### 5. Performance and CI

- Lazy-loaded Export, Style Learning, LLM settings, Stats, and Achievements; jsPDF and html2canvas now load only on export.
- Main JS chunk: **1,527.14 kB → 916.39 kB** (gzip **464.10 kB → 285.34 kB**), with separate chunks for Export/Style/LLM/Stats/Achievements.
- `ci.yml` is the single PR/push gate; `ci-client.yml` and `ci-server.yml` are dispatch-only debug entry points.
- Python 3.12 and Playwright 1.64.1 aligned; Muse/Loki story E2E added; exploratory specs isolated under `client/e2e/manual/`.
- Frontend coverage now covers `src/**` with a 45% floor plus the 80% critical-file floor; backend coverage floor raised to 60%; CI validates API types and OpenSpec.

### 6. Proposals (not implemented)

- `2026-11-09-retire-or-wire-style-history-ui`
- `2026-11-09-collaboration-scope-decision`
- `2026-11-09-real-chinese-writing-eval`
- `2026-11-09-recovery-ui-decomposition`

## Commands and results

| Check                                                     | Result                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `poetry run ruff check .`                                 | PASS                                                                              |
| `poetry run pydocstyle server/`                           | PASS                                                                              |
| `poetry run ruff format --check`                          | PASS (220 files)                                                                  |
| `poetry run lint-imports`                                 | PASS (3 contracts kept)                                                           |
| `poetry run mypy .`                                       | PASS (107 source files)                                                           |
| `poetry run pytest tests/ -n auto --cov=server`           | **910 passed, 0 skipped**; total coverage **82.03%**                              |
| `poetry run python check_critical_coverage.py`            | **96.00% total**; `postgresql_task_repository.py` **100%**                        |
| `npm run lint`                                            | PASS, 0 warnings                                                                  |
| `npm run format`                                          | PASS                                                                              |
| `npm run type-check`                                      | PASS (3 tsconfigs)                                                                |
| `npm run api:check`                                       | PASS after regeneration                                                           |
| `npm run test -- --coverage`                              | **997 passed, 4 skipped**; 97.83% stmts / 94.24% branch / 96% funcs / 97.7% lines |
| `npm run build`                                           | PASS, multi-chunk                                                                 |
| `npm run test:e2e:ci-like`                                | **111 passed, 6 skipped** (default Chromium suite)                                |
| `scripts/run-auth-e2e.py`                                 | **29 passed** (real cookies/CSRF, isolated PostgreSQL)                            |
| `scripts/run-story-e2e.py`                                | **11 passed** (Muse/Loki real-cookie story)                                       |
| `npx @fission-ai/openspec@1.16.1 validate --all --strict` | **21 passed, 0 failed**                                                           |
| `actionlint .github/workflows/*.yml`                      | PASS                                                                              |
| `git diff --check`                                        | PASS                                                                              |

## Failures and unverified environments

- PostgreSQL 16 and Redis 7 were provisioned as ephemeral containers on non-default ports. Migrations ran cleanly, the Postgres-only tests and critical coverage passed, and both containers were removed after the run.
- Playwright Chromium was installed for the run. The main suite, real-auth suite, and Muse/Loki story suite all passed; the 6 skips are pre-existing `test.skip` cases.
- **Visual review**: no manual side-by-side screenshot review was performed. Screenshots and traces were produced during the run under `client/test-results/` and `client/playwright-report/` and removed afterward as regenerable artifacts.
- **GitHub Actions was not run**; `actionlint`, YAML parsing, and the local equivalents passed, but remote CI behavior is unverified.
- **TaskList snapshot locale**: snapshots assume `en_US`; run tests with `LC_ALL=en_US.UTF-8` on this machine.
- The branch is local-only: not pushed, not merged, not deployed. A local pass is not release evidence.

## Environment cleanup

- PostgreSQL 16 (`127.0.0.1:55432`) and Redis 7 (`127.0.0.1:56379`) ran as ephemeral containers; both were stopped and removed.
- The Colima VM created for this run was stopped and deleted, including its 20 GiB sparse data disk.
- The temporary `server/.venv` symlink used by the story/auth runners was removed; Poetry's cached environment and `node_modules` were kept for normal development.
- `client/test-results/`, `client/playwright-report/`, `client/dist/`, and temporary logs were removed.
- Playwright's Chromium cache was kept so future E2E runs do not re-download the browser.

## Commit list

```
60942c1 chore(governance): align agent instructions and archive auth change
373d908 refactor(client): remove dead code and unused dependencies
5ab549f fix(server): correct rate limiting and stale authorization tests
fa32646 feat(editor): persist intervention history and gate test hooks
ab8a43d chore(repo): stop tracking local evidence and screenshot artifacts
0e300f0 feat(ui): rebuild shell hierarchy, states, and accessibility
f45ce1d perf(client): split deferred panels and reduce render fan-out
4864ff5 ci: make ci.yml the single gate and add story e2e
22c8d38 docs(openspec): add quality roadmap proposals
5a4c2ca chore(client): regenerate API types after removing stats-period route
c252ea5 docs: record the quality roadmap delivery evidence
d967357 fix(ui): keep expired-session status copy as Writing locally
79f8d76 test(e2e): drive header actions through the overflow menu
```
