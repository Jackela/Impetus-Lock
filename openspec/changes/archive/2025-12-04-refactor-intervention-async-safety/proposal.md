# Change: Refactor Intervention Async Safety & Contract Tightening

## Why
- Module-level singletons and thread locks in async routes risk event-loop blocking and are hard to override in tests.
- Intervention history responses loosen the Anchor schema, drifting from the contract and reducing predictability.
- Startup/shutdown still uses deprecated FastAPI event hooks, emitting warnings and leaving resource lifecycle implicit.

## What Changes
- Introduce app-scoped, async-safe idempotency cache and provider registry via FastAPI lifespan/app.state.
- Remove module globals in the intervention route; inject dependencies explicitly and keep default provider resolution predictable.
- Enforce anchor typing on history responses using the shared Anchor model.
- Migrate startup/shutdown to lifespan to initialize/close database and shared resources cleanly.

## Impact
- Affected specs: none (behavioral alignment with existing contract).
- Affected code: FastAPI app lifecycle, intervention route, idempotency cache implementation, related tests.
