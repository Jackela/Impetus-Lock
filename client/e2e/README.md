# E2E Test Guide

Playwright suites for the editor, task flow, responsive layout, BYOK settings, and the authenticated/story paths. The main config is `client/playwright.config.ts`; authenticated and story suites have separate configs.

## Commands

```bash
cd client

npm run test:e2e          # local main suite
npm run test:e2e:ci       # CI-shaped main suite (one worker, one retry)
npm run test:e2e:ci-like  # one worker + retries, closer to CI locally
npm run test:e2e:auth     # browser only, needs the auth runner's backend
npm run test:e2e:story    # Muse/Loki story flow
npm run test:e2e:ui       # Playwright UI mode
```

Prerequisites for the main suite are a backend on `:8000` with `TESTING=1` and the debug provider, Vite on `:5173`, and a migrated PostgreSQL database. `./scripts/dev-start.sh` starts all three. For real authentication, set `DATABASE_URL` to a disposable PostgreSQL database and run `python3 scripts/run-auth-e2e.py` from the repository root. The runner applies migrations, restarts the backend on `:8001`, and runs `npm run test:e2e:auth`. The story runner also needs a disposable `DATABASE_URL` and uses `:8001`.

## Config boundaries

| Config                            | Specs                                                               | Where it runs                                       |
| --------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| `playwright.config.ts`            | Default editor and UI specs                                         | E2E Tests workflow, local Vite                      |
| `playwright.auth.config.ts`       | Basic auth, draft recovery, and selected account recovery scenarios | Authenticated Editor workflow and local auth runner |
| `playwright.safety.config.ts`     | Full `authenticated-editor-safety.spec.ts`                          | Manual Chromium, Firefox, and WebKit evidence suite |
| `playwright.story.config.ts`      | `muse-loki-story.spec.ts`                                           | E2E Tests workflow and local story runner           |
| `playwright.production.config.ts` | `production-proxy.spec.ts`                                          | CI production images job and local smoke script     |

The account recovery project in the regular auth gate covers shared cookies across tabs, unknown draft versions, and recovery when a task creation response is lost. Use the auth config with `--list` to see the current case names.

## Production images

On a host with Docker, Node, jq, the client dependencies, and Playwright Chromium installed, run these commands from the repository root.

```bash
docker build -f server/Dockerfile.prod -t impetus-ci-api:local server
docker build -f client/Dockerfile.prod -t impetus-ci-client:local client
TEST_API_BASE_IMAGE=impetus-ci-api:local TEST_CLIENT_BASE_IMAGE=impetus-ci-client:local \
  bash scripts/run-production-smoke.sh
```

The smoke test uses a disposable PostgreSQL database. It checks the built editor with normal Chromium security and real Web cookie/CSRF requests, the WeChat session route through Nginx, and credentialed CORS preflight against the backend image. The WeChat route is checked with a request that fails local schema validation before any platform call. Serve the authenticated editor and its API from the same origin so the editor can read the host's CSRF cookie.

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
