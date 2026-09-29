# R15: Repair editor library contracts without architecture migration

Tier: 2. Findings: F14. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R11

## Allowed scope

client/src/components/Editor/**; client/src/services/ContentInjector.ts; client/src/utils/prosemirror-helpers.ts; client/src/utils/textRange.ts; directly corresponding tests

## Pre-approved test seam

Explicit compiler plus real ProseMirror transaction/state/view boundaries.

## Acceptance criteria

Use correct ProseMirror imports and Plugin/$prose interfaces; fix concrete filterTransaction/DirectEditorProps misuse while preserving lock/deletion/undo filtering and raw editor behavior. Add guards for real nullable/unchecked positions, no casts hiding invalid APIs. Preserve Markdown round trip and lock markers. New editor/state architecture is out of scope. Do not alter unrelated visual design.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.
