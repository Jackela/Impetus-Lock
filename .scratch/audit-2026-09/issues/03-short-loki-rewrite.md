# 03: Apply existing short-context safeguard to Loki rewrite

Status: accepted-locally (main integrator; 2026-09-14)

Blocked by: None

Source base: b14fdb175134d8b4edd928449346f3a5426e9343; dispatch pins actual worktree parent after ticket commit.

Write scope: server/server/application/services/intervention_service.py; server/tests/test_intervention_service.py

## Behavior and acceptance

A07; OpenSpec agentic-interventions Context Sufficiency Guard. Existing delete guard behavior remains; additionally Loki rewrite with context length<50 becomes safe provoke. Muse rewrite remains allowed.

- [x] Loki rewrite at49 chars becomes provoke with nonempty content/lock and cursor position anchor (baseline fails).
- [x] Loki rewrite at50 chars remains rewrite; Muse rewrite at49 remains rewrite; existing delete protection passes.
- [x] Backend gates pass.
      Test seam: public InterventionService.generate_intervention with existing LLMProvider boundary mock; `poetry run pytest tests/test_intervention_service.py`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, relevant OpenSpec specs and installed implement/TDD skills. Tests precede production edits. Test-writer owns tests only; implementer receives reviewed RED evidence. Do not change acceptance criteria, weaken tests, expand scope, push, or mutate remote. Stop on unexpected failure and retain evidence. Main is sole integrator and acceptor.

Backend gates (server cwd): `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"`. Frontend gates (client cwd): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test`. No Playwright. Existing environments are accepted; no migrations or external LLM calls. Logs outside tracked state; single final conventional commit after GREEN.
