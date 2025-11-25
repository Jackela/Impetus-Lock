# Change Proposal: harden-byok-storage

## Why
- BYOK currently stores provider/model/apiKey in `localStorage` as plain text; anyone with console access can read it, and synced browsers may leak secrets.
- Security-conscious orgs will demand stronger protections (encryption at rest, session-scoped storage, or explicit "forget on logout" controls) before adopting.

## What Changes
- Introduce an optional Web Crypto wrapper that encrypts BYOK payloads with a key derived from a user-provided passphrase or OS credential store.
- Offer a session-only mode that keeps keys in memory (React state) and uses the Page Visibility API to wipe them after inactivity.
- Provide an "Export/Import" UX flow so users can backup their config securely without copying raw JSON from devtools.
- Add a security checklist in docs covering threat model, localStorage vs. encrypted mode, and recommended practices.

## Impact
- Reduces risk of accidental key leakage, enabling enterprise pilots.
- Gives users explicit control over how long their keys live in the browser.
- Lays groundwork for future integrations (browser extensions, native clients) that may store secrets elsewhere.
