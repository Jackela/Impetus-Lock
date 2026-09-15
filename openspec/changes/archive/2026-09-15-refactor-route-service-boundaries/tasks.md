## 1. Contract characterization
- [x] 1.1 Recheck approval and route/schema/repository/service callers; record current HTTP contract and streak spec discrepancy.
- [x] 1.2 Add route characterization tests for two-user isolation, auth failures, pagination, metadata, empty-content acceptance, version conflicts, errors and no-session paths.
- [x] 1.3 Add failing scoped-service tests before extraction, covering task history access, template foreign deletion and streak ownership/date behavior.

## 2. Service extraction
- [x] 2.1 Add explicit user_id to route-facing task operations with compatible validation and injected transaction support; preserve existing callers.
- [x] 2.2 Extract template and streak operations using minimal injected persistence interfaces; keep current calculations and commit/refresh behavior.
- [x] 2.3 Wire routes to services, retaining authentication, schemas, status/detail mapping and version semantics; remove business logic and ORM queries from these routes.

## 3. Verification
- [x] 3.1 Run service/API tests including SQL-backed commit failures and cross-user reads/writes; compare response contracts before and after.
- [x] 3.2 Run backend Ruff, mypy, relevant architecture checks and pytest; review that no route calls an unscoped service operation.
- [x] 3.3 Run strict OpenSpec validation and hand off the refactor with the independent streak discrepancy still explicit.
