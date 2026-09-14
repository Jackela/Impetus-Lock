# 06: Enforce >=80% coverage for fixed lock-critical paths

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: 01,02,03,04,05

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: client/vitest.config.ts, client/package.json if script needed, focused client tests; server critical coverage config/check test, .github/workflows/ci.yml and ci-client.yml; no changes to production behavior

## Behavior and acceptance

A10. Baseline measured; aggregate critical-path LINE coverage threshold80 (report statement/branch/function too, do not invent additional80 thresholds). Exclude tests from coverage. Do not lower global25 threshold, skip tests, omit unimported included files, or shrink the following scope to pass.
Backend exact files (relative server cwd):

- `server/application/services/intervention_service.py`
- `server/domain/models/intervention.py`
- `server/domain/models/anchor.py`
- `server/domain/text_window.py`
- `server/infrastructure/llm/base_provider.py`
- `server/infrastructure/llm/debug_provider.py`
- `server/api/routes/intervention.py`
- `server/infrastructure/cache/idempotency_cache.py`
- `server/domain/entities/task.py`
- `server/domain/entities/intervention_action.py`
- `server/infrastructure/persistence/postgresql_task_repository.py`
- `server/infrastructure/persistence/in_memory_task_repository.py`
- `server/infrastructure/persistence/models.py`
- `server/models/task.py`
- `server/api/routes/tasks.py`
  Frontend exact modules: src/services/LockManager.ts, src/components/Editor/TransactionFilter.ts, src/services/ContentInjector.ts, src/hooks/useLockEnforcement.ts, src/utils/prosemirror-helpers.ts, src/utils/textRange.ts, and src/utils/editorMarkdown.ts introduced in05. EditorCore callbacks get real regression coverage in05; report overall EditorCore coverage separately rather than count unrelated toolbar/timers as lock enforcement.
- [x] A focused regression check first fails because critical config/threshold missing; public coverage runner/config contract verifies low aggregate fails and >=80 succeeds (synthetic temporary coverage data allowed, no production mutation).
- [x] Run all existing tests with coverage, report fixed source set, add meaningful public behavior tests for uncovered paths until line aggregate>=80 in each layer; no tautological onReject calls.
- [x] CI main backend-tests collects all tests' coverage and applies same backend scope/threshold; CI client uses same threshold. Server split unit-only jobs must not falsely claim full-path threshold.
- [x] Backend and frontend gates pass. Per-file uncovered areas remain visible.
      Test seams: real ProseMirror transactions in ContentInjector/filter; renderHook with actual LockManagerProvider for hook-owned operations (external-manager subscription is separate Tier3); coverage report CLI exit status using real coverage data. Main pins exact new helper path after05 before dispatch. Test-writer only writes focused config RED test first; implementer adds config then remaining coverage tests in RED/GREEN slices.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.

## Integrator dispatch details

Dependency workspace06 parent is56a1dfb (01-05 applied for dependent work, pending independent review). Use server/coverage-critical.ini for the separate backend report configuration; keep existing global25 gate intact. Public report regression uses temporary actual source/coverage data at50% and100%, asserting effective critical report rejects50 but accepts100. Before new config exists the regression uses current pyproject25 threshold, so baseline50 mistakenly succeeds and produces meaningful RED. Frontend fixed seven files (including editorMarkdown) measured69.02% line coverage with unimported hook included.
