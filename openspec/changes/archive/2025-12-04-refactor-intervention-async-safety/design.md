## Context
- Intervention route currently uses module-level singletons (`_idempotency_cache`, `_provider_registry`, `_intervention_service`) and a `threading.Lock` in async code.
- FastAPI emits deprecation warnings for `@app.on_event` startup/shutdown; resource lifecycle is implicit.
- Intervention history responses expose `dict[str, Any]` for anchors, loosening the contract and allowing stringified coordinates.

## Decisions
- Use FastAPI `lifespan` to initialize shared resources (async idempotency cache, provider registry) and close DB on shutdown.
- Store shared resources in `app.state`; inject via `Depends` to remove globals and make overrides testable.
- Replace sync idempotency cache with async-safe version using `asyncio.Lock` and async `get/set/cleanup`.
- Enforce `Anchor` union on history responses via `Anchor.model_validate` to align with the OpenAPI contract.

## Risks / Mitigations
- Risk: Refactors touch async paths; mitigated by updating tests to await cache operations and running full pytest suite.
- Risk: Shared state missing in tests; mitigated by defaulting dependencies to raise if state absent to catch misconfig early.
