# Change: Decide the scope of the collaboration backend (complete it or retire it)

Status: Proposed; awaiting approval. Proposal only — no route, WebSocket, schema, lifespan or dependency change is made by this document.

## Why

`server/server/api/routes/collaboration.py` is 569 lines of live, mounted code with no spec, no client and no working permission model:

- It defines router `/collaboration` (`:37`), a WebSocket endpoint `/collaboration/ws/{document_id}` (`:132-137`) and four REST endpoints — room users (`:443`), room stats (`:470`), all rooms (`:496`) and `POST /collaboration/rooms/{document_id}/permission` (`:513`).
- The permission endpoint writes nothing. It logs the request and returns `{"success": true, ... "note": "Permission persistence pending - tracked as Issue #XXX"}` (`:531-545`). The placeholder `Issue #XXX` is not a real issue number, so the defect is not trackable.
- `check_document_access` (`:89-129`) runs raw SQL against `document_permissions` and `documents`. Neither table exists anywhere in the repository: `server/server/models/` has no document model and no migration creates those tables. The query therefore raises, is caught at `:127-129`, and returns `False`, so **every** WebSocket connection today is closed with code 4003 "Access denied" (`:163-165`) — including the document owner's.
- It is mounted and initialized in production lifespan: `server/server/api/main.py:68-73` constructs and initializes `collab_service` (Redis pub/sub) on startup, `:97` shuts it down, `:159` includes the router. There is no `docker-compose` Redis service in the repository; `REDIS_URL` defaults to `redis://localhost:6379/0` (`server/server/infrastructure/websocket/redis_pubsub.py:46`).
- No client code uses it: the only reference under `client/src` is the generated type file `client/src/types/api.generated.ts`. No `openspec/specs/**` capability describes rooms, presence or permissions.
- WebSocket auth reads a JWT from the query string (`?token=`, `:71-73`) before falling back to the cookie, and `TESTING=1` + `WEBSOCKET_TEST_MODE=enabled` bypasses auth entirely (`:66-68`).
- It is not cheap dead weight: `server/server/infrastructure/websocket/` is 1,160 lines (connection_manager 332, collaboration_service 525, redis_pubsub 293) and its test suite is ~2,600 lines across four files, plus monkeypatching of `collab_service` in `server/tests/test_sol_shutdown.py:17,43-44,155,166,182-183`.

A mounted, unauthenticated-in-practice realtime subsystem with a placeholder issue and no consumer is a standing security and maintenance liability. The project must either own it (spec + persistence + client) or remove it.

## What Changes

- Force a single recorded decision with two mutually exclusive paths; no partial state is acceptable.
- **Path A — complete it**: add a `collaboration` capability spec (room join/leave, presence, permission levels read/write/admin, document ownership), add `documents` and `document_permissions` models plus an alembic migration, replace the raw SQL with a repository, enforce permissions on both the WebSocket join and every REST endpoint, store permission updates, stop accepting JWTs in query strings, and build an authenticated client surface with two-browser E2E — while defining how realtime edits interact with un-deletable locks and optimistic task versioning.
- **Path B — retire it**: remove the `/collaboration` router and its `main.py` registration, the `collab_service` initialize/shutdown in lifespan and `app.state.collab_service`, the `server/server/infrastructure/websocket/` package, the collaboration entries in generated client types, and the collaboration-only tests; update `test_sol_shutdown.py` so the lifecycle contract no longer stubs a service that does not exist.
- **Recommendation: Path B.** The feature has no specification, no consumer, no persistence and cannot authenticate a single real user today; completing it is a multi-week feature whose hardest part (realtime editing under non-deletable locks) is not designed at all.
- Either path preserves task CRUD, the lock manager, editor save/version behavior, Redis-backed rate limiting (`server/server/infrastructure/rate_limiting.py`, which is independent and stays) and the `/health` + `/metrics` surfaces.
- **BREAKING (Path B only)**: `/collaboration/*` and the `/collaboration/ws/{document_id}` WebSocket stop existing. No in-repo client calls them.

## Impact

