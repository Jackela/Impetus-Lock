# Docs/proposal dispatch batches

All writers fresh context depth1 no delegation. No remote writes. Preserve root AGENTS.md and OpenSpec managed blocks. Main commits/integrates only approved scoped changes.

## D1 current docs

Own README.md, DEVELOPMENT.md, TESTING.md, CLAUDE.md, API_CONTRACT.md, MANUAL_TESTING_GUIDE.md, ARCHITECTURE_GUARDS.md, LOCK_REFACTORING_TESTS_README.md, client/README.md, openspec/project.md, docs/agents/\*.md only. Correct A01-A04/A16/A20-A21 current factual statements; retain constitutional requirements. Explain actual docstring enforcement gap outside constitutional articles. Current commands use server.api.main:app and poetry install. Keep historical dated changelog entries. Remove absent demo link. Correct client_meta. Installed React19/Vite7 docs; CI Node24 verified but don't define new engines. GitHub task summaries reference OpenSpec authority, explicit per-issue GET dependency query, local-only exception wins generic routing. Do not alter installed skills. Update links in owned files for D2 archive map. No broad reformat.

## D2 archive

Move these11 root historical files to docs/archive/2026-09/: AI_INTEGRATION_STATUS.md, ARCHITECTURE_SAFETY_NET_STATUS.md, E2E_FIX_SUMMARY.md, E2E_STABILITY_FIX.md, E2E_TEST_STATUS.md, FIX_PLAN.md, READY_FOR_TESTING.md, RESEARCH_FINDINGS.md, SESSION_SUMMARY.md, TEST_SUITE_EXAMPLES.md, TEST_SUITE_SUMMARY.md. Preserve historical facts, add one historical boundary note per file; fix relative links for new location. Own docs/INDEX.md, docs/REPOSITORY_ORGANIZATION.md and incoming link-only edits elsewhere EXCEPT D1-owned files (report those for D1). Don't change accepted historical spec facts/status. Don't archive MANUAL_TESTING_GUIDE or privacy/security docs. Fix HYG2 index missing pointers by linking existing authority or removing absent targets. No source code.

## D3 hygiene

Own .gitignore and exact junk-manifest only (main already generated manifest). Writer adds `/server/.venv.windows.*/` and `/server/impetus_lock.db`. Raw logs are kept in the git common directory. Existing server `*.db` ignore already exists; scoped root explicit rule documents intent. Main prints/reviews63-path manifest then removes only those paths from index using git rm --cached, preserving local copies (also restore local copies in integration after commit integration). Do not rm runtime venv or delete disk artifacts.

## P proposals

Three independent drafts: migrate-gemini-sdk (legacy to google-genai, BYOK isolation, structured response/retry/token behavior), refactor-route-service-boundaries (thin task/template/streak routes preserving user authorization, API/version/status semantics), refactor-unused-client-state (dispose/align unused useTaskSyncCloud and useLockEnforcement without changing production behavior absent approval). Own only their openspec/changes/<id> trees. Use current capability deltas, scenario per requirement; design only when necessary. Implementation checkboxes stay empty, status proposed awaiting approval. Validate each strict, all strict. No implementation.
