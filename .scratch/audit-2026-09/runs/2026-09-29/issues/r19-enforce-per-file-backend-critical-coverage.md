# R19: Enforce per-file backend critical coverage

Tier: 2. Findings: B12. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R05, R06, R07, R08

## Allowed scope

server/coverage-critical.ini; backend coverage gate/check script and tests; tests for base_provider/PostgreSQLTaskRepository and other below80 fixed critical files; .github/workflows existing backend coverage steps

## Pre-approved test seam

Public coverage CLI/checker with bad per-file/absent-file cases; provider and real repository interfaces.

## Acceptance criteria

Retain every existing critical file and add TaskService. Each file executable-line coverage>=80; aggregate success cannot mask a low or unmeasured file. Bad fixture with one50 and one100 must fail even if aggregate>=80; absent expected file fails. Supplement public behavior tests until each real file passes. No deleting scope, skipping executed paths or artificial no-op coverage. Existing coverage reporter remains meaningful; CI invokes new per-file guard.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