- Affected specs: `production-readiness` — one new requirement that an unspecified collaboration surface must be resolved (specified and enforced, or removed) before release. No existing requirement is modified. Path A would additionally need a new `collaboration` capability spec, which this proposal does not pre-write.
- Affected code (Path B): `server/server/api/routes/collaboration.py`, `server/server/api/main.py:28,68-73,97,159`, `server/server/infrastructure/websocket/{__init__,connection_manager,collaboration_service,redis_pubsub}.py`, `client/src/types/api.generated.ts`, `server/tests/unit/infrastructure/websocket/*` (4 files), the collaboration half of `server/tests/integration/test_redis_real.py`, and the collaboration stubs in `server/tests/test_sol_shutdown.py`.
- Affected code (Path A): all of the above plus new models, migration, repository, permission enforcement, client UI and E2E.
- Path B risk: Redis remains a dependency for rate limiting, so `redis = "^7.4"` in `server/pyproject.toml:33` stays; lifespan ordering changes must be re-verified by the existing shutdown tests rather than assumed.
- Path A risk: query-string JWTs, a testing-mode auth bypass, permission semantics that contradict `document_permissions` being absent, and a realtime edit model that can silently defeat locks or task version checks.

## Tasks

- [ ] 1. Record the decision (Path A or Path B) with owner and date in the Status line of this proposal.
- [ ] 2. Path A only: write the `collaboration` capability spec with at least one scenario per permission level before any schema work.
- [ ] 3. Path A only: add `documents` / `document_permissions` models and migration, then a repository, then enforce permissions on WebSocket join and every REST endpoint, then persist permission updates, then remove the query-string token path.
- [ ] 4. Path A only: build the authenticated client surface and two-browser E2E, including what happens when a remote edit touches a locked span or a stale task version.
- [ ] 5. Path B only: remove the router, its registration, the lifespan initialize/shutdown and `app.state.collab_service`, then the `infrastructure/websocket` package, then the generated types and collaboration-only tests.
- [ ] 6. Path B only: rewrite `test_sol_shutdown.py`'s collaboration stubs so shutdown ordering is still asserted for the remaining services; keep rate-limiting Redis tests.
- [ ] 7. Run the validation list below and confirm no orphaned import of `collaboration`, `collab_service`, `ConnectionManager` or `RedisPubSubManager` remains.

## Validation

- `openspec validate 2026-11-09-collaboration-scope-decision --strict` and `npx @fission-ai/openspec@latest validate --all --strict`.
- Path B: full `pytest server/tests` (especially `test_sol_shutdown.py`, `unit/infrastructure/websocket/*` deletions, `integration/test_redis_real.py`), `python -c "from server.api.main import app"` import check, app start/stop with no Redis reachable, and `curl` returning 404 for `/collaboration/health` on a started dev server.
- Path B: regenerate `client/src/types/api.generated.ts` and confirm the only diff is the removed collaboration paths; `npm run -w client type-check`, lint, build.
- Path A: migration up/down on a disposable database, permission matrix tests (owner/read/write/admin/stranger × WS join and each REST endpoint), two-browser E2E, and a negative test proving a query-string token is rejected.
- Both paths: `rg -n "collaboration|collab_service|RedisPubSubManager|ConnectionManager" server client/src` returns only intentional remnants.

## Open Questions

- Is realtime collaboration on any product roadmap, or was this scaffolding written ahead of a feature that was dropped? (owner: product; the answer selects the path)
- If Path B: should `POST /collaboration/rooms/{document_id}/permission` return 404 immediately, or briefly return 410 with a migration note for any unknown external caller? Any deployment exposing it should be checked first.
- If Path A: which realtime model is intended (OT, CRDT/Yjs, or full-document rebroadcast), and how do remote edits interact with un-deletable locks and `version`-based optimistic saves?
- If Path A: who are the "documents"? The repository has tasks, not documents, so a document/task identity decision is missing, not merely a table.
- Should the `Issue #XXX` placeholder be replaced by a real issue in either path, so the defect stops being untrackable?
