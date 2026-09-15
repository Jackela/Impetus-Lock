# t1: Implement OpenSpec refactor-route-service-boundaries (task/template/streak)

Status: ready (2026-09-15). APPROVED for implementation: the user approved the 2026-09-14 followup plan which explicitly includes implementing this change — record that approval in proposal.md as specified below.

Blocked by: None (base 94e0226)

Source base: 94e0226 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `server/server/api/routes/tasks.py`, `server/server/api/routes/templates.py`, `server/server/api/routes/streaks.py`, `server/server/api/dependencies.py`, `server/server/application/services/` (extend `task_service.py` with NEW user-scoped methods; create `template_service.py`, `streak_service.py`), narrow repository interfaces wherever the existing repositories live (locate first: `postgresql_task_repository.py` / `in_memory_task_repository.py` and equivalents for templates/streaks — extend ONLY as needed, no speculative ports), `server/tests/**` (characterization + service tests), `openspec/changes/refactor-route-service-boundaries/proposal.md` + `tasks.md`.

## Non-negotiable design constraints (from the change's design.md — read it FIRST)

1. Routes become pure HTTP adapters: auth, request validation, schemas, and HTTP exception mapping STAY in routes. Business operations (ownership checks, version orchestration, ORM queries, streak math) delegate to injected services.
2. Every service operation takes `user_id` (user-scoped). Do NOT wire the existing unscoped `TaskService.get_task/list_tasks/...` methods into routes — ADD new scoped, route-compatible methods instead.
3. ORM behind narrow repository interfaces — only the operations the services need.
4. EXTERNAL CONTRACT FROZEN: paths, methods, request/response fields, version headers/fields, pagination shape, status codes, streak calculation math — all byte-for-byte preserved. The streak grace/recovery rule discrepancy between the streaks spec and current behavior stays EXPLICIT and un-amended (do not touch that spec).
5. No double-commit: transaction boundaries keep their current semantics; an absent optional DB session preserves the current per-table outcomes exactly.
6. TDD: characterization tests FIRST (phase 1) pinning current behavior of all endpoints incl. edge cases (404s, ownership denials, version conflicts, pagination bounds, streak date logic); they must pass UNCHANGED before and after the refactor.

## Behavior and acceptance (follow openspec/changes/refactor-route-service-boundaries/tasks.md in order)

- [ ] 0. Append approval record to proposal.md Status (keep history): `Approved: 2026-09-15 (user-approved followup implementation plan; implementer dispatched same day)`.
- [ ] 1.x Characterization (RED-first where adding new coverage): API-level tests for every task/template/streak endpoint asserting current paths/methods/fields/versions/pagination/status codes incl. error paths; plus direct unit tests of current route-embedded logic where practical. These tests are the refactor's safety net — they must not be modified in phase 2.
- [ ] 2.x Service extraction: new `TemplateService` + `StreakService` (they do not exist yet); `TaskService` gains scoped methods; narrow repo interfaces; `dependencies.py` wires factories; the three route files shrink to adapter logic. Existing unscoped TaskService methods remain untouched (still used elsewhere or dead — do not delete, do not rewire their callers).
- [ ] 3.x Verification: full server gates green — `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports` (3 contracts kept), `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub" --cov=server --cov-report=term`, `poetry run coverage report --rcfile=coverage-critical.ini` ≥80 (note: routes/tasks.py is IN the 15-file critical set — keep it covered). OpenSpec: `~/.npm/_npx/fd5f3335045f4cd8/node_modules/.bin/openspec validate refactor-route-service-boundaries --strict --no-interactive` passes. Check off tasks.md as completed.
- [ ] `git status` only write-scope files; `git diff --check` clean. Single conventional commit after all GREEN: `refactor: delegate task template streak routes to user-scoped services`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, the FULL change directory (proposal → design → tasks → 3 spec deltas), the three route files, task_service.py, dependencies.py, and the existing repository interfaces BEFORE writing anything. No alembic, no live LLM calls, no Playwright, no push, no remote writes, no changes outside write scope. Stop and retain evidence on unexpected failure; if a frozen-contract element cannot be preserved, STOP and report instead of adapting the contract. Main agent is sole integrator and acceptor.
