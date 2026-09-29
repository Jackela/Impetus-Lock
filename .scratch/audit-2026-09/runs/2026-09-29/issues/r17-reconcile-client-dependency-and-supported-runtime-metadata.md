# R17: Reconcile client dependency and supported-runtime metadata

Tier: 2. Findings: F11,F12. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R11

## Allowed scope

client/package.json; client/package-lock.json; client/src/components/Task/index.ts; client/src/components/Auth/ProtectedRoute.tsx types if needed; current README/runtime guidance lines; focused metadata/compiler checks

## Pre-approved test seam

npm dependency graph/public compiler plus semver engine-boundary checks.

## Acceptance criteria

Restore declarations for existing axios and react-router-dom imports using compatible stable versions, without enabling new features or migrating existing majors. Prove usages and API compatibility; do not replace with homegrown shims or delete source to hide errors. Remove only nonexistent barrel exports after confirming no consumers; retain real components. Align supported Node range to ^22.13.0 || ^24.0.0 in package+lock+current guidance. Use own worktree node_modules if installs needed, never modify shared original node_modules. Major updates remain proposals.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
