## Context
Lock styling drops after editor remounts because the decoration install guard is global. Session vault mode promises zero persistence but leaves local/encrypted payloads when switching. Observability paths expose metrics by default, log wrong status codes, and tracing error handling can raise.

## Goals / Non-Goals
- Goals: reliable lock decoration per EditorView; session mode purges persisted secrets; safe logging/tracing; default-safe metrics exposure.
- Non-Goals: redesign of BYOK UX, new auth system, or broader telemetry pipeline changes.

## Decisions
- **Lock lifecycle**: scope the guard to each EditorView or provide teardown so HMR/remount reinstalls decorations deterministically.
- **Session semantics**: when switching to session mode, delete any stored local/encrypted payloads; keep behavior minimal (no prompts).
- **Metrics gating**: default `/metrics` to disabled unless explicitly enabled via env or allowlist; no complex auth added now.
- **Tracing safety**: use stable OpenTelemetry status API and avoid raising on error paths.
- **Logging accuracy**: catch `HTTPException` to log true status while keeping duration logging.

## Risks / Trade-offs
- Tightening metrics exposure may break existing dashboards if env vars aren’t set—document clearly.
- Clearing persisted keys on mode change could surprise users; minimize UX churn and document behavior.

## Migration Plan
1) Implement and test frontend fixes. 2) Apply backend observability guards and adjust tests. 3) Update docs. 4) Validate specs and targeted tests.
