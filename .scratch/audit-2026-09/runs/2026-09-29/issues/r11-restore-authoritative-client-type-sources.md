# R11: Restore authoritative client type sources

Tier: 2. Findings: F02,F03. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

None

## Allowed scope

client/src/vite.d.ts; client/src/types/api.generated.ts; client/package.json; client/package-lock.json; minimal OpenAPI export/generation/check scripts; focused schema drift check tests

## Pre-approved test seam

Compiler public app configuration and deterministic offline server app.openapi() -> openapi-typescript generation/drift check.

## Acceptance criteria

Remove library-shadowing ambient declaration and use actual TanStack public types. Regenerate components/path types from current FastAPI OpenAPI including task metadata and required anchor/source/issued_at. Preserve existing components interface consumption and adapt operation aliases only where generation requires. Record exact generator version and repeatable check mode; do not hand-edit generated types. No server API changes. Generator/tool metadata repair is allowed; no major migration.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
