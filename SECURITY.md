# Security Policy

## Supported versions

Impetus Lock is pre-1.0. Security fixes target the `main` branch only; there are no maintained release branches yet.

## Reporting a vulnerability

Do **not** open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting:

1. Open the repository **Security** tab.
2. Choose **Report a vulnerability**.
3. Include affected versions or commit SHA, reproduction steps, impact, and any suggested fix.

If private reporting is unavailable, contact the maintainer privately via GitHub (`@Jackela`). Never include real API keys, session cookies, or production data in a report.

## Scope

High-value areas include:

- BYOK key storage and encryption (`client/src/services/llmKeyVault.ts`, `docs/security/byok-storage.md`)
- JWT, CSRF, session and account isolation (`server/server/api/auth/`, `server/server/infrastructure/security/`)
- Lock enforcement and transaction filtering (`client/src/components/Editor/TransactionFilter.ts`, `LockManager.ts`, `ContentInjector.ts`)
- Task version/ownership checks and `X-Task-Id` handling
- Secret handling in logs, CI, and deployment (`docs/security/SECRETS_MANAGEMENT.md`)

## Disclosure

Please give the maintainer a reasonable window to investigate and ship a fix before publishing details. There is no bug bounty program.
