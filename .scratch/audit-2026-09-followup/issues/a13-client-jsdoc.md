# a13-client: Backfill JSDoc and enable eslint jsdoc presence rules

Status: ready (2026-09-15)

Blocked by: None (base ead4d46)

Source base: ead4d46 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `client/src/**/*.{ts,tsx}` (JSDoc additions ONLY — no logic changes), `client/eslint.config.js`.

## Behavior and acceptance

A13 client half. `client/eslint.config.js:62-89` registers eslint-plugin-jsdoc but every presence rule is off with a TODO estimating ~120 missing JSDoc in src/**. `npm run lint` runs `eslint --max-warnings=0 "src/**/*.{ts,tsx}"` — so enabling rules means every violation must be fixed in the same change.

- [ ] 1. Clean the config: remove the DUPLICATED comment block (lines 62-67 repeat the same three comment lines twice — keep one copy).
- [ ] 2. Enable the presence rules using the existing option objects already in the config: `jsdoc/require-jsdoc` (publicOnly config already written — turn "off"→"error"), `jsdoc/require-description`, `jsdoc/require-param`, `jsdoc/require-returns`. Leave `jsdoc/check-param-names` off (existing TODO documents destructured-props issue) and keep `jsdoc/check-types`/`jsdoc/valid-types` at "warn" (warn still fails under --max-warnings=0 — keep them clean). Test-file override (jsdoc off for tests) stays.
- [ ] 3. Backfill: run `npm run lint` and add the missing JSDoc until it passes with --max-warnings=0. JSDoc must be ACCURATE (real parameter names/types from the signatures, real returns, meaningful descriptions) — no filler like "Does stuff." Where a function is trivially self-documenting, still write a concise truthful description. Match the JSDoc style already used elsewhere in the codebase.
- [ ] 4. Gates from worktree client/: `npm run lint` (0 errors 0 warnings), `npm run format`, `npm run type-check`, `npm run test -- --coverage` (fixed 6-module aggregate LINES ≥80 — JSDoc is comment-only, coverage must be unchanged).
- [ ] 5. `git status` shows only client/src/** and client/eslint.config.js; `git diff --check` clean; every src hunk is comment-only (no code changes) — eslint.config.js is the only file with rule changes.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md (Article V), AGENTS.md, the eslint config, and skim existing JSDoc style before writing. Documentation-only change on src. Single conventional commit after GREEN: `docs: backfill JSDoc and enable jsdoc lint rules`. Commit with `HUSKY=0 git commit`. No push, no remote writes, no dependency changes. Stop and retain evidence on unexpected failure. Main agent is sole integrator and acceptor.
