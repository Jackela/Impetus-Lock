# Change: Harden lock lifecycle, BYOK session semantics, and observability safety

## Why
- Lock styling/enforcement breaks after editor remounts because the plugin install guard never resets per view.
- Session BYOK mode still leaves persisted API keys in local/encrypted storage, violating the “session-only” promise.
- Observability paths have correctness and exposure risks: middleware logs 500s for all errors, tracing status setter can raise, and `/metrics` is exposed by default.
- README demo link points to a removed asset, giving a broken first impression.

## What Changes
- Fix lock decoration lifecycle so each EditorView instance installs and refreshes decorations reliably.
- Enforce session-mode semantics by clearing any persisted BYOK payloads when switching to session and preventing reuse of stale secrets.
- Harden observability: log real HTTP status codes, make tracing error handling safe, and gate Prometheus metrics exposure by default.
- Refresh docs/demo link to avoid broken artifacts.

## Impact
- Affected specs: `editor-agentic-ui`, new `observability` capability
- Affected code: frontend lock decorations & vault (client), backend logging/middleware, tracing helper, metrics endpoint (server), README/demo docs
