# Test Suite Optimization — 2026-11-11

**PR**: [#249](https://github.com/Jackela/Impetus-Lock/pull/249)  
**Merge commit**: `93f563f`  
**Scope**: backend, frontend unit, Playwright E2E, CI reporting and gates. No product behavior changes.

## Outcomes

| Area                  | Before                                                       | After                                                             |
| --------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Backend coverage gate | 60% statements                                               | 78% branch coverage                                               |
| Backend markers       | 62% of tests unclassified                                    | 432 `unit` / 478 `integration` / 49 `tooling`                     |
| Backend tests         | ~20s local                                                   | 910 passed in 32s with branch coverage + JUnit                    |
| Frontend suite        | coverage gate spawned 5 nested Vitest runs inside unit tests | gate moved to `node:test` (`test:coverage-gate`, ~2.3s)           |
| Frontend tests        | 1002 declared, 4 skipped                                     | 986 tests; performance checks restored and always run             |
| Frontend coverage     | stale 97.83% claim from different denominator                | lines 81.72 / statements 80.40 / branches 78.59 / functions 75.31 |
| E2E                   | 117 tests, 6 skips, teardown deleted current traces          | 115 tests, 111 passed, 4 explicit `fixme`, evidence preserved     |
| CI                    | no JUnit/coverage artifacts, Poetry versions drifted         | Poetry pinned 2.5.1; JUnit + coverage + failure evidence uploaded |

## Key changes

- `pytest-timeout` (120s), `--strict-config`, `--durations=25`, branch coverage.
- Root tests classified into `unit`/`integration` without moving files.
- `clearMocks`/`restoreMocks`, setup globals no longer installed with `vi.stubGlobal`.
- Locale-dependent TaskList snapshots replaced with structural assertions.
- Playwright teardown prunes only artifacts older than 7 days; retention is clamped to at least one day.
- E2E `--strictPort`, JUnit reporter, one retry in CI, `**/*.test.mjs` excluded from spec collection.

## Verification

- Backend: 910 passed; 79.98% branch coverage; critical coverage 94.40%.
- Frontend: CI passed; coverage gate 5/5; build/type-check/lint pass.
- E2E: 111 passed, 4 fixme; Story E2E and browser authentication passed.
- OpenSpec: 21/21 strict; `actionlint` clean.

## Not verified

- `docker build` of `server/Dockerfile.prod` with Poetry 2.5.1.
- Real LLM provider calls or real-browser acceptance beyond the authenticated-editor suite.

Temporary PostgreSQL/Redis and Colima were removed after verification. See the PR body for the full command list.
