# Impetus-Lock — Audit followup round 3 completion report

2026-09-16. Closes every remaining item from the round-1/round-2 ledgers
(plus one stale-ledger correction). Base main = `24dcc8a` → PR **#164**
(merge commit `f75030e`, all CI checks green). Same multi-agent protocol
as rounds 1–2: fresh-context implementer per ticket in isolated worktrees,
independent per-ticket review (Spec + Standards), main agent sole
integrator, final assembled-diff review before the PR.

## Correction to prior ledgers

The handoff and both earlier reports still listed "client majors
#126–#128 + #141 prettier split" as pending. **Stale.** Those landed in
the 2026-09-15 continuation (before round 2's PR): `12bf650` (jsdom 29 /
eslint-plugin-jsdoc 62 / globals 17 majors), `40cc7c3` (minor-patch group
incl. prettier 3.9 + 2-file reformat), `34a0f93` (vitest freeze pin) —
verified against `client/package.json` on `24dcc8a`. Round 3 therefore
started from: #129 policy decision, vitest unfreeze, two server hygiene
items, and the model-override cache question.

## Owner decisions (this round)

- **@types/node → 25.x** (dev-only types/runtime skew accepted; `engines`
  stays `>=20.19 <25`, CI/Docker remain Node 24).
- **model-only BYOK override treated as a bug** and fixed (override must
  not be cache-locked).

## Work items

| Item | Result | Integrated as |
| --- | --- | --- |
| Ticket A — streak raise-branch characterization test | `get → None → InvalidRequestError` (post-commit row vanish) covered via an `after_commit` event deleting the row between commit and the post-commit read (aiosqlite StaticPool ordering makes this deterministic; reviewer reran 10/10 green). Mutation-verified: raise→pass makes the test fail. Test-only — the branch already existed. | `d0fac68` |
| Ticket A — `_listen` non-message frames | `else: await asyncio.sleep(0.05)` symmetric with the None branch; theoretical busy-spin on control frames (pongs etc.) closed. Reviewer noted the ticket's premise (round-2 None-branch tests) was false — main had none; both yield paths now have symmetric tests. | `b6ea370` |
| Ticket B — model-only override cache fix | `_resolve_config` default-config branch: `cacheable = model_override is None`. Model-only overrides now build per-request instances honoring the requested model, same close lifecycle as api_key BYOK (route `finally` via `is_cached()`; exactly 2 `get_provider` call sites, both verified). Restores `agentic-interventions` spec "route each request to the requested vendor when valid" — bug fix, no spec delta. Debug provider unaffected (`no_args`, carries no model). Reviewer empirically re-verified RED→GREEN (3/3 fail on main's code). | `e55b341` + `07c2f3d` (docstring precision fixup) |
| Ticket C — vitest unfreeze ~4.0.18 → ~5.0.1 | Research (GO-WITH-CHANGES): no v5.0.x regressions hitting this config (jsdom + vmThreads; v5 regressions concentrate in browser mode); #9957 fixed by #10267 in v5; **GHSA-82fw-gwwq-j7x9 patched** → client `npm audit` = 0. Both `vitest` + `@vitest/coverage-v8` at `~5.0.1` (exact peer pin). **coverage.include rewritten to `**/src/...` globs** — v5 appends `/**` to non-glob patterns (treats them as directories), which would have produced an empty coverage map and a vacuously-passing `lines: 80` gate; verified closed (exactly 6 files, per-file percentages identical to the v4 baseline, aggregate 81.25%). Partial logger mock in `handleManualDelete.test.ts` completed (`event` + faithful console.info mirror) — the pre-existing ~3-5% cross-file mock leak (identical on v4) is now harmless instead of fatal. Config comments updated (v5 context, Node ≥22.12 dev-toolchain note). `engines` intentionally unchanged. clearMocks default flip: zero test impact. | `907c34f`, `78be2bd`, `f7efec6` |
| Ticket D — @types/node ^24.13.4 → ^25.9.7 | tsc/lint/format/tests green, zero fallout; only transitive move is `undici-types` 7.18.2 → 7.24.6 (@types/node's own declared range). | `9929f14` |
| Integration fixup — SC-004 timeout | vitest 5 + v8 coverage runs the 1000-renderHook-cycle distribution test ~3x slower in-suite (5.8–7.2s vs 1.6–2.8s on v4, same machine, back-to-back) — overran the 5s default timeout (2/3 failures pre-fix). Timeout raised to 20s with a constraint comment; 3/3 green after. | `2440e15` |

## Reviews

Four per-ticket independent reviews + one final integration review, all
ACCEPT or ACCEPT-WITH-NOTES, zero blocking findings. Notable review work
product: B's RED→GREEN reproduced empirically; C's dead-gate closure
independently confirmed (6 files, baseline-identical percentages); A's
mutation testing reproduced and interposition mechanics validated
(greenlet-ordered `after_commit`, StaticPool serialization); lockfile
auto-merge (two independently generated locks) re-validated with
`npm ci` + `npm ls` (single deduped tree).

## Gates

Integration branch: server 685 passed / 6 skipped (Redis integration
probe-skips locally), critical coverage **83.28%**, mypy (gate flags) /
ruff / pydocstyle / lint-imports clean; client 541 passed / 4 skipped,
aggregate lines **81.25%**, lint (--max-warnings=0) / prettier / tsc
clean, `npm audit` **0 vulnerabilities** (client and root); openspec
validate --all --strict 17/17. PR #164 CI: all checks green (incl.
Playwright E2E 8m41s).

## Known residuals (all pre-existing unless noted)

1. **vmThreads cross-file mock leak (upstream)**: when the (now-complete)
   leaked logger factory resolves in the wrong VM context, telemetry's
   `vi.spyOn(console, "info")` can miss the call → ~3-10% single-assertion
   flake. Fatal signature eliminated this round; v4 baseline had the same
   leak. `telemetry.test.ts` intentionally keeps the real logger (it is
   the only coverage of `logger.ts`). Follow-ups: dedicated `logger.ts`
   tests would unblock a telemetry-side mock swap; upstream issue to
   vitest (owner action).
2. **Shuffle-order flakiness**: `intervention-flow.test.ts:300` (lock
   count), `useLokiTimer.test.ts` timeout, `interventionClient` BYOK
   header — reproduces on main with vitest 4.0.18 under
   `--sequence.shuffle`. Not a v5 regression; unrelated to the mock leak.
3. **vitest 5 coverage runtime inflation** on hook-heavy tests (SC-004
   ~3x in-suite) — candidate upstream report; mitigated by the raised
   per-test timeout.
4. Debug-provider branch still returns `cacheable=True` with a model
   override — inert (`no_args` provider carries no model); residual
   docstring imprecision acknowledged, cosmetic.
5. `engines` remains `>=20.19 <25` while vitest 5 requires Node ≥22.12
   (dev toolchain only; CI/Docker on 24). Research recommended
   `>=22.12 <25`; owner chose document-only. Revisit at next engines
   review.

`npm-audit-triage-2026-09.md` "Remaining exposure" (GHSA-82fw on the
frozen 4.0.18 chain) is now resolved — client audit is 0.
