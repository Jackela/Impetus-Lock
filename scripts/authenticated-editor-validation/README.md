# Authenticated editor validation environment

This small harness runs the authenticated editor candidate against an isolated PostgreSQL and Redis, with real JWT cookies, CSRF, expected-account checks and rate limits. It does not set `TESTING`, load `.env` or use paid model credentials. It is validation tooling, not a production entrypoint.

The source lives here; generated evidence and private settings live under `.scratch/authenticated-editor-safety-2026-10-11/`. Neither old scratch sources nor historical evidence are required. `client/playwright.safety.config.ts` uses default browser security, one worker and zero test retries. The existing `playwright.auth.config.ts`, `npm run test:e2e:auth` and `scripts/run-auth-e2e.py` retain the separate 29-case CI entry on ports 8001/3000. The default `playwright.config.ts` excludes both real-auth suites because its ordinary `TESTING` environment cannot establish their contracts.

## First initialization

Run from the repository root. Install the repository's locked dependencies (`npm ci` in `client`, and `poetry install` in `server` with an in-project `.venv`) and install Playwright's matching browser binaries. Python 3.12 and Node 24 were used for this round.

Create the dedicated local VM without changing the default Docker context:

```sh
colima start impetus-auth-safety --activate=false --cpu 2 --memory 2 --disk 10 --root-disk 10 --mount none --ssh-config=false
server/.venv/bin/python scripts/authenticated-editor-validation/services.py up
server/.venv/bin/python scripts/authenticated-editor-validation/services.py backend-up
```

`up` creates only task-labelled `impetus-auth-safety-postgres` and `impetus-auth-safety-redis`, their dedicated volumes, browser database `impetus_auth_safety_20261011`, and disposable regression database `impetus_regression_safety_20261011`. Ports are PostgreSQL 5433, Redis 6381, API 8101 and frontend 3101, all on loopback. Redis database 0 is for the browser, database 1 for regression. Occupied ports or foreign containers are rejected. Existing private settings are required to resume existing containers; retain them with their corresponding volumes. No user database or old worktree service is reused.

Only the allowlisted environment in `runtime.py` is supplied to the real backend. `.env.runtime.json` is created with mode 0600 and contains fresh local PostgreSQL/JWT/CSRF secrets. Metadata contains no secret values. This harness uses loopback HTTP, so it explicitly sets `APP_ENV=development` for the existing local HTTP cookie policy; `ENV=production` retains other runtime production conditions. Cookies, CSRF and expected-account checks remain real. HTTPS and production Secure-cookie behavior require their separate API contract checks; these HTTP browser runs do not establish deployed TLS behavior. The backend socket guard blocks external connections; the E2E suite supplies explicit controlled AI HTTP responses. `ResponseGate` delays actual ASGI response headers for a selected request and leaves the real auth and business code intact. It separately records a disconnect consumed by business code, the real Uvicorn cycle's disconnected state, the transport's closing state and delegated transport write counts/bytes/Set-Cookie presence. It never consumes additional request messages or records cookie values. A transport write means bytes were handed to the real transport; neither that nor an ASGI send return proves browser delivery. Actual shared-browser cookies, `/auth/me` and the pending-auth barrier determine the browser outcome.

A VM DNS failure was observed during this round: `/etc/resolv.conf` targeted a missing `/run/systemd/resolve/stub-resolv.conf`. If this exact failure recurs, repair only this dedicated profile before pulling images:

```sh
colima -p impetus-auth-safety ssh -- sudo sh -c 'mkdir -p /run/systemd/resolve && printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > /run/systemd/resolve/stub-resolv.conf'
```

## Production browser runs

Build and run from `client`:

```sh
VITE_API_URL=http://127.0.0.1:8101 npm run build
AUTH_E2E_MODE=preview AUTH_E2E_RUN=cold-1 npx playwright test -c playwright.safety.config.ts --project=safe-chromium-auth --retries=0
AUTH_E2E_MODE=preview AUTH_E2E_RUN=cold-2 npx playwright test -c playwright.safety.config.ts --project=safe-chromium-auth --retries=0
AUTH_E2E_MODE=preview AUTH_E2E_RUN=webkit npx playwright test -c playwright.safety.config.ts --project=safe-webkit-auth --retries=0
```

