# Change: Agentic Stack Hardening

## Why
- Backend currently hard-crashes without a Postgres URL, blocking debug/testing runs.
- Intervention API doesn’t persist actions/tasks or tolerate absent repositories, leaving audit/state “half-built”.
- UI lacks backend load/save for document + locks, and timer/lock UI needs alignment with the spec.
- Contract version header is treated as mandatory, diverging from the published contract.

## What Changes
- Add debug/TESTING fallback to run the API without Postgres while keeping dev-start behavior.
- Allow Intervention service to persist task/action history when a repository is available and remain functional when it is not.
- Make contract version negotiation backward-compatible and surface server version in responses.
- Add editor-side task load/save (content + locks) with offline/local fallback; keep lock styling/timer non-intrusive per spec.

## Impact
- Affected specs: dev-environment-bootstrap, agentic-interventions, editor-agentic-ui
- Affected code: server/api main + intervention route/service, repository wiring, client editor/services, dev bootstrap scripts
