# R09: Enforce style profile and history ownership

Tier: 2. Findings: B10,B11. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R04

## Allowed scope

server/server/api/routes/style.py; server/server/api/routes/style_history.py; server/server/infrastructure/persistence/style_history_repository.py; directly needed style service/repository methods; focused style HTTP/repository tests

## Pre-approved test seam

Actual authenticated HTTP profile/history operations with real isolated DB and two users; public history delete outcome.

## Acceptance criteria

Authenticated identity owns profile/history reads and writes, including body/path user_id and direct history IDs. Cross-user/missing records return404 without content or mutation; unauthenticated requests401. Own create/read/update/delete remain compatible. Missing delete returns false/404, not success. Preserve public schemas/paths; do not extract the whole route service architecture (Tier3).

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
