# Dependabot followup dispositions (2026-09-15)

Base: `109a2ec` (local main). All work local; no remote PR merges/comments/closures. Verified per the user-approved followup plan: same-major dev tools + coordinated telemetry + CI actions group are APPLIED locally with full gates; majors and the 23-item group are VERIFY-ONLY records.

## Landed locally (5 PRs superseded; will auto-close on push)

| PR | Change | Local commits | Verification |
| --- | --- | --- | --- |
| #117 | mypy `^1.11.0` → `^1.20.1` | `2167c18` | locked 1.20.2; ruff/format/lint-imports/mypy clean; 610 passed/4 skipped |
| #120 | pytest-xdist `^3.6.0` → `^3.8.0` | `2432cd4` | locked 3.8.0; full parallel suite green (xdist itself exercised) |
| #118 | import-linter `^2.0` → `^2.11` | `eb9f3ae` | locked 2.15; 3 contracts kept, 0 broken |
| #119 | opentelemetry-api `^1.27.0` → `^1.41.0` | `69701c6` | PR bumps api only; landed as COORDINATED constraint alignment of api/sdk/exporter — all three were already locked at 1.44.0 by the t2 re-lock and green since; commit aligns declared floors (`^1.41.0`) |
| #135 | actions group: wait-on-check-action v1.3.1→v1.7.0 (×2), ssh-agent v0.9.0→v0.10.0 | `109a2ec` | YAML-validated; workflow inputs unchanged by both bumps |

## Verify-only records (8 PRs; nothing landed)

### #126 jsdom 27.4.0 → 29.0.2 — SAFE TO LAND (deferred)
All gates green (lint/type-check/test: 53 files, 541 passed/4 skipped, 81.25% lines). One benign jsdom stderr ("Not implemented: navigation to another Document") from textRange.test.ts with all 3 tests passing. Recommendation: land when convenient; watch that stderr in CI logs.

### #127 eslint-plugin-jsdoc 61.7.1 → 62.9.0 — SAFE TO LAND (deferred)
All gates green. The audit's risk (v62 defaults vs newly-enforced jsdoc presence rules) did not materialize: `require-jsdoc/require-description/require-param/require-returns` are explicit `"error"` in config, and src/** passes under v62 unchanged. Recommendation: land when convenient.

### #128 globals 16.5.0 → 17.5.0 — SAFE TO LAND (deferred)
All gates green. globals IS consumed (`eslint.config.js` `globals.browser`); v17 browser set loads fine.

### #129 @types/node 24.10.13 → 25.6.0 — TECHNICALLY GREEN, POLICY HOLD
All gates green incl. type-check. Policy: repo engines are `>=20.19 <25` and CI runs Node 24; types@25 describes a runtime outside the supported range. Recommendation: hold until engines include Node 25, or land accepting the types/runtime skew (decision belongs to owner).

### #134 redis `^5.0.0` → `>=5,<8` — NEEDS LOCK SYNC (not landed)
Resolves cleanly to redis 7.4.1 with zero transitive changes; full API surface used by the repo (`redis.asyncio` in `infrastructure/rate_limiting.py`, `infrastructure/websocket/redis_pubsub.py`) exists in 7.4.1; static gates + 610-test suite green with 7.4.1 installed; mocked pubsub unit tests (34) pass. LIMITATION: the repo's Redis tests are all mocked (no local redis-server) — redis 5→7 runtime behavior (connection mgmt, RESP3, pubsub semantics) is UNVERIFIED locally. Recommendation: land as `>=5,<8` (or `^7.4`) WITH `poetry update redis` lock sync, ideally after one real-Redis-7 CI/staging run of collaboration + rate-limit paths. Pre-existing defect found (both 5.3.1 and 7.4.1): `tests/conftest.py:28` `os.environ.setdefault("REDIS_URL", ...)` defeats the skipif of `TestCollaborationServiceRedisIntegration::test_handle_redis_message`, which then busy-loops forever on a mocked `get_message` — any test selection including it hangs.

