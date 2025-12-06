## 1. Async Safety & Lifecycle
- [x] 1.1 Replace module-level intervention singletons with app-scoped dependencies (cache, provider registry, service).
- [x] 1.2 Switch to FastAPI lifespan to init/close DB and shared state.
- [x] 1.3 Make idempotency cache async-safe and integrate with route.

## 2. Contract Tightening
- [x] 2.1 Enforce Anchor typing in intervention history responses (schema-aligned Anchor union).

## 3. Validation
- [x] 3.1 Update/adjust tests for new async cache and run `poetry run pytest`.
- [x] 3.2 Run frontend lint/tests if touched (not required; frontend untouched).
