# Branch Protection

Current configuration for `main` on `Jackela/Impetus-Lock`. Update this file when the rules change; do not treat it as a second gate definition.

## Required checks

- `Lint (Backend + Frontend)`
- `Type Check (Backend + Frontend)`
- `Backend Tests`
- `Frontend Tests`
- `Validate (API Types + OpenSpec)`
- `Playwright E2E Tests`

`Muse/Loki Story E2E` and `browser-authentication` are high-value suites but are not required until their flake rate is observed. Do **not** require `Test Matrix (Python 3.11/3.12)`: it is path-filtered and will leave non-backend PRs waiting forever.

## Repository rules

- Require a pull request before merging.
- Required approvals: **0** for the single-maintainer workflow; human review is still required by `AGENTS.md` for significant product decisions and release.
- Require status checks to pass and branches to be up to date.
- Require conversation resolution before merging.
- Block force pushes and branch deletion.
- Do not include administrators in bypass rules for normal feature work; direct pushes to `main` remain prohibited.

## CODEOWNERS

`.github/CODEOWNERS` assigns `* @Jackela` and the same owner for `server/`, `client/`, `docs/`, and `.github/`. Because the repository requires zero approving reviews, CODEOWNERS is informational rather than a hard gate.

## AI agents

- Every change goes through a branch and PR; do not push directly to `main`.
- Do not bypass a failing check with `--no-verify`, ignore directives, skipped tests, or lowered thresholds.
- Merge only after the required checks are green and review threads are resolved.
- A local pass or merged PR is not deployment or user acceptance; state unverified environments explicitly.

See `AGENTS.md` for the authoritative rules and `.github/workflows/ci.yml` for the gate implementation.
