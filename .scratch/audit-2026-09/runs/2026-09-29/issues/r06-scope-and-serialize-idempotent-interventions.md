# R06: Scope and serialize idempotent interventions

Tier: 2. Findings: B01,B03. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R01, R05

## Allowed scope

server/server/api/routes/intervention.py; server/server/infrastructure/cache/idempotency_cache.py; focused intervention/cache tests

## Pre-approved test seam

Concurrent real ASGI router/service/cache requests with a boundary provider and controlled persistence barrier.

## Acceptance criteria

Effective cache/flight identity includes authenticated user and optional task. Within that scope same Idempotency-Key retains the existing first-result retry semantics for15s, including changed payload/provider headers; do not invent a new409 conflict contract. Different users/tasks never reuse responses. Concurrent identical effective keys generate and commit once. Publish only after successful commit. Generation/commit failure or cancellation releases the flight so retry works; different keys are not globally serialized. Never store raw BYOK keys. Single-process guarantee only; shared-store/distributed semantics belong in proposal.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
