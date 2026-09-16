# Impetus-Lock — September 2026 followup completion report

2026-09-15. Executed under the user-approved followup plan ("用 subagents 彻底完成全部任务"): all 7 remaining P2 findings closed, all 3 Tier3 OpenSpec proposals implemented and archived, 5 Dependabot PRs landed locally with 8 verify-only records. Multi-agent protocol throughout: fresh-context implementer per ticket in isolated worktrees, independent review per batch, main agent sole integrator (cherry-pick → integration gates → review → ff-only merge → cleanup). Local-only: no push, no remote writes.

Range: `dde1138..e6f06ed` on local main (was 21 ahead of origin at start; see final count in this report's footer). Boundary defaults from the unanswered questions: no-push; Tier3 approval = plan approval (recorded in each proposal.md); Node engines `>=20.19 <25` with CI/Docker unified on 24; Dependabot same-major landed / majors verify-only.

## Work items

| Item | Result | Commits |
| --- | --- | --- |
| A22 archive reconciliation index | New `openspec/changes/archive/README.md` indexing 8 inconsistent archives; originals byte-untouched; 8/8 facts verified (one count corrected 69→72 after review) | `e8895a3`, `36d564f` |
| A16 Node engines | `engines.node >=20.19 <25`; Dockerfile.prod/dev builders → node:24-alpine; `.nvmrc` 24; README already aligned, untouched | `f26fd16` |
| A18 real filter tests | LockManager.test.ts pseudo-integration replaced with real createLockTransactionFilter composition (blocked+onReject fired by filter; unlocked passes; release permits delete); sanity-checked by breaking wiring | `7543f60` |
| A15 plugin-listener removal | Unused direct dep removed; nested 7.19.2 kernel gone; exactly one @milkdown/prose (7.18.0); lock diff only this chain (+ benign engines metadata sync) | `6aafde0` |
| Tier3 refactor-unused-client-state | Fresh caller audit (zero production callers; also found+cleared dangling .prettierignore entry) → deleted useTaskSyncCloud/useLockEnforcement + tests + barrel + stale docs; coverage fixed set 7→6, aggregate 81.25% | `dc1aaf4`, `051ac7e` |
| Tier3 migrate-gemini-sdk (+A11) | google-generativeai 0.8.6 → google-genai 2.23.0; instance-scoped clients with close(); error dispatch on `.code`; blocked-output via response metadata; httpx timeout→504; **measured** legacy retry envelope [119,137] outbound attempts → explicit HttpRetryOptions(attempts=120, 503-only, legacy-mirrored backoff) and attempts=18 for count_tokens; BYOK isolation proven per-request (legacy global-configure cross-talk captured as RED evidence); 5 unversioned CI pip installs removed (A11); dependabot.yml name swapped. Forced dependency cascade (poetry could not lock otherwise): httpx ≥0.28.1, websockets 13–17, anthropic ^0.40 — all suites green | `d2f7dd0`, `94e0226` (dead-fixture cleanup) |
| A23 dev scripts | Reproduced R1/R2/R3: full `poetry install` succeeds (editable root) and `server.api.main` imports; local cwd previously masked CI's failure mode; `--no-root` removed from dev-start.sh/dev-setup.sh/dev-start.ps1 | `ef0f4c4` |
| Tier3 refactor-route-service-boundaries | 62 characterization tests written first and verified GREEN against the OLD routes in a base worktree by the reviewer, then unchanged through the refactor; new TemplateService/StreakService + scoped TaskService methods (`*_for_user`), narrow repository ABCs + postgres impls + TransactionSupport port; routes are pure HTTP adapters; external contract frozen (incl. quirky current behaviors: blank content 201, cross-user template delete 204, future-date streak +1 with grace-rule spec gap left explicit); 610 passed; critical cov 82.63–82.78% | `ead4d46` |
| A13 server docstrings | pydocstyle 91→0 across 34 files, all hunks AST-verified comment-only; `poetry run pydocstyle server/` gated in both CI lint jobs (scoping excludes alembic + junk venv dirs) | `82f9897` |
| A13 client JSDoc | 320→0 (require-jsdoc 158 / require-param 121 / require-returns 41) across 89 files, comment-only verified; presence rules now `"error"`; duplicated config comment block removed | `3be2f42` |
| Dependabot landed | #117 mypy 1.20.2 / #120 xdist 3.8.0 / #118 import-linter 2.15 / #119 otel constraints aligned to locked 1.44 (coordinated) / #135 actions bumps; each with full gates | `2167c18`, `2432cd4`, `eb9f3ae`, `69701c6`, `109a2ec` |
| Dependabot verify-only | #126 jsdom29 green (benign stderr) · #127 jsdoc62 green · #128 globals17 green · #129 types/node25 green but policy-held vs engines · #134 redis7.4.1 resolves+static-green, runtime unverifiable (all Redis tests mocked; PR also lacks lock sync) · #136/#137 action majors input-compatible, Node24-runtime requirement only · #141 group green except prettier 3.9 format on 2 files (split or +prettier --write); milkdown 7.22 would re-add plugin-listener as transitive-only | [dependabot-followup.md](dependabot-followup.md) |
| OpenSpec closeout | 3 changes archived to `archive/2026-09-15-*/` with spec deltas merged (new `specs/task/` capability); validate --all --strict = 17 passed / 0 failed | `e6f06ed` |

## Gates (final integration state)

Server (main worktree, final dependabot state): ruff check / format / lint-imports (3 kept) / mypy clean; pytest 610 passed / 4 skipped; critical coverage 82.31% ≥80; pydocstyle server/ exit 0; google-generativeai absent from env. Client: lint 0/0 (jsdoc enforced), format, type-check clean; 53 files, 541 passed / 4 skipped; fixed-set aggregate lines 81.25% ≥80. OpenSpec strict: 17/17.

## Reviews

Every batch received an independent fresh-context review (Spec + Standards axes, commit/staged/unstaged/untracked) before ff-only merge. All verdicts ACCEPT. Review-driven fixups: archive count 69→72, .prettierignore stale entry, dead legacy mock fixtures + stale conftest comment. Non-blocking deferred notes recorded below. The code-reviewer agent type was non-functional in this environment (600s inactivity ×3); reviews used general-purpose agents instead, same axes and depth.

## Deferred / discovered (not fixed, out of scope)

> 2026-09-15 hardening round 2 update: the csrf pair mismatch, the Redis test hang
> (plus real-Redis CI wiring and redis `^7.4` unlocking #134), the Gemini `close()`
> lifecycle, the streak double-SELECT, and the npm audit triage were all handled in
> round 2 — see [hardening-round2.md](hardening-round2.md) and
> [npm-audit-triage-2026-09.md](npm-audit-triage-2026-09.md). Still open from the
> list below: client majors #126-#128 (recommended), #129 (engines policy), #141
> (prettier split); vitest unfreeze target updated to ≥5.0.0 per the triage report.
>
> 2026-09-16 round 3 update: the "still open" line above was stale — majors
> #126–#128 and the #141 group had already landed on 2026-09-15 (commits
> `12bf650`/`40cc7c3`/`34a0f93`). Round 3 (PR #164) closed everything actually
> remaining: #129 decided (@types/node 25, engines unchanged), vitest unfrozen
> to ~5.0.1, streak raise-branch test, `_listen` yield, model-only override
> cache fix. See [hardening-round3.md](hardening-round3.md).

- csrf `generate_token` (random) vs `validate_token` (signed serializer) mismatch — pre-existing; docstrings describe actual behavior. Found during A13.
- `TestCollaborationServiceRedisIntegration::test_handle_redis_message` busy-loop hang: `tests/conftest.py:28` REDIS_URL setdefault defeats its skipif (hangs on redis 5.3.1 and 7.4.1 alike). Found during #134 verification.
- Gemini `close()` lifecycle has no production caller (registry reload / per-request cleanup could adopt it). Reviewer minor from t2.
- Streak update path now double-SELECTs (wider last-write-wins window vs old single-read; no behavior regression). Reviewer minor from t1.
- Client majors #126/#127/#128 technically green and recommended for landing next round; #129 held on engines policy; #141 needs the prettier split; #134 needs lock sync + real-Redis run. `npm audit` pre-existing 2 low/5 moderate/8 high uninvestigated.
- retry parity note: new SDK jitter formula differs from legacy (additive vs multiplicative); attempt count and scheduling params are pinned to measured legacy envelope [119,137]→120. Total-stall duration can differ under full-outage conditions; documented in provider comments.

## Protocol notes

- All commits `HUSKY=0`; no Playwright; no alembic; no live LLM calls (fake transports/mocks only).
- 10 implementer/research/verify subagent tickets + 5 independent reviews + 1 full-range final review; worktrees/branches created and removed per batch; verification installs restored via `npm ci`.
- A stale set of 4 empty worktrees and 2 leftover branches from a prior aborted attempt were found at start (zero commits, clean) and removed after verification.
- Final state: local main at `e6f06ed` (+ledger commits below), working tree clean except untracked session dir; **not pushed**.
