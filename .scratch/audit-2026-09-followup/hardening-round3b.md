# Impetus-Lock — Round 3b: residual flake elimination

2026-09-16. Closes the "known residuals" list recorded in
[hardening-round3.md](hardening-round3.md) (owner directive: 彻底解决).
Base main = `131e25f` → PR **#166** (merge commit `2ed3376`, all CI checks
green). Same multi-agent protocol: three parallel tickets (fresh-context
implementer per isolated worktree), independent review per ticket, main
agent sole integrator, final assembled-diff review, hot-fix re-reviewed.

## Work items (8 commits)

| Item | Result | Integrated as |
| --- | --- | --- |
| W1a logger leak — structural fix | Removed the suite's ONLY `vi.mock` factory for `utils/logger` (existed purely for console silencing; real logger = zero noise, no spy needed). With no factory registered, the module always resolves real+local — the leaked-factory scenario for telemetry is structurally impossible. Reviewer independently confirmed zero logger factories repo-wide. | `0dd4b9d` |
| W1b dedicated logger tests | New `src/utils/logger.test.ts`, 17 characterization tests pinning real semantics: LogLevel ordering, per-method console routing, namespace/level gating (`<=` direction, `startsWith` prefix anchoring), `event()` JSON shape, default config, three quirks (namespace gate snapshotted at `createLogger()`; level read per call; `event()` bypasses level). Previously logger.ts was covered only incidentally via telemetry. | `637b8b8` |
| W1-hotfix order independence | Combined-branch shuffle stress caught an ~8% flake in the NEW tests (default-config describe relied on "runs first"; `--sequence.shuffle` randomizes in-file order — the very disease this batch eliminates). Fixed with `vi.resetModules()` + per-test dynamic import for pristine module state; separately re-reviewed (ACCEPT). | `25feba7` |
| W2a intervention-flow `getLockCount` | Root cause was IN-FILE order dependence (shuffle also shuffles tests within files; the default reporter renders collection order, masking this): the Error-Handling describe lacked `lockManager.clear()` while sibling tests leave locks in the in-memory singleton. File-level `beforeEach` clear. Repro seeds 5/12. | `3b41e19` |
| W2b useFocusTrap (new finding) | `getElementById` shadowing from a never-removed fixture container; `afterEach` container removal. Repro seeds 25/29/32/41. | `5af32ea` |
| W2c vmThreads leak — victim pins | Passthrough pins `vi.mock(p, () => importOriginal())` on the three observed victims (telemetry, ContentInjector, EditorCore.persistence): self-declaring files are immune to the registry leak, semantics stay real. Polluter-side factory completion via `importOriginal` spread was tested and REJECTED (crashes victims: `Vitest mocker was not initialized`). | `dee01ac` |
| W2d dispositions | useLokiTimer timeout: confirmed mitigated by round 3's 20s ceiling. interventionClient BYOK mismatch: NOT reproducible across 56 valid vmThreads pairs + 58+ full shuffles (earlier evidence had run on the wrong pool — bare `npx vitest` = config-default forks); escalated as monitored, no repro → no code change. | — |
| W3 engines floor | `client/package.json` engines `>=20.19 <25` → `>=22.12 <25` (vitest ~5.0.1 toolchain; npm engines `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`); lockfile root mirror; README/deployment-guide/vitest.config comment aligned; historical/archived records untouched. | `982c0f1` |
| Review-driven fixups | deployment.md Dockerfile example `node:20-alpine` → `node:24-alpine` (W3 review catch); logger test header "two quirks" → three (W1 review catch); provider_registry `_resolve_config` docstring now states the debug-provider exception (round-3 final-review note). | `1611726` |

## Upstream reports filed (vitest-dev/vitest)

- **[#11284](https://github.com/vitest-dev/vitest/issues/11284)** — vmThreads
  cross-file `vi.mock` leak with `isolate: true`, v4+v5: minimal repro
  (React plugin + tsx + `vi.hoisted` trigger combination) leaking 2/30
  runs; documents the split-registry signature (transitive import mocked,
  direct namespace import real) and the polluter-context closure/console
  mechanism; victim-side passthrough pin as workaround.
- **[#11285](https://github.com/vitest-dev/vitest/issues/11285)** — v5 ×
  v8-coverage in-suite inflation on hook-heavy tests: measurement matrix
  (v4+cov 1.6–2.8s vs v5+cov 5.8–7.2s vs v5 no-cov 0.94s in-suite,
  0.62s isolated) for a 1000× renderHook-cycle test; local mitigation is
  the 20s per-test timeout.

## Verification

- Client: lint (--max-warnings=0) / prettier / tsc clean; full suite
  **54 files, 558 passed | 4 skipped**; coverage exactly the 6 configured
  modules at baseline numbers (aggregate lines 81.25).
- **Shuffle stress: 41+ full-suite runs, zero failures** on the final
  branch (integrator 10-run matrix incl. all repro seeds 5/12/25/29/32/41
  + reviewer's 31-run matrix) — versus 4/6 failing on main before the batch.
- Server: static gates clean, **685 passed | 6 skipped**, critical coverage
  83.28% (docstring-only server change).
- openspec 17/17; root `npm audit` 0. PR #166 CI all green.

## Remaining residuals

- `interventionClient` BYOK signature: monitored (single historical
  occurrence; no repro in a large valid matrix).
- Two partial LockManager mocks (`EditorCore.test.tsx`,
  `prosemirror-helpers-lock-attributes.test.ts`) remain theoretically
  leakable — never observed in 90+ runs; the passthrough-pin remedy is
  documented here if it ever fires.
- Upstream: watch #11284/#11285 for fixes; the victim pins and per-test
  timeout are durable local mitigations regardless.
- `docs/guides/deployment.md` has pre-existing prettier drift outside all
  format gates (lines 144/268/338 area) — cosmetic, out of scope.
