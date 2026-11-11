# t3: Implement OpenSpec refactor-unused-client-state (remove unused hooks)

Status: ready (2026-09-14). APPROVED for implementation: the user approved the 2026-09-14 followup plan which explicitly includes implementing this change — record that approval in proposal.md as specified below.

Blocked by: None (base 36d564f already contains a16/a18 integration)

Source base: 36d564f (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `client/src/hooks/useTaskSyncCloud.ts` + `useTaskSyncCloud.test.tsx` (delete), `client/src/hooks/useLockEnforcement.ts` + `useLockEnforcement.test.tsx` (delete), `client/src/hooks/index.ts` (remove exports/doc lines), `client/src/hooks/README.md` (remove stale references), `client/vitest.config.ts` (coverage include set 7→6), `openspec/changes/refactor-unused-client-state/proposal.md` + `tasks.md` (approval record + task check-off).

## Behavior and acceptance

Tier3 OpenSpec change `refactor-unused-client-state` (audit finding A17). The change directory contains proposal.md, tasks.md (7 tasks), and specs/editor-agentic-ui/spec.md delta. Follow tasks.md STRICTLY in order. Summary of the change: after a fresh caller audit, delete the unused `useTaskSyncCloud` hook (hardcodes `version: 0`, drops server versions) and `useLockEnforcement` hook (local lock count never subscribes to external LockManager mutations), their tests, the lock-hook barrel export, and stale docs; keep active `useTaskSync`, LockManager context, transaction filter, editor integration. If a production caller appears during the audit: STOP and report — do not invent shared-state workarounds.

Workflow:

- [ ] 0. Update `openspec/changes/refactor-unused-client-state/proposal.md` Status line to record approval: `Approved: 2026-09-14 (user-approved followup implementation plan; implementer dispatched same day)` — keep the original "Proposed" history intact, append rather than erase. Do this in the same commit as the rest.
- [ ] 1. Fresh caller audit (tasks.md 1.x): grep ALL of client/ (src, tests, e2e, configs, scripts) for `useTaskSyncCloud` and `useLockEnforcement` imports/references. Expected: only self-references (their own files/tests, barrel export, hooks/README.md, vitest.config.ts coverage list). Anything else → STOP and report.
- [ ] 2. Delete the four hook/test files; update hooks/index.ts (remove export + doc line); update hooks/README.md (remove the stale sections referencing them — keep the doc accurate for remaining hooks).
- [ ] 3. vitest.config.ts: remove `useLockEnforcement.ts` from the fixed coverage include set (7→6 modules). Do NOT touch anything else in the config.
- [ ] 4. Check off every completed box in the change's tasks.md as you finish them (only after each is truly done).
- [ ] 5. Gates from worktree client/: `npm run lint`, `npm run format`, `npm run type-check`, `npm run test -- --coverage` — all pass; report new test-file/test counts (two test files disappear) and the 6-module aggregate LINES coverage (must be ≥80).
- [ ] 6. OpenSpec: run `~/.npm/_npx/fd5f3335045f4cd8/node_modules/.bin/openspec validate refactor-unused-client-state --strict --no-interactive` from worktree root (the npx cache binary; registry is proxied). Must pass. If that binary path fails, report instead of skipping.
- [ ] 7. `git status` shows only write-scope changes; `git diff --check` clean.

Archiving is NOT part of this ticket (main agent closes all three changes at closeout).

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, the full change directory (proposal.md → tasks.md → specs delta) BEFORE touching code. Behavior-preserving deletion only: no refactor of surviving hooks, no new abstractions, no changes to useTaskSync/LockManager/filter. Single conventional commit after all acceptance items: `refactor: remove unused cloud sync and lock enforcement hooks`. Commit with `HUSKY=0 git commit`. No push, no remote writes. Stop and retain evidence on any unexpected failure or discovered caller. Main agent is sole integrator and acceptor.
