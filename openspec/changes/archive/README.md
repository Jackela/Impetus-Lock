# Archive Index

This directory holds completed or retired OpenSpec changes, moved here per the
Stage 3 archiving workflow in `openspec/AGENTS.md` (`changes/[name]/` ->
`changes/archive/YYYY-MM-DD-[name]/`).

The 2026-09 audit (finding A22) identified eight archived changes whose
records carry status, approval, or completion inconsistencies. They are
indexed below so future readers are not misled by the mismatched signals.

## Preservation policy

Every archived record is preserved exactly as it was written:

- Unchecked task boxes and `Draft`/`Proposed` status lines in these
  directories are historical facts, not TODOs. Nothing here awaits work.
- No approval evidence has been retrofitted, and no historical task has been
  checked off after the fact.
- The original files are not edited to reconcile the inconsistencies; this
  index is the only reconciliation artifact.

## Known inconsistencies

| Directory | Inconsistency (verified against the archived files) |
| --- | --- |
| `2025-11-09-execute-devtools-audit/` | `proposal.md` line 4 reads `**Status**: Draft`, while `COMPLETION.md` declares the change `COMPLETED`; `tasks.md` has 12 of 33 boxes checked. |
| `2025-11-09-fix-intervention-api-contract/` | `proposal.md` reads `**Status**: Proposed`, while `COMPLETION.md` declares `ALREADY COMPLIANT - NO CHANGES REQUIRED`; `tasks.md` has 0 of 69 boxes checked. |
| `2025-11-09-control-muse-trigger/` | `proposal.md` reads `**Status**: Proposed`, while `COMPLETION.md` declares `ALREADY COMPLIANT - NO CHANGES REQUIRED`; `tasks.md` has 45 of 74 boxes checked. |
| `2025-11-10-fix-ux-issues/` | `proposal.md` reads `**Status**: Proposed`; there is no `COMPLETION.md` at all; `tasks.md` has 33 of 79 boxes checked. |
| `2025-04-09-sprint-1-user-auth/` | Inverse mismatch: `proposal.md` claims `COMPLETE` ("All user stories implemented and tested"), yet all 24 tasks (T001-T024) in `tasks.md` still say `Status: pending`. |
| `2025-04-09-add-task-persistence/` | `proposal.md` reads `Status: Proposed`; the directory has no `tasks.md` and no completion record of any kind. |
| `2025-04-09-team-setup/` | Not a change structure: planning documents only (`project-charter.md`, `product-roadmap.md`, `dev-standards.md`, `tech-debt-report.md`); no `proposal.md` and no `tasks.md`. |
| `2025-12-04-chrome-audit-polish/` | Contains only `tasks.md` (41 of 41 boxes checked), byte-identical to `2025-11-25-chrome-audit-polish/tasks.md`; the directory duplicates that earlier archive entry. |

## Contrast baseline

The eight entries above are the exceptions. Every other archived directory
has a fully checked `tasks.md` with no completion contradiction, and none of
them carries an explicit Status line in its `proposal.md`.
