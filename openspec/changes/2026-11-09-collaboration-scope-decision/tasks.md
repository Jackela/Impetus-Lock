## 1. Decision and evidence

- [ ] 1.1 Re-confirm the evidence in this proposal: no client consumer, `document_permissions`/`documents` absent from models and migrations, permission endpoint returns a placeholder note, lifespan initializes the service unconditionally.
- [ ] 1.2 Record Path A (complete) or Path B (retire) with owner, date and rationale in the proposal Status line; nothing below starts before that record exists.

## 2. Path A — complete the feature (only if approved)

- [ ] 2.1 Write the `collaboration` capability spec: room lifecycle, presence, read/write/admin permissions, document ownership, and rejection behavior; one scenario per rule.
- [ ] 2.2 Decide document identity (task vs new document entity) and add `documents` + `document_permissions` models with an alembic migration, up and down.
- [ ] 2.3 Replace the raw SQL in `check_document_access` with a repository and enforce it on WebSocket join and on every `/collaboration` REST endpoint.
- [ ] 2.4 Persist `POST /rooms/{document_id}/permission` and drop the "tracked as Issue #XXX" placeholder response.
- [ ] 2.5 Reject query-string JWT auth and the `WEBSOCKET_TEST_MODE` bypass outside explicit test fixtures.
- [ ] 2.6 Define and implement how remote edits interact with un-deletable locks and `version`-based optimistic saves.
- [ ] 2.7 Build the authenticated client surface and two-browser E2E (join, presence, permission denial, reconnect).

## 3. Path B — retire the feature (recommended)

- [ ] 3.1 Delete `server/server/api/routes/collaboration.py` and its `main.py` import (`:28`), `include_router` (`:159`), lifespan `collab_service` initialization (`:68-73`) and shutdown (`:97`), and `app.state.collab_service`.
- [ ] 3.2 Delete `server/server/infrastructure/websocket/` (1,160 lines) and confirm nothing else imports it.
- [ ] 3.3 Regenerate `client/src/types/api.generated.ts`; the only diff must be the removed collaboration paths.
- [ ] 3.4 Delete `server/tests/unit/infrastructure/websocket/*` and the collaboration half of `server/tests/integration/test_redis_real.py`; keep the rate-limiting Redis coverage.
- [ ] 3.5 Rewrite `server/tests/test_sol_shutdown.py` so shutdown ordering is still asserted for the remaining services instead of stubbing a removed `collab_service`.
- [ ] 3.6 Confirm the `redis` dependency stays required by rate limiting, and that app start/stop works with no Redis reachable.

## 4. Verification

- [ ] 4.1 Run `pytest server/tests` in full (both paths) plus `python -c "from server.api.main import app"`.
- [ ] 4.2 Start a dev server and confirm `/collaboration/health` 404s (Path B) or returns a permission-enforced room list (Path A).
- [ ] 4.3 Run client type-check, lint and build after regenerating types.
- [ ] 4.4 Search for `collaboration|collab_service|ConnectionManager|RedisPubSubManager` across `server/` and `client/src/` and confirm only intentional remnants remain.
- [ ] 4.5 Run `npx @fission-ai/openspec@latest validate --all --strict`.
