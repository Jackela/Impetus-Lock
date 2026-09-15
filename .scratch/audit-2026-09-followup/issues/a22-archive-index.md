# a22: Add reconciliation index for archived OpenSpec inconsistencies

Status: ready (2026-09-14)

Blocked by: None

Source base: dde1138 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: new file `openspec/changes/archive/README.md` ONLY. Zero modifications to any existing archive file.

## Behavior and acceptance

A22 (Tier1 records governance). Historical archived changes carry status/approval/completion inconsistencies. Decision: retain every original record verbatim — do NOT fabricate approvals, do NOT check off historical tasks, do NOT edit proposal.md/tasks.md/COMPLETION.md contents. The only permitted action is adding an index README that documents the known inconsistencies so future readers are not misled.

Create `openspec/changes/archive/README.md` (English) that:

1. Explains the archive's role (completed/retired changes; `openspec/AGENTS.md` Stage 3) and that the index below records known historical inconsistencies found by the 2026-09 audit (finding A22).
2. States explicitly: originals are preserved as-is; unchecked tasks and Draft/Proposed status lines are historical facts, not TODOs; no approval evidence has been retrofitted.
3. Lists exactly these eight directories with their specific inconsistency (VERIFY each fact against the actual files in the worktree before writing it down; if any fact differs, record what the files actually say):

| Directory | Inconsistency |
| --- | --- |
| `2025-11-09-execute-devtools-audit/` | proposal.md `**Status**: Draft` (line 4) vs COMPLETION.md claiming completed; tasks.md 12/33 checked |
| `2025-11-09-fix-intervention-api-contract/` | proposal.md `Proposed` vs COMPLETION.md "ALREADY COMPLIANT"; tasks.md 0/69 checked |
| `2025-11-09-control-muse-trigger/` | proposal.md `Proposed` vs COMPLETION.md "ALREADY COMPLIANT"; tasks.md 45/74 checked |
| `2025-11-10-fix-ux-issues/` | proposal.md `Proposed`, no COMPLETION.md at all; tasks.md 33/79 checked |
| `2025-04-09-sprint-1-user-auth/` | inverse mismatch: proposal claims COMPLETE, all tasks say `Status: pending` (0/24) |
| `2025-04-09-add-task-persistence/` | proposal `Proposed`, no tasks.md, no completion record |
| `2025-04-09-team-setup/` | not a change structure: planning docs only, no proposal.md/tasks.md |
| `2025-12-04-chrome-audit-polish/` | contains only tasks.md (41/41), byte-identical to `2025-11-25-chrome-audit-polish/tasks.md` (duplicate of that archive) |

4. Notes the contrast baseline: all other archived directories have fully-checked tasks.md with no completion contradiction, and most carry no explicit Status line at all.

Acceptance:

- [ ] `git status` in worktree shows ONLY the new `openspec/changes/archive/README.md`; `git diff` touches nothing else.
- [ ] Every table fact verified against actual files in the worktree before commit.
- [ ] README contains no approval claims, no task check-offs, no status rewrites.
- [ ] OpenSpec validation unaffected: `npx openspec@0.23.0 validate --all --strict --no-interactive` still passes (README is outside change dirs; verify anyway).

## Dispatch contract

Fresh context, depth=1, no delegation. Read `openspec/AGENTS.md` first. This is a records-governance documentation task — no production code. Single conventional commit after acceptance: `docs: index archived OpenSpec status inconsistencies`. Commit with `HUSKY=0 git commit`. No push, no remote writes, no edits outside the write scope. Stop and retain evidence on any unexpected failure. Main agent is sole integrator and acceptor.
