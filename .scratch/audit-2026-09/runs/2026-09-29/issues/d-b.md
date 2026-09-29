# D-B: Preserve evidence and clean generated-state tracking

Tier1. Ready. Findings: D04,D06,H02,H03,H04.

## Scope

DEPENDENCY_MANAGEMENT.md, .gitignore, LOCK_REFACTORING_TESTS_README.md -> docs/archive/2026-09/, docs/archive/2026-09/README.md or existing archive index, current links to the archived LOCK guide; scripts/ralph/.last-branch index only

## Acceptance

Correct dependency instructions and semver/schedule with current config. Archive LOCK guide intact, add dated historical-status/current-TESTING pointer; update current inbound links without rewriting old historical evidence. Ignore exact server/coverage.json and scripts/ralph/.last-branch, git rm --cached only the last-branch file and preserve bytes. Snapshot exact removal list first. Screenshot assets remain untouched in this batch; R21 handles paths and main will decide cleanup from actual references. Never delete original .zcode/env/data. No dependency upgrades.

## Verification

Verify referenced files/commands/config facts, links and git diff --check; no artificial tests for prose. Read CLAUDE/OpenSpec. Depth1 no delegation. Work in assigned worktree only. Do not commit/change branches or touch remote; main integrates. Return changed paths, checks, remaining issues.
