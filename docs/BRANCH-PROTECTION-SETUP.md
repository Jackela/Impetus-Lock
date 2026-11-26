# Main branch protection

The public GitHub branch response for `Jackela/Impetus-Lock` reported protection
enabled and `required_status_checks.enforcement_level: everyone` on 2026-11-26,
at head `daab9e2e7b04dcb5a75b3acdea7c1d76bb7ee516`.
Recheck the [main branch API response](https://api.github.com/repos/Jackela/Impetus-Lock/branches/main)
before changing this record.

## Verified required checks

| Workflow or service                                                   | Required check names                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [CI](../.github/workflows/ci.yml)                                     | `Lint (Backend + Frontend)`, `Type Check (Backend + Frontend)`, `Backend Tests`, `Frontend Tests`, `Validate (API Types + OpenSpec)` |
| [E2E Tests](../.github/workflows/e2e.yml)                             | `Playwright E2E Tests`, `Muse/Loki Story E2E`                                                                                        |
| [Authenticated Editor](../.github/workflows/authenticated-editor.yml) | `browser-authentication`                                                                                                             |
| GitHub CodeQL                                                         | `CodeQL`                                                                                                                             |

The `Test Matrix` and `WeChat Mini Program` workflows use path filters. Run and
review their checks when triggered.

## Merge review and protected settings

[AGENTS.md](../AGENTS.md) requires human approval for merge and release. Open a
PR, review checks on the intended head and resolve review threads before
merging through normal protection. [.github/CODEOWNERS](../.github/CODEOWNERS)
identifies `@Jackela` as the owner for review.

Required approval counts, strict up-to-date checks, conversation resolution,
force-push and deletion settings, and bypass permissions need an authorized
maintainer view of the protection or ruleset. The public branch response
confirms required check names and enforcement level.
