# E2E Test Guide

Playwright suites for the editor, task flow, responsive layout, BYOK settings, and the authenticated/story paths. The main config is `client/playwright.config.ts`; authenticated and story suites have separate configs.

## Commands

```bash
cd client

npm run test:e2e          # local main suite
npm run test:e2e:ci       # CI-shaped main suite (one worker, one retry)
npm run test:e2e:ci-like  # one worker + retries, closer to CI locally
npm run test:e2e:auth     # real cookies/CSRF, isolated PostgreSQL
npm run test:e2e:story    # Muse/Loki story flow
npm run test:e2e:ui       # Playwright UI mode
```

Prerequisites for the main suite: backend on `:8000` with `TESTING=1` and the debug provider, Vite on `:5173`, and PostgreSQL migrated. `./scripts/dev-start.sh` starts all three. Authenticated and story suites start their own isolated backend/DB; see `scripts/run-auth-e2e.py` and `scripts/run-story-e2e.py`. `npm run test:e2e:story` invokes the story runner through Poetry and requires `DATABASE_URL` pointing at a disposable PostgreSQL database; it refuses to use an occupied `:8001`.

## Config boundaries

| Config                        | Specs                                 | Notes                                                     |
| ----------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `playwright.config.ts`        | default `e2e/*.spec.ts`               | Excludes auth, safety, story, manual, and `**/*.test.mjs` |
| `playwright.auth.config.ts`   | `authenticated-editor.spec.ts`        | Real login/register/CSRF, isolated data, retries 0        |
| `playwright.safety.config.ts` | `authenticated-editor-safety.spec.ts` | Chromium/Firefox/WebKit evidence suite; manual/CI-gated   |
| `playwright.story.config.ts`  | `muse-loki-story.spec.ts`             | Real backend with provider boundary                       |

## Non-negotiable rules

- **`--strictPort`**: a port conflict must fail. Vite must not drift to `:5174` while Playwright talks to `:5173`.
- **Storage state**: the default suite uses `storage-state.generated.json` from `/test/login`. It is a debug session, not authentication evidence. The authenticated suite proves real cookie/CSRF behavior.
- **Data isolation**: the default debug login uses one shared test user. Do not rely on `resetDatabase` / `seedTestData` helpers; the server does not expose those reset endpoints. Use unique task IDs/names, and use the authenticated suite when account isolation matters. Do not enable parallel workers until per-worker isolation exists.
- **Retries**: CI uses one retry. A test that only passes on retry is flaky and must be fixed; do not raise retries.
- **No fake waits**: prefer `expect.poll`, `expect(locator).toBeVisible()`, `page.clock.fastForward()` for timers, or a state-based wait. `page.waitForTimeout` is a last resort and must be justified.
- **No silent skips**: unimplemented features use `test.fixme(true, "T066 ...")` (currently the four sensory-feedback cases). Do not convert fixme into a passing assertion to clear the report.

## Failure evidence

`client/test-results/<test-slug>/` contains `trace.zip`, `error-context.md`, screenshots, and video for failures. `global-teardown.ts` only removes directories older than `PLAYWRIGHT_ARTIFACT_MAX_AGE_DAYS` (default 7; values below 1 are clamped). The current run's evidence is never deleted.

```bash
npx playwright show-trace test-results/<slug>/trace.zip
```

CI uploads `client/test-results/` on failure and `client/playwright-report/` (HTML/JSON/JUnit) always.

## Helpers

- `e2e/fixtures.ts` — base test with page setup and welcome-modal suppression.
- `e2e/helpers/waitHelpers.ts` — `openHeaderMenu`, `openHeaderDevTools`, welcome dismissal, and state waits. Use these instead of duplicating header selectors.
- `e2e/helpers/auth.ts` — shared registration/login helpers for authenticated specs.
- `e2e/helpers/interventions.ts` — Muse/Loki request helpers.

Add `data-testid` only for stable structural hooks; prefer role/label queries for user-facing behavior.

## Adding a test

1. Pick the narrowest config: default for UI/state, auth for account/session, story for provider flow.
2. Use the existing fixtures and header helpers; do not hardcode ports or URLs (use `baseURL` / `process.env`).
3. Assert user-visible behavior and persistence, not CSS implementation details.
4. Run `npm run test:e2e` (or the specific spec) and then the CI-shaped command.
5. If the test is intentionally blocked by an unimplemented feature, use `test.fixme` with a concrete issue ID and remove it when the feature lands.

## Troubleshooting

- **Backend not starting**: check `DATABASE_URL`, run migrations, and inspect the backend log. `cd server && poetry run uvicorn server.api.main:app --reload`.
- **Frontend not loading**: `cd client && npm run dev`; ensure `VITE_API_URL` points at the backend.
- **Flaky test**: inspect the trace, replace fixed waits with state waits, and check for shared-user data collisions. Do not raise retries.
- **Port already in use**: stop the old process (`lsof -i :5173`, `lsof -i :8000`) or run `./scripts/dev-stop.sh`.
