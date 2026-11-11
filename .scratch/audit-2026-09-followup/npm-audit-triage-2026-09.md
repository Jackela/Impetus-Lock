# npm audit triage — 2026-09-15 (hardening round 2, ticket T4)

Scope: client + repo-root lockfiles. Production dependencies (`npm audit --omit=dev`): **0 vulnerabilities** in both. All findings below are dev-only chains.

## TL;DR

Root and client were **not** the same chain. Root's advisories come from the lint-staged chain (picomatch + yaml) and are **fixed in-range** (landed this round via `npm audit fix`, commit `db7c9b8`: picomatch 2.3.1→2.3.2, yaml 2.8.2→2.9.1; root now 0 vulnerabilities). Client's vitest chain has **no 4.0.x patch**; the fix (4.1.11) is held by the vitest freeze, whose underlying bug (#9957) is only fixed in **v5.0.0** — unfreeze target is therefore vitest ≥5.0.0, not 4.1.x.

## Findings

### GHSA-82fw-gwwq-j7x9 (CVE-2026-84373) — vitest / @vitest/mocker (client, dev)

- Affected: vitest/@vitest/mocker >= 2.1.0 through 4.1.x; fixed in **4.1.11** and **5.0.0-rc.2 / 5.0.0**. No 4.0.x backport ("Older majors are not maintained"), so no fix within the repo's `~4.0.18` freeze.
- Vector: redirect mock path traversal via `join(server.config.root, redirectUrl.pathname)` without `server.fs.allow` check in `interceptorPlugin.ts`; triggered through the dev-server HMR websocket (`vitest:interceptor:register`, no token/Origin check). Remediation PR [vitest#10974](https://github.com/vitest-dev/vitest/issues/10974) (merged 2026-08-17).
- Reachability in this repo: **not reachable** — jsdom + forks/threads pools (no browser mode), no third-party dev server consuming `mockerPlugin`, dev server not exposed beyond localhost; repo's test code is fully first-party. Advisory page: [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [OSV](https://osv.dev/vulnerability/CVE-2026-84373).
- Disposition: **accepted risk, recorded** (dev-only, unreachable config, no in-range fix). Revisit when the freeze lifts (see below).

### Freeze rationale check — vitest #9957 (not an npm audit item)

- The cross-file mock leak behind the `~4.0.18` freeze is [#9957](https://github.com/vitest-dev/vitest/issues/9957) (browser mode manual-mock leak across spec files, reported on 4.1.0). Fix PR [#10267](https://github.com/vitest-dev/vitest/pull/10267) merged 2026-05-08 **on main (v5 line) only** — compare against tag v4.1.11 diverges; no 4.1.x release contains it.
- #9957 is a **browser-mode** bug; this repo runs `environment: "jsdom"` + forks pools (`client/vitest.config.ts`), so the freeze reason would not trigger here anyway.
- **Unfreeze gate (updated)**: vitest **≥5.0.0** (fixes both GHSA-82fw and #9957), or an upstream 4.1.x backport (no sign of one as of 2026-09-15). Waiting on 4.1.x is pointless.

### Root chain (dev-only, lint-staged) — FIXED this round

| Advisory | Package | Severity | Disposition |
| --- | --- | --- | --- |
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) (CVE-2026-33671) | picomatch 2.3.1 | high (ReDoS) | fixed in-range → 2.3.2 |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) (CVE-2026-33672) | picomatch 2.3.1 | moderate (prototype injection) | fixed in-range → 2.3.2 |
| [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) (CVE-2026-33532) | yaml 2.8.2 | moderate (deep-nesting DoS) | fixed in-range → 2.9.1 (npm chose latest in `^2.7.0`) |

All three were unreachable in practice (lint-staged only globs repo-owned config), but in-range fixes are zero-risk, so applied per the round's "可修的走升级/补丁" policy. Verified: `npm audit` at root = **0 vulnerabilities**; `lint-staged --version` 15.5.2 works; only root `package-lock.json` changed.

## Baseline drift explanation (ledger said "2 low / 5 moderate / 8 high")

The earlier baseline was measured **before** the four deps commits that landed on 2026-09-15 (`6aafde0` plugin-listener removal, `12bf650` jsdom/jsdoc/globals majors, `40cc7c3` client minor-patch group, `34a0f93` vitest freeze pin): those commits eliminated most of the 15 advisories. The root lockfile itself had not changed since 2026-04-13; its side of the baseline difference is counting-scope (client vs root merged), not dependency change. No advisories were withdrawn.

## Severity-reporting note

Same GHSA shows as "critical" on the vitest package entry and "moderate" on @vitest/mocker (npm-side per-package grading). The client-vs-root severity mismatch in earlier notes was a misreading: root never had vitest in its lockfile at all.

## Remaining exposure

- client dev chain: GHSA-82fw (moderate/critical) — accepted until vitest ≥5.0.0 unfreeze ticket.
- Everything else: 0.
