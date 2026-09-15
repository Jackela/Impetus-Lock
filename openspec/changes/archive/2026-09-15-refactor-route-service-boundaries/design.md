## Context and decision

Routes remain HTTP adapters. Authentication still resolves `current_user`; services receive its explicit `user_id`, never a caller-supplied owner. TaskService must first gain scoped methods and route-compatible validation; do not wire its current unscoped `get_task`, list or mutation methods into authenticated routes. Audit existing service callers before changing signatures. Use existing repository capabilities where available and add only the template/streak persistence operations these routes need. Dependencies are constructor-injected; services do not instantiate ORM sessions or repositories.

## Compatibility boundaries

| Surface | Preserve during extraction |
| --- | --- |
| Task list/create/get/update/delete/actions | User-filtered list/count, owned task lookup before history or mutations; create 201, reads/update 200, delete 204; absent/foreign task 404; version mismatch 409; existing repository-error mapping |
| Task data | All metadata, content and lock IDs, version increment, list ordering/pagination, response schema; no stricter empty-content rule imported accidentally from old TaskService |
| Templates | User-filtered descending list/count and get/delete; create 201, reads 200, delete 204 even when no owned row matches; foreign get 404, no foreign deletion |
| Streaks | Authenticated user row, zero response when absent, UTC same-day no increment, first activity initializes one day, later date increments as currently implemented; existing response fields including longest_streak_days |
| Database unavailable | Task repository fallback and optional commit behavior; template list empty 200, template create/get/delete 500; streak get/update 500 |
| Transport | Existing authentication failure behavior, FastAPI 422 validation, paths/methods and contract/version headers where applicable |

The current streak implementation increments after any date change and does not implement the full grace/recovery rule in the existing specification. Preserve that observed calculation during extraction and record the discrepancy for separate behavior work; do not claim it fulfills the grace specification or amend that specification here.

## Transactions and errors

Keep HTTP exception construction in routes and translate typed service failures to the same status/detail. Service operations use injected persistence and transaction support; writes finish the existing commit/refresh sequence before successful return. Avoid both service and route committing the same operation. An absent optional session must retain the table's outcomes. Failure tests check that unsuccessful persistence is not returned as success.

## Verification and rollout

Characterize route contracts first, including two users and missing sessions. Add service tests demonstrating rejected cross-user operations before moving handlers. Migrate one route family at a time with shared fixtures and identical API assertions. No generic service framework or data migration is needed. Rollback restores route wiring and extracted service changes together; any discovered behavioral correction requires separate scope.
