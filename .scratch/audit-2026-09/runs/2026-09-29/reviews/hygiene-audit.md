# Wave 2 — hygiene and dependencies

Read-only audit at ea0ff6e. Old63-item manifest has zero overlap with tracked files; original .zcode and ignored environments are retained.

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| H01 | P2 | client/e2e/test-trigger-debug.spec.ts:83; test-manual-trigger-click.spec.ts:64; new-user-audit.spec.ts:22 | E2E overwrites tracked screenshot evidence | Direct future output to ignored test-results, retain referenced documentation assets, untrack only disposable outputs | 2 |
| H02 | P2 | .gitignore:72 | server/coverage.json is not ignored | Add precise generated-report ignore | 1 |
| H03 | P2 | scripts/ralph/ralph.sh:40,71 | Tracked .last-branch is overwritten at runtime | Untrack/ignore exact state file; retain local bytes | 1 |
| H04 | P2 | LOCK_REFACTORING_TESTS_README.md:94,107 | Completed2025 migration still presents instructions to fail/implement | Archive intact with current guide pointer and repair links | 1 |
| H05 | P2 | client/package.json:52;PR181 | plugin-react6 needs Vite8, isolated PR retains Vite7 and fails | Coordinated migration proposal | 3 |
| H06 | P2 | client/eslint.config.js:30;PR176 | Hooks7 preset produces legacy plugins array and fails flat config | Migration proposal with actual preset validation | 3 |
| H07 | P2 | server/tests/conftest.py:52;PR172 | Pytest9 removes old path hook argument, collection fails | Migration proposal with collection_path compatibility tests | 3 |

Only LOCK_REFACTORING_TESTS_README requires whole-file archival; other root docs retain active roles, CLAUDE historical sections need clear historical labels. No new vulnerability scan.