### #136 dependabot/fetch-metadata v2 → v3 — REVIEWED, SAFE ON HOSTED RUNNERS
Local usage (`dependabot-auto-merge.yml:31`) passes only `github-token`; v3 keeps inputs/outputs, breaking change is the Node 24 action runtime (Actions Runner ≥ 2.327.1). GitHub-hosted runners unaffected. Sources: [releases](https://github.com/dependabot/fetch-metadata/releases).

### #137 docker/setup-buildx-action v3 → v4 — REVIEWED, SAFE ON HOSTED RUNNERS
Local usage (`deploy-staging.yml:40`) passes NO inputs; v4 removes deprecated inputs (unused here), breaking change is Node 24 runtime / runner ≥ 2.327.1. GitHub-hosted runners unaffected. Sources: [releases](https://github.com/docker/setup-buildx-action/releases).

### #141 minor-patch group (23 updates) — SPLIT REQUIRED (not landed)
Full group: lint/type-check/test all green (541 passed/4 skipped, 81.25% lines); ONLY prettier 3.8.1→3.9.x breaks `npm run format` on exactly 2 files (`src/hooks/useTaskSync.ts`, `src/types/task.ts` — mechanical collapse of multi-line string-literal unions), reproduced on both 3.9.6 and the PR's pinned 3.9.3. Buckets: editor/runtime (11: milkdown 7.18→7.22, react 19.1→19.3, tanstack-query, framer-motion, recharts) green alone; test toolchain (vitest 4.0→4.1, @playwright/test) + build tooling (typescript-eslint 8.54→8.70, react-refresh 0.4→0.5, prettier) green except prettier's format change. Notes: `@milkdown/plugin-listener` returns ONLY as a transitive dep of `@milkdown/kit@7.22` (no src references — acceptable); PR base predates local changes, so versions were re-resolved from ranges (newer than PR pins in some cases). Recommendation: land as one group + a one-shot `prettier --write` of the 2 files, or exclude prettier into its own ticket.

## Cross-cutting notes

- `npm ci` was run in the main worktree after verification to restore node_modules to the committed lock (verification installs had mutated the shared tree).
- Pre-existing `npm audit` report (2 low/5 moderate/8 high) observed during #141 verification — out of scope, uninvestigated.

## 2026-09-15 continuation ("彻底解决"): remaining majors landed

| Item | Outcome | Vehicle |
| --- | --- | --- |
| #147 mypy 2.3.1 | Landed — zero source changes needed; mypy 2.3 clean over 106 files; 610 passed | #159 (local landing, #147 closed superseded) |
| #148 anthropic 1.5.0 | Landed — TDD characterization (15 tests green on 0.40 → exact RED on removed `temperature` kwarg → green via `extra_body` on 3 call sites); instructor path verified wire-level (extra_body reaches request JSON); 625 passed, critical 82.77% | #161 (local landing, #148 closed superseded) |
| Client minor-patch group (#141/#145 family) | Landed — ~20 minor/patch bumps (milkdown 7.22, react 19.3, playwright 1.63, testing-library, eslint toolchain 8.70, prettier 3.9 + 2-file reformat, …); majors excluded; @types/node held at 24.x per engines policy | #160 |
| Playwright E2E infra | e2e.yml Docker image aligned v1.58.2→v1.63.0-noble (required by the bump; the workflow's own version check flagged it) | #160 |

Known issues recorded during this pass:
- **vitest 4.1 cross-file mock leakage** (held at ~4.0.18 in #160): on CI, file-scoped `vi.mock` factories leak across test files (telemetry via logger mock; EditorCore.persistence via ContentInjector mock) in a worker-grouping-dependent way; not reproducible locally at default workers; `maxWorkers:1` makes it worse; `isolate` is already default-true. Two partial mocks completed as hardening. Take vitest 4.1 up again when upstream clarifies (no matching GitHub issue found as of 2026-09-15).
- anthropic 1.5 emits a model-EOL DeprecationWarning for `claude-3-5-haiku-latest` (2026-02-19) — model refresh is a separate product decision.
- Auto-merge machinery now fully operational end-to-end (first unassisted merge: #154; six-fix chain #150/#153/#155/#156/#157/#158 plus repo `allow_auto_merge` enabled).
