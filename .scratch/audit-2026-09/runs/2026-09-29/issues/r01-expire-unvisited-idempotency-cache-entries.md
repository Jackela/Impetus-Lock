# R01: Expire unvisited idempotency cache entries

Tier: 2. Findings: B04. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

None

## Allowed scope

server/server/infrastructure/cache/idempotency_cache.py; server/tests/test_idempotency_cache.py

## Pre-approved test seam

Public AsyncIdempotencyCache set/get/cleanup_expired with controlled time.

## Acceptance criteria

After TTL, writing a fresh key automatically releases obsolete entries even if never read again. Still-live keys and replacement expiry survive. TTL boundary remains documented. No new background service/dependency. Use public cleanup return to prove stale entries were already removed instead of asserting private dict layout.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
