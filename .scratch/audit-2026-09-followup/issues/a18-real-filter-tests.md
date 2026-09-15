# a18: Replace pseudo-integration onReject assertions with real TransactionFilter behavior

Status: ready (2026-09-14)

Blocked by: None

Source base: dde1138 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `client/tests/unit/LockManager.test.ts` ONLY.

## Behavior and acceptance

A18 (Tier2 test improvement). The block `describe("Transaction Filter - onReject Callback", ...)` at lines 244-312 manually invokes a locally-created `onReject` callback and asserts counters that were never wired to anything — it never touches `createLockTransactionFilter` or `TransactionFilter`. Real filter behavior is covered in `client/src/components/Editor/TransactionFilter.test.ts`, but this LockManager-side block is fake integration.

Replace the whole describe block with REAL integration tests that compose the actual pieces:

- Use the real `LockManager` (as the rest of the file does) and the real `createLockTransactionFilter` from `src/components/Editor/TransactionFilter` (study its signature and how `TransactionFilter.test.ts` builds ProseMirror editor state/schemas/transactions — reuse those construction patterns rather than inventing new ones).
- Test at integration level (LockManager ↔ filter), NOT a re-copy of TransactionFilter.test.ts unit cases:
  - A transaction deleting a node whose lockId is registered in the LockManager is blocked (filter returns false) AND the filter's `onReject` callback fires in reality (spy counter incremented by the filter itself, not by the test).
  - A transaction deleting an unlocked node passes (filter returns true, onReject NOT called).
  - If cheap to compose: lock released via LockManager afterwards permits the same deletion (proves the manager's state drives the filter).
- Delete the two pseudo tests entirely; do not leave the manual `onReject()` invocation pattern anywhere in the file.

Acceptance:

- [ ] No occurrence of manual `onReject()` invocation or never-wired counters remains in the file.
- [ ] New tests import and exercise the real `createLockTransactionFilter`; they fail if the filter stops consulting LockManager state (sanity-check by temporarily breaking the wiring, then restore).
- [ ] `npm run test -- --coverage` passes; vitest fixed-set aggregate lines coverage stays ≥80 (LockManager.ts is in the fixed set).
- [ ] `npm run lint`, `npm run format`, `npm run type-check` pass (note: lint covers src/** only, but keep the test file prettier-clean anyway).
- [ ] `git status` shows only `client/tests/unit/LockManager.test.ts`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, both test files and `src/components/Editor/TransactionFilter.ts` + `src/components/Editor/LockManager.ts` (or wherever LockManager lives — locate it) before writing. Tests-first not applicable (test-only ticket); write the new tests, run them, verify they exercise reality as specified. Single conventional commit after GREEN: `test: exercise real transaction filter in LockManager onReject tests`. Commit with `HUSKY=0 git commit`. No push, no remote writes, no production-code edits. Stop and retain evidence on unexpected failure. Main agent is sole integrator and acceptor.
