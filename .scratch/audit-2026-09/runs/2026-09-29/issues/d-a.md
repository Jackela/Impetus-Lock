# D-A: Correct active API and testing documentation

Tier1. Ready. Findings: D01,D02,D03,D04,D05,D07,C05.

## Scope

API_CONTRACT.md, ARCHITECTURE_GUARDS.md, TESTING.md, DEVELOPMENT.md, MANUAL_TESTING_GUIDE.md, AUDIO_FEEDBACK_GUIDE.md, BROWSER_TEST_GUIDE.md

## Acceptance

Fix only verified active instruction/schema/path/tool-command errors. Read affected docs completely and verify against actual current source/config. Preserve dated history. DEVELOPMENT belongs exclusively to this batch. Do not edit DEPENDENCY_MANAGEMENT or archived LOCK guide (D-B), CLAUDE (D-C), runtime source or scripts. Cross-check examples against actual required schema without live model calls. Mention local gates do not establish Playwright/production validation.

## Verification

Verify referenced files/commands/config facts, links and git diff --check; no artificial tests for prose. Read CLAUDE/OpenSpec. Depth1 no delegation. Work in assigned worktree only. Do not commit/change branches or touch remote; main integrates. Return changed paths, checks, remaining issues.

## Integration follow-up (after R18/R19/R20)

The same D-A batch must align TESTING/DEVELOPMENT/ARCHITECTURE_GUARDS with final effective compiler and per-file coverage commands. Document real local PostgreSQL prerequisite for the newly accepted concurrency/ownership/repository tests, the supplied default URL and unique test-owned schemas; do not claim these tests run solely on SQLite. Explain remaining Redis exclusions and that browser E2E is outside this run. Verify actual package scripts and CI source after implementation, preserve historical facts, and keep the same allowed document file set. No new docs batch or runtime changes.
