# 02: Issue distinct lock IDs for same-clock debug interventions

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: None

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: server/server/infrastructure/llm/debug_provider.py; new server/tests/test_debug_provider_identity.py

## Behavior and acceptance

A06; OpenSpec agentic-interventions Unique Lock Identifiers. Replace timestamp uniqueness with UUID, retain lock*debug*<mode> readable prefix. Do not change action semantics or unrelated identifiers.

- [x] Freeze provider clock, invoke public generate_intervention twice in same mode/time, lock IDs differ (baseline deterministically fails).
- [x] Responses remain valid provoke actions with same source/content/anchor behavior and issued_at.
- [x] Provider public methods touched have docstrings.
- [x] Backend gates pass.
      Test seam: public DebugLLMProvider.generate_intervention, only external clock mocked; `poetry run pytest tests/test_debug_provider_identity.py`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.
