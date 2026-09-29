# R12: Preserve task mutation callbacks

Tier: 2. Findings: F05. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

R11

## Allowed scope

client/src/hooks/useCreateTask.ts; client/src/hooks/useTasks.ts; client/src/hooks/useCreateTask.test.tsx; client/src/components/CreateTaskModal/CreateTaskModal.test.tsx; narrowly related query hook tests

## Pre-approved test seam

Actual QueryClientProvider/useCreateTask/modal with fetch boundary; public refetch return contract.

## Acceptance criteria

Successful creation invokes caller callbacks, closes modal and selects new task; failure surfaces error and retains editable form. Use TanStack public mutation types and forward options, no fake hook bypass. Correct useTasks.refetch public return type using library API. Preserve existing cache invalidation and task behavior.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.

## Wave5 main scope clarification — actual creation caller

V03 confirms the original acceptance "selects new task" was tested only by a synthetic TaskCreationScreen, while App passes refetch without selecting the returned task. The existing client/tests/e2e/create-task-and-write.spec.ts describes creating a new task and writing in that task; the original ready acceptance remains unchanged. Extend allowed scope narrowly to client/src/App.tsx, client/src/AppModals.tsx and an actual App creation-flow integration test. Use the existing selection callback/state and returned task ID; preserve refetch, modal close/error behavior and current task API. No authentication/navigation platform or new product state. Test the actual App -> AppModals -> CreateTaskModal -> real mutation/fetch chain; do not inject selection into a test-only caller. Actual editor behavior tests use real ProseMirror state; unrelated network/panels may be controlled at their public boundary.
