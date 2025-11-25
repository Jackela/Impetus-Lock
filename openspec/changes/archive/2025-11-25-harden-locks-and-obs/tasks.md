## 1. Frontend
- [x] 1.1 Fix lock decoration/plugin lifecycle so styling reinstalls on new EditorViews (add regression test).
- [x] 1.2 Enforce session vault semantics: switching to session purges persisted BYOK payloads; add unit coverage.
- [x] 1.3 Update README/demo link to a valid artifact.

## 2. Backend Observability
- [x] 2.1 Make request logging record actual HTTP status (including HTTPException) without raising.
- [x] 2.2 Harden tracing span error handling so it cannot throw and correctly sets status.
- [x] 2.3 Gate `/metrics` exposure by default (env-guard or auth) and adjust tests/docs.

## 3. Validation
- [x] 3.1 Run targeted frontend tests (Vitest suite for vault/locks).
- [x] 3.2 Run targeted backend tests (pytest selection for logging/metrics/tracing).
- [x] 3.3 `openspec validate harden-locks-and-obs --strict`.
