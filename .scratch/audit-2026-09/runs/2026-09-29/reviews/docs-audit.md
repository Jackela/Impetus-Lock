# Wave 2 — documentation audit

Read-only agent `audit_docs`, base ea0ff6e. Fully read 13/13 root Markdown files (4753 lines), compared commands and configuration. Severity below is audit severity, not constitutional feature priority.

| ID | Severity | Location | Verified fact | Action | Tier |
|---|---|---|---|---|---|
| D01 | P2 | API_CONTRACT.md:391,424,459,519 | curl examples omit required contract version/client_meta; response examples omit anchor; version fallback contradicts 422 | Align current examples and field/version descriptions with runtime schema, retain dated history | 1 |
| D02 | P2 | ARCHITECTURE_GUARDS.md:118,152,287,373 | Four contracts/no docstring guard claims conflict with three enforced contracts and pydocstyle/JSDoc | Correct active enforcement descriptions | 1 |
| D03 | P2 | TESTING.md:191,203,380; DEVELOPMENT.md:48,93 | Example test/entrypoint paths do not exist | Use actual runnable paths or label hypothetical examples | 1 |
| D04 | P2 | TESTING.md:559; LOCK_REFACTORING_TESTS_README.md:99,161; DEPENDENCY_MANAGEMENT.md:133,159 | Playwright --slow-mo, Vitest --grep, Poetry audit/lock --no-update are unsupported | Correct current command guidance | 1 |
| D05 | P2 | DEVELOPMENT.md:300; MANUAL_TESTING_GUIDE.md:375,378 | frontend-tests runs only Vitest, not Playwright/all frontend gates | Separate lint/type/unit/E2E job descriptions | 1 |
| D06 | P2 | DEPENDENCY_MANAGEMENT.md:22,38,39 | ^1.56.1 allows 1.57.0; documented schedule/PR limits drift | Correct semver and refer to current Dependabot config | 1 |
| D07 | P2 | AUDIO_FEEDBACK_GUIDE.md:64,66; BROWSER_TEST_GUIDE.md:160,164 | SensoryFeedbackDemo is not rendered and ENABLE_LOKI_MODE has no production consumer | Replace obsolete manual instructions with current entrypoints | 1 |

Evidence: route contract_version mismatch returns422; Pydantic examples fail missing client_meta/anchor. Actual Vitest5.0.1 rejects --grep, Playwright1.63.0 rejects --slow-mo, Poetry2.4.3 has no audit/--no-update. semver7.8.5 accepts1.57.0 for ^1.56.1. No full tests/services/remote writes. Explicit local Markdown file targets exist; emoji anchors not browser-verified.

Overlap for consolidation: CLAUDE act100% parity claim/current2025 status/missing phase pointers; DEVELOPMENT act log-copy claim lacks implementation. Historical archived originals remain untouched.
