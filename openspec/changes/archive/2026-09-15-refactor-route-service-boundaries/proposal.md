# Change: Delegate task, template and streak business logic to services

Status: Proposed; awaiting approval. Tier 3, audit finding A12. No implementation is included.
Approved: 2026-09-15 (user-approved followup implementation plan; implementer dispatched same day).

## Why

Task routes contain ownership/version orchestration; template and streak routes contain ORM queries and business rules. This conflicts with the repository's service-layer requirement. Existing `TaskService` methods are unscoped and impose validation not identical to the current routes, so directly substituting that service could change behavior or expose another user's data.

## What Changes

- Keep FastAPI authentication, request validation, response schemas and HTTP error mapping at the route boundary; delegate business operations to injected services.
- Require authenticated `user_id` in every service operation and preserve ownership checks before access, mutation or history reads.
- Move ORM access behind narrowly scoped repository interfaces and inject transaction support; retain current persistence/no-session outcomes.
- Preserve paths, methods, fields, versions, pagination, status codes and current streak calculations. Spec/code differences in grace rules are separate work.

## Impact

- Affected specs: `templates`, `streaks`, and a minimal `task` capability for existing task endpoints not covered by a current task spec. The editor's existing optimistic-version specification remains unchanged.
- Affected code: `server/server/api/routes/{tasks,templates,streaks}.py`, dependency factories, task service, narrow template/streak services/repositories, and their tests.
- Independent of SDK and frontend cleanup proposals; no schema migration, new endpoint, or new product behavior.