The frontend is owned and stopped by each runner; `reuseExistingServer=false`. Before each cold run, use `services.py backend-stop` then `backend-up`, checking actual listener shutdown. Distinct `AUTH_E2E_RUN` values preserve result JSON, screenshots and retained failure traces. Real UI registration checkpoints are private files per OS/browser; subsequent setup performs real UI login and checks the same user ID. Setup may wait for an actual 429 `Retry-After`, recorded separately. After account setup it waits one real login-policy window to isolate the next runner's Redis/IP budget. Delayed auth asserts an actual 200 response with Set-Cookie headers before closing its sender. The 201-row Modal fixture uses genuine authenticated HTTP and records POST counts and actual 429 waits; its longer total timeout covers those fixture windows. Business tests and unknown writes are never retried.

AI fixtures use production entrypoints. To add a constraint, native input creates an independent editable paragraph; the public Muse “I'm stuck!” button requests a controlled HTTP rewrite of that paragraph's actual document range. The fixture checks every complete paragraph including its lock metadata, all existing locks, the new lock and exact persisted body/locks against the owned working copy. The autosave case additionally preserves the original Loki-provoke branch. It and the two Loki delete/rewrite cases retain production Loki mode and wait for its real 30–120 second random timer, without a clock or crypto override. They allow 125 seconds for that actual request and 220 seconds total for fixtures and the original persistence checks; their action and expectation timeouts and zero test retries stay unchanged. Development-only buttons are never used.

macOS 27 Firefox 155 fails to launch with `Could not find profile folder`, independently of product source. The alternate entry runs normal-security Firefox in the official matching `mcr.microsoft.com/playwright:v1.63.0-noble` image; report its Linux OS separately. Start frontend 3101 preview independently for this external runner, then run from the repository root:

```sh
server/.venv/bin/python scripts/authenticated-editor-validation/linux_firefox.py prepare
server/.venv/bin/python scripts/authenticated-editor-validation/linux_firefox.py run firefox-linux
```

