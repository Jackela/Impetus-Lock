# Authenticated editor maintenance

The editor resolves identity from the server before remote work, keeps drafts and late responses scoped to the confirmed account, and preserves writing and locks across expiry, logout and recovery conflicts. Unassigned legacy drafts require explicit import, export or discard. The approved behavior is specified in `openspec/changes/complete-authenticated-editor-entry/`; PR checks establish implementation evidence, not release or user acceptance.

## Reproduce checks

Run frontend commands from `client/`: `npm ci`, `npm run lint`, `npm run format`, `npm run type-check`, `npm run test -- --coverage`, `npm run test:api-types`, `npm run test:runtime-metadata`, and `npm run build`. Type checks cover application, test and tooling projects. Critical coverage must include every required file and meet 80% lines in each file.

Run backend commands from `server/`: `poetry install`, `poetry run ruff check .`, `poetry run ruff format --check`, `poetry run pydocstyle server/`, `poetry run mypy .`, `poetry run lint-imports`, `poetry run pytest tests/ --cov=server --cov-report=term-missing`, and `poetry run python check_critical_coverage.py`. Set `POSTGRES_TEST_URL` for disposable PostgreSQL integration schemas and `REDIS_URL` for the real Redis tests. CI sets `REQUIRE_REDIS_TESTS=1`, so an unreachable Redis fails the gate. Backend service contracts require PostgreSQL, and collaboration integration tests require Redis and cannot succeed by skipping absent test files or ignoring failures. Unrelated API unit tests isolate the global rate bucket; dedicated Redis tests create their own limiter and unique keys.

For normal-browser authentication checks, set `DATABASE_URL` to a disposable PostgreSQL database and run `python3 scripts/run-auth-e2e.py` from the repository root. The runner applies migrations, creates a real authenticated task, restarts the backend, and runs 29 Chromium checks with normal browser security. It removes the authentication bypass and model credentials. Browser evidence is written to ignored `client/test-results/authenticated-editor/`. The controlled AI HTTP replies in the browser suite do not validate a live model.

## Required integration foundations

The candidate reuses existing public contracts and incorporates the necessary earlier corrections: cookie/CSRF signing, task ownership, scoped idempotency, atomic task versions, safe intervention work off the event loop, style ownership, shared collaboration dependencies, generated API types, complete strict type checks, editor transaction/lock contracts, task callbacks, synchronization races, recovery/loading, active selection and unknown-version safety. Regressions accompany these changes. The bounded Sol adapter and shutdown behavior are tested without paid calls.

Source provenance: authenticated editor implementation `e38c474`, review fixes `5b2fdb9` and `46efcb8`, browser checks `913bd77`, assembled candidate `c8d296e`. The integration carries code, tests and the approved authentication requirement only; local audit/housekeeping histories and unrelated future proposals are excluded. Dependency ranges from the remote base are retained except required missing dependencies, Node 24 types, compatible Milkdown alignment and patched router/math dependencies. Product versions are unchanged.
