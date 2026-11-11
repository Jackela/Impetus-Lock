# Manual / debugging E2E specs

These specs are **not** part of the normal E2E gate. They are exploratory,
debugging or demo/audit helpers that were previously collected by
`playwright.config.ts` and therefore ran (and could fail) on every PR.

`client/playwright.config.ts` ignores this directory via
`testIgnore: ["manual/**"]`. The files are kept — not deleted — because they
document how the observed behaviour was investigated and are still useful
manually.

Run a spec here explicitly, for example:

```bash
cd client
npx playwright test e2e/manual/quick-check.spec.ts
npx playwright test --grep-invert "" manual/            # collect everything here
```

Notes:

- `demo-showcase.spec.ts` and `manual-testing-newbie.spec.ts` write screenshots
  to `client/test-results/` and are presentation aids, not assertions.
- `new-user-audit.spec.ts` backs the first-run UX audit in
  `specs/007-chrome-devtools-audit/UX_IMPROVEMENT_PLAN.md`.
- Imports were rebased one level up (`../helpers/*`, `../../src/*`) when the
  files moved here.
