## Context
- Current dev bootstrap mandates Postgres; API crashes without `DATABASE_URL`, blocking TESTING/debug runs.
- Intervention API ignores TaskRepository and treats `X-Contract-Version` as mandatory, diverging from contract.
- Frontend does not load/save tasks/locks from backend; lock/timer visuals need spec alignment.

## Goals / Non-Goals
- Goals: resilient API startup without Postgres in TESTING/debug; optional persistence for interventions; backward-compatible contract negotiation; editor load/save for content+locks with fallback; align lock/timer UX to spec.
- Non-Goals: multi-tenant auth, schema migrations beyond existing tables, redesign of editor UX beyond lock/timer fixes.

## Decisions
- Add explicit in-memory persistence/debug mode when `TESTING=1` or `DATABASE_URL` missing; dev-start continues to provision Postgres.
- Make intervention route accept missing/older contract versions (same major), and emit server contract version header.
- Inject TaskRepository optionally; when provided and `task_id` present, persist actions/tasks; otherwise still serve responses.
- Frontend maintains task state via Task API; hydrates locks from backend, falls back to localStorage when API unavailable.
- Timer indicator anchored to editor container (2px, non-intrusive); lock hover shows icon with aria-label, comments hidden via decorations.

## Risks / Trade-offs
- In-memory fallback risks diverging behavior from Postgres; mitigate with clear flag requirement (`TESTING=1`) and integration tests.
- Optional repo path could hide persistence bugs; mitigate by adding tests for both with/without repo.
- Syncing editor to backend introduces latency; mitigate with debounce + optimistic versioning and conflict handling.

## Open Questions
- Should intervention history persistence require explicit `task_id` header or inferred from session? (default: require explicit `task_id`/payload).
- Acceptable debounce window for autosave (e.g., 1-2s) and max payload size? (default: match existing content limits).