The container uses a raw TCP relay so the browser still sees the same loopback UI/API origins and cookies. Firefox collects only cases not requiring host Python/filesystem gates. The image version is read from `client/package-lock.json`. The `prepare` entry refuses an existing container with a different image; preserve its evidence and verified stock binary before recreating it. Browser test isolation, visible operations and semantic locators follow [Playwright best practices](https://playwright.dev/docs/best-practices).

Chromium uses the official full browser (`channel: chromium`) in new headless mode for both cold runs and performance. In the two existing cross-tab focus cases, public CDP disables Playwright's simulated all-page focus. Normal `bringToFront` must then produce mutually exclusive `document.hasFocus()` states, native trusted blur/focus and the real `/auth/me` recheck. Observers record events; they never dispatch them. Default headless-shell performance cannot establish this full-browser target.

The matching Linux image also contains Xvfb. Its isolated virtual display can execute the same two WebKit focus cases without taking the user's foreground:

```sh
server/.venv/bin/python scripts/authenticated-editor-validation/linux_firefox.py run-webkit-focus webkit-linux-native-focus
```

Only this explicit entry uses headed WebKit in the container's private virtual display. Playwright 1.64's local private PageProxy protocol clears its optional `Emulation.setActiveAndFocused` override; no product handler, DOM event or security option is replaced. This seam is version bound by the lockfile. Record engine, OS, display and protocol with the actual trusted events. The other 18 WebKit checks remain on macOS because one performs a real host backend restart. Report the 18 macOS and two Linux cases separately; they are not one complete run in one environment.

The matching Playwright Firefox package registers its document actor before the Juggler protocol-argument guard; that actor's initialization path sets document focus overrides, and the bundled startup configuration enables focus test mode. Absence of a protocol argument therefore does not establish ordinary native focus. The explicit stock entry instead uses the unmodified official [Firefox 155 Linux ARM64 archive](https://archive.mozilla.org/pub/firefox/releases/155.0/linux-aarch64/en-US/firefox-155.0.tar.xz), verified against Mozilla's [SHA512SUMS](https://archive.mozilla.org/pub/firefox/releases/155.0/SHA512SUMS). Its archive SHA512 is `5663cc174a7e90b9c3d926d78bbf99682b56344c3f02d1f2884619845cd4327eb8b7380301234fbaf378a20f4dca7d719d9424bda793fb5db367b00be6b5a070`. Keep the verified extraction in this same container; pass its absolute launcher path:

```sh
server/.venv/bin/python scripts/authenticated-editor-validation/linux_firefox.py run-firefox-stock firefox-linux-stock-155 /tmp/impetus-stock-firefox155-arm64-a61b129fe4e1/firefox/firefox
```

This entry runs all 18 current Firefox cases, including both cross-tab focus cases, without a CLI exclusion, skip or retry. It uses the existing private Xvfb display and Playwright 1.64's `moz-firefox` BiDi channel with `focusmanager.testmode=false` and `layout.testing.top-level-always-active=false`; other recommended preferences and browser security remain unchanged. `AUTH_E2E_FIREFOX_STOCK_EXECUTABLE` is accepted only as an existing absolute Linux path. Without it the original bundled Juggler configuration remains. The static stock comparison observed trusted, mutually exclusive focus after native `bringToFront`; only actual complete business-case execution establishes the Modal results. This does not establish actual assistive-technology acceptance.

Playwright 1.64's BiDi `fill` implementation writes the DOM value and dispatches an input event. This explicit channel instead enters the same fixture strings with native page activation, locator click, select-all, Backspace and `pressSequentially`, so React-controlled fields receive real keyboard input. Other browser entries retain their original `fill` operations; business routes and assertions remain the same.

For the explicit stock channel, a bounded Firefox 155 request collector is installed on the current page before protected business interceptions. The adapter binds the physical request ID to the same internal Request, top-level context, URL and method, reads its actual native bytes, preserves the original JSON/body assertions and supplies that same Buffer to `route.fetch` for POST/PUT. GET and other engines retain their original paths. Collectors are removed before login/register input and at test cleanup; evidence records only request identity, path, method, byte count and SHA256, never bodies or headers. Missing native bytes fail the test. This private Playwright session binding is specific to locked version 1.64.

## Backend collection and recovery

From the repository root:

```sh
server/.venv/bin/python scripts/authenticated-editor-validation/services.py regression .venv/bin/python ../scripts/authenticated-editor-validation/collection.py tests/ -m 'not llm_live' --cov=server --cov-report=term-missing --cov-report=json -ra
server/.venv/bin/python scripts/authenticated-editor-validation/services.py restart
server/.venv/bin/python scripts/authenticated-editor-validation/services.py down
```

The regression child command runs from `server`; the paths above account for that. `collection.py` saves collected IDs, deselection, ignored paths, optional SDK availability and every actual skip/failure. Repository pytest fixtures set `TESTING=1`; these tests are distinct from the backend used by the real browser. List skips explicitly and do not skip core acceptance scenarios.

`regression-reset` recreates only the named disposable regression database. Coordinate concurrent regression users first; it never resets the browser database. `restart` snapshots exact task IDs, owners, body, locks and versions, stops only the owned backend PID, verifies port 8101 closed, then uses the same database and signing settings. `down` stops only owned backend/containers and preserves their volumes and recovery evidence. Request cancellation does not imply a database rollback.

The performance case uses exactly 10,000 rendered words and 10 locks, with 30 native input, task-switch and locked-deletion-rejection samples. It records local UI latency separately from HTTP save timing and asserts each UI p95 below 100 ms. After every measured sample it independently checks all 121 rendered paragraphs against the full fixture and accumulated input, and checks the exact set of lock IDs. Those checks happen outside the unchanged native-event-to-paint interval. Run final performance checks with no concurrent tests or builds and record the actual process/environment snapshot. Locked deletion is specifically Backspace on a confirmed ProseMirror selection with newly observed rejection feedback; it does not measure all lock operations. Actual assistive technology, keyboard, 320px, 200% text and 400% zoom checks remain independent acceptance evidence; axe results do not substitute for them.

## Controlled Sol HTTP and service exit

Run `server/.venv/bin/python scripts/authenticated-editor-validation/sol_http_probe.py` from the root after `services.py up`. It starts only its own API 8102 and local HTTP responder 8103, using a separately named `impetus_sol_safety_20261011` database. Existing ports are rejected, and the responder and API are stopped by the probe.

The exact official Sol base URL/model still choose the real SDK parse branch. Only the SDK transport redirects bytes to the local responder; no paid OpenAI service is contacted. The app executes real auth/CSRF, repository work, commits and lifespan shutdown. Evidence separately records HTTP completion, idempotent retry, exact PostgreSQL history, the active-request drain, actual SDK transport close, actual database/cache cleanup and process/listener exit. The repository stores the anchor field `from_` while HTTP uses its `from` alias; both exact forms are retained. Uvicorn may restore and re-raise the received SIGTERM after lifespan cleanup, so the expected `-15` exit is recorded rather than rewritten to zero.
