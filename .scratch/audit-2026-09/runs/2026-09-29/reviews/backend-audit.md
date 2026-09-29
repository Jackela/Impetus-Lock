# Wave 2 — backend audit

Read-only audit at ea0ff6e. No code writes or remote mutations.

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| B01 | P1 | server/server/api/routes/intervention.py:145 | Shared cache key omits authenticated user and task; cross-user response disclosure reproduced | Scope keys to identity and task; preserve same-key retry | 2 |
| B02 | P1 | server/server/application/services/intervention_service.py:289 | X-Task-Id writes history without owner check; cross-user action write reproduced | Check ownership before generate/cache/history using existing 404 | 2 |
| B03 | P1 | server/server/api/routes/intervention.py:146 | Concurrent same-key misses generate and persist twice | Single-flight per effective key, release on failure/cancel, cache after commit | 2 |
| B04 | P2 | server/server/infrastructure/cache/idempotency_cache.py:50 | Unvisited expired entries accumulate during new writes | Automatically purge expired entries in existing cache lifecycle | 2 |
| B05 | P1 | server/server/infrastructure/persistence/postgresql_task_repository.py:102 | Version check and update are not atomic; stale snapshots both write version1 | Atomic compare-and-swap and existing conflict mapping | 2 |
| B06 | P1 | server/server/application/services/intervention_service.py:286 | Sync provider blocks async event loop;150ms call delays heartbeat161ms | Offload synchronous generation, preserve cleanup and error behavior | 2 |
| B07 | P1 | server/server/auth/router.py:74 | Mounted auth router omits CSRF cookie required by middleware | Repair issuer/middleware/client cookie contract; test config loading | 2 |
| B08 | P1 | server/server/infrastructure/llm/debug_provider.py:61 | Fixed act_debug conflicts with unique persisted action_id | Issue unique action ids, preserve idempotent retries | 2 |
| B09 | P2 | server/server/api/routes/collaboration.py:45 | DI creates fresh managers separate from shared collaboration service | Share existing application manager across route/service consumers | 2 |
| B10 | P1 | server/server/api/routes/style.py:337; server/server/api/routes/style_history.py:66 | Profile/history trust caller user_id/record_id without authenticated owner check | Enforce existing identity on all reads/mutations | 2 |
| B11 | P2 | server/server/infrastructure/persistence/style_history_repository.py:110 | Delete returns true even when no row deleted | Return actual deletion outcome | 2 |
| B12 | P2 | server/coverage-critical.ini:3 | Coverage aggregates files and omits TaskService | Each listed file >=80 and add TaskService | 2 |
| B13 | P2 | server/server/api/routes/collaboration.py:109 | Permissions query absent tables, POST falsely reports success, read/write not separated | Draft collaboration persistence and authorization proposal | 3 |
| B14 | P2 | server/server/api/routes/style.py:330 | Remaining style/stats/achievements/collaboration routes contain business queries | Draft scoped route-service boundary proposal | 3 |

## Test seams
- B01: ASGI actual middleware/router/cache with two JWT identities
- B02: ASGI two users and actual repository history
- B03: barrier concurrent ASGI requests, success/failure/retry
- B04: controlled clock set/get and public cleanup result
- B05: two real PostgreSQL sessions plus HTTP409 mapping
- B06: service with blocking boundary provider and heartbeat
- B07: real registration/login/middleware/client boundary without TESTING bypass
- B08: debug provider and real SQLAlchemy history persistence
- B09: actual DI assembly and two room members
- B10: two authenticated identities and real repository
- B11: missing/owned/foreign history deletion
- B12: public coverage gate with low-file and omitted-file fixtures
- B13: proposal only
- B14: proposal only

B01–B09/B11 reproduced with in-memory/SQLite probes; B05 still requires real PostgreSQL concurrency. B10 owner omission is source-confirmed; HTTP RED pending. B12 main-agent baseline confirms per-file shortfalls. JWT import-time vs runtime secret mismatch is conditional and must be reproduced before changing it. CORS preflight200: no new OPTIONS bug. No live LLM/Redis/Playwright/remote CI.
