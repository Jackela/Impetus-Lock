# R18: Enable complete client type checking

Tier: 2. Findings: F01,F16,F17. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R12, R13, R14, R15, R16, R17

## Allowed scope

client/package.json; client/tsconfig*.json; client/vite.config.ts; client/vitest.config.ts; client/vitest.setup.ts; client/playwright*.ts if included; remaining client **/*.test.ts(x) and tests/** type repairs

## Pre-approved test seam

Public tsc app/tool/test configs plus an isolated known-invalid source proving command failure.

## Acceptance criteria

Zero diagnostics across application, all unit/integration tests and tooling configs. Check actual referenced projects, not empty solution root. Remove duplicate invalid Vite test configuration in favor of existing Vitest config. Include tests outside src via appropriate explicit config; do not exclude existing source, relax strict/erasable flags or use blanket assertions/ignore directives. Fix incomplete mocks by actual interface fixtures, preserving behavioral tests. CLI must fail on an isolated genuine type error and pass clean actual tree.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
