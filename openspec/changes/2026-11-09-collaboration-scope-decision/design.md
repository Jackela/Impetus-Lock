## Context

The collaboration subsystem was written ahead of a specification. It is mounted in production lifespan (`server/server/api/main.py:68-73,97,159`), reachable over REST and WebSocket, and backed by 1,160 lines of infrastructure plus ~2,600 lines of tests — but no `openspec/specs` capability describes it, no `client/src` code calls it, and its permission check cannot succeed because `document_permissions` and `documents` do not exist in `server/server/models/` or in any alembic revision. `check_document_access` therefore throws, is swallowed at `collaboration.py:127-129`, and returns `False`, so `/collaboration/ws/{document_id}` closes every connection with 4003.

Two stakeholders exist implicitly: someone who wrote or wants realtime collaboration (product/feature owner) and everyone who pays the maintenance and security review cost. The decision belongs to the former; the evidence belongs to both.

## Goals / Non-Goals

- Goals: eliminate the "mounted but unusable and unspecified" state; make the outcome auditable; keep rate limiting, metrics and shutdown-ordering guarantees intact.
- Non-Goals: designing realtime editing in this change (Path A only specifies what must be decided, not how OT/CRDT works); changing task, lock or editor semantics; changing dependencies other than removing what becomes unused.

## Decisions

**Decision 1 — Only two end states, no deprecation limbo.** Keeping the router mounted with a placeholder permission endpoint was rejected: it already caused one round of ambiguity and leaves an authenticated-looking surface that always denies.

**Decision 2 — Recommended: Path B (retire).** Justification is that the feature is not merely untested — it is non-functional for every real user (4003 for everyone), its permission store does not exist, its issue reference is a literal `Issue #XXX`, and its only consumer is the generated type file.

**Decision 3 — Path A must start with a spec, not a schema.** If Path A is chosen, the first artifact is a `collaboration` capability spec covering room lifecycle, presence, read/write/admin, document ownership and rejection behavior. Schema work before that spec is what produced the current mismatch.

## Cost / risk comparison

| Dimension                | Path A — complete it                                                                                                                                                    | Path B — retire it                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Spec work                | New `collaboration` capability spec; room/presence/permission semantics; interaction with locks and task versioning                                                     | One small `production-readiness` requirement (already written as this change's delta) |
| Schema work              | `documents` + `document_permissions` models, migration, repository; decide task-vs-document identity first                                                              | One migration decision: none (tables never existed)                                   |
| Auth work                | Keep cookie auth, remove `?token=` query JWTs (`:71-73`), remove/limit the `WEBSOCKET_TEST_MODE` bypass (`:66-68`), enforce permissions on WS join and 4 REST endpoints | Delete all of it                                                                      |
| Client work              | New authenticated surface: connect/disconnect lifecycle, presence UI, error and reconnect states                                                                        | None (only generated types change)                                                    |
| Hardest unsolved problem | Realtime edits vs un-deletable locks and `version`-based optimistic saves — currently unspecified and capable of defeating both guarantees                              | Not applicable                                                                        |
| Code volume              | + models, migration, repository, client components, E2E; keeps existing 1,160 infra lines                                                                               | −~1,700 server lines, −~2,600 test lines, −client type entries                        |
| Verification cost        | Permission matrix (5 roles × 5 entry points), two-browser E2E, migration up/down, Redis dependency in CI                                                                | Full pytest, import check, start/stop without Redis, type regeneration                |
| Risk if wrong            | Ships a second, weaker concurrency model alongside the lock system; permission bugs expose other users' documents                                                       | A wanted feature is removed; recovery requires re-implementing it from git history    |
| Reversibility            | Hard to reverse once clients depend on it                                                                                                                               | High: `git revert` restores the code; no data to lose because no table ever existed   |

Estimated effort: Path A is a multi-week feature with an undesigned core; Path B is a single bounded cleanup change of the same size as other route-retirement changes in this repository.

## Risks / Trade-offs

- [Path B breaks an external caller] → No in-repo client; confirm deployed access logs for `/collaboration` before deploying, and consider a short 410 window if traffic exists.
- [Path B weakens shutdown coverage] → `server/tests/test_sol_shutdown.py:17,43-44,155,166,182-183` monkeypatches `collab_service` and asserts it is shut down once, including a failure-injection case named `"collaboration"`. Rewrite those cases against the remaining services instead of deleting the ordering assertions.
- [Path B removes Redis tests that still matter] → `server/tests/integration/test_redis_real.py` covers both pub/sub collaboration and rate limiting; keep the rate-limiting half, which is production behavior.
- [Path A re-exposes query-string credentials] → Any Path A implementation MUST reject `?token=` and rely on the existing HttpOnly cookie path.
- [Redis dependency misread as removable] → `redis = "^7.4"` (`server/pyproject.toml:33`) is still required by `infrastructure/rate_limiting.py`; do not remove it in Path B.

## Migration Plan

Path B: (1) delete the client-visible surface by regenerating types, (2) remove the router and `main.py` registration, (3) remove the lifespan initialize/shutdown and `app.state.collab_service`, (4) delete `infrastructure/websocket/`, (5) delete collaboration-only tests and rewrite shutdown tests, (6) run full pytest + import check + start/stop without Redis. Rollback: revert in reverse order; nothing was persisted, so no data migration is involved.

Path A: (1) spec, (2) identity decision, (3) schema + migration + repository, (4) auth hardening, (5) permission enforcement, (6) client surface, (7) E2E. Rollback is per-step; the migration is additive so earlier steps can ship dark.

## Open Questions

- Does any deployment expose `/collaboration` to traffic today? In-repo evidence says no consumer; production logs were not inspected.
- If Path A: is "document" the existing task, or a new entity? The remaining code assumes a separate `documents` table that was never created.
- If Path A: which concurrency model, and who owns the lock/version interaction design?
- If Path B: should the removal land as one commit or as "client types → routes → infrastructure"?
