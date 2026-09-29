# R16: Repair domain and service strict type contracts

Tier: 2. Findings: F15. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R11

## Allowed scope

client/src/types/** except api.generated.ts; client/src/services/api/* error constructors/types; client/src/services/llmKeyVault.ts and actual vault path; client/src/utils/logger.ts; client/src/hooks/useTaskStorage.ts; client/src/hooks/useLokiTimer.ts; directly related tests

## Pre-approved test seam

Explicit app compiler; existing domain guards/crypto/storage/client public tests.

## Acceptance criteria

Replace non-erasable enum/parameter-property syntax while preserving exported runtime values/API shapes; type WebCrypto inputs safely including backing buffers; correct unknown-object validation, duplicated exports, timer handles, required stored metadata and actual compiler errors within listed family. No any/nocheck or unsafe assertion sweep. Runtime changes get focused RED tests.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.

## Main review clarification: logger environment boundary

Keep LogLevel numeric forward and reverse runtime mappings. Environment severity names (case-insensitive DEBUG/INFO/WARN/ERROR/NONE) must resolve to numeric levels; unsupported values, including reverse-map keys such as the string `0`, use the existing DEBUG fallback. Do not use an unchecked keyof/Omit assertion to pretend an arbitrary environment string is a named numeric key. Verify via the public logger and console boundary using existing pristine-module test conventions; preserve namespace/level/event behavior. This is the existing logger input/type contract within F15, not a new logging architecture.
