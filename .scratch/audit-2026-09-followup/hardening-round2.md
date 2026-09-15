# Impetus-Lock — Hardening round 2 completion report

2026-09-15. Closes the out-of-scope findings carried in the ledger by round 1
([report.md](report.md) "Deferred / discovered"). Plan pre-approved with three
delegated decisions: redis constraint `^7.4` (CI-verified major only, no empty
5.x compat claim); final validation via one PR through CI (first real-Redis CI
run); `-k` filter removal decided by evidence. Same multi-agent protocol as
round 1: fresh-context implementer per ticket in isolated worktrees under
`/Users/jackela/Documents/GitHub/impetus-worktrees/`, independent review per
ticket (general-purpose reviewers; Spec + Standards axes), main agent sole
integrator (cherry-pick → integration branch → gates → ff-only-style linear
history → PR). All commits `HUSKY=0`.

Base: main = 3aa77d2. Integration branch: `integration/hardening-round2`.

## Work items

| Item | Result | Original commits | Integrated as |
| --- | --- | --- | --- |
| T1 csrf signed pair (P1) | `generate_token()` now `serializer.dumps(token_urlsafe(32))` — roundtrips with `validate_token()`. Forensics first: `validate_token` had **zero production callers**; live protection is the middleware's double-submit cookie compare, so this was a latent API-integrity defect, not an exploitable hole. No OpenSpec change needed (bug fix, no spec touched, no externally observable behavior change). TDD: roundtrip red → green + tamper/expiry(monkeypatched time)/wrong-secret/missing-SECRET_KEY pins | `04087c7`, `314d1e6` | `4fbac75`, `d24ee29` |
| T2 Redis test infrastructure | Root-caused the permanent hang: `_listen()` never yields when `get_message` returns None immediately (AsyncMock) — now sleeps 0.05s on None. Removed the `REDIS_URL` setdefault that defeated the skipif. Renamed the mock-based test class (was mislabeled as needing a Redis server), dropped the dead skipif, released it into the unit gate. New `tests/integration/test_redis_real.py` (probe-based skip; real collaboration pubsub + rate-limit window). CI: redis:7-alpine service added to ci.yml backend-tests; **all** `-k "not RedisIntegration and not redis_pubsub"` filters removed from both workflows after 34-test evidence run. **Real Redis 7 validated locally** (colima + redis:7-alpine, cleaned up after): 663 passed / 4 skipped, both new tests pass, rate_limiting.py coverage 88% | `97d3fc3` | `35c5beb` |
| T3 redis ^7.4 (unlocks Dependabot #134) | `redis = "^5.0.0"` → `"^7.4"`, lock 5.3.1 → 7.4.1, zero lock resolution-set change (redis metadata moved PyJWT to an optional extra). Migrated `.close()` → `.aclose()` (redis-py deprecation/removal path), `asyncio.iscoroutinefunction` → `inspect.` (py3.16 removal), removed the stale no-op `-k` from test-matrix.yml, synced test mocks. **Real Redis 7 + redis-py 7.4.1 validated locally**: both integration tests pass, full suite 663/4 | `ad940be` | `2e39088` |
| T5a Gemini close() lifecycle | `LLMProvider` is a `typing.Protocol` — adding `close()` would break structural matching for the 4 providers without it; landed a module-level defensive `close_provider()` helper instead. `reload()` closes cached instances before clearing; intervention route's `finally` closes only non-cached (BYOK api-key) instances via identity-based `is_cached()` — covers all exits incl. 502/500 paths, never closes shared cached instances | `ac602ed` | `6616269` |
| T5b streak single pre-read | First attempt (PK `session.get`) **rejected in review loop**: identity map is weak-ref'd and `get_by_user` returns a domain entity, so the ORM instance is collected and `get` always degrades to a PK query — read count unchanged (3). Reworked per directive: Core `UPDATE ... WHERE id` (rowcount hit check, 0 → insert branch), zero pre-write SELECT, exactly one post-commit read. Path shape restored to pre-refactor routes: **2 SELECT + 1 write** (red evidence: 3 reads before rework, independently reproduced by reviewer). t1 characterization + service tests untouched and green | `393f088` (amend of `f3e1c7c`) | `6ba057f` |
| T4 npm audit triage | Research (sources in [npm-audit-triage-2026-09.md](npm-audit-triage-2026-09.md)): root and client were **different chains**. Root lint-staged chain (picomatch ReDoS high + prototype-injection moderate, yaml DoS moderate) — all dev-only, all in-range → fixed via `npm audit fix`: picomatch 2.3.1→2.3.2, yaml 2.8.2→2.9.1, root now **0 vulnerabilities**. Client vitest chain (GHSA-82fw-gwwq-j7x9): no 4.0.x patch exists; unreachable under this repo's jsdom+forks config; freeze kept — but the freeze's own reason (#9957) is only fixed in **v5.0.0**, so the unfreeze gate is updated to vitest ≥5.0.0 | `db7c9b8` | `db7c9b8` |
| Review-driven chores | T3 review: dropped inert `extras=["asyncio"]` (extra never existed in redis 5/7), deleted dead `mock_redis`/`redis_mock_client` fixtures in tests/integration/conftest.py (zero consumers, stale `.close`). T5a review: reload() docstring now documents the close-in-flight concurrency semantics. T5b review: header docstring softened re: same-day idempotent UPDATE | `0ac88a3` + docs commit | `0ac88a3` |

## Reviews

Every ticket got an independent fresh-context review; all verdicts **ACCEPT**, zero
blocking findings. Notable review work product:

- T1: verified the `str()` wrapper's mypy rationale doesn't hold (kept as harmless
  defense); caught that a bare `poetry run mypy .` (without the gate's
  `--no-site-packages --ignore-missing-imports`) reports pre-existing errors
  identical to main — environment/flag artifact, not regressions.
- T2: reproduced the hang mechanism (awaiting a resolved AsyncMock never yields),
  verified CI yaml is byte-consistent with existing services blocks, confirmed the
  suite census (667 collected = 661+6 = 663+4).
- T3: cross-checked redis-py 6/7 breaking changes against the repo's exact API
  surface (from_url kwargs, get_message signature, aclose presence); next breaking
  change is 8.0 (RESP3 default) — `^7.4` upper bound correctly excludes it.
- T5a: confirmed no gap between `_resolve_config` cacheable branches and
  `is_cached()` (BYOK api-key → always closed; default/model-only → never closed);
  the reload-during-request double-close window is theoretical (reload is
  test-only) and tolerated by design.
- T5b: verified rowcount reliability on **asyncpg** (production driver — the
  ticket brief wrongly said psycopg) and aiosqlite (test driver); verified
  `InvalidRequestError` family-consistency against SQLAlchemy 2.0.52 source;
  independently reproduced the red evidence.

Review-driven fixups landed in `0ac88a3` + the docs commit; deferrals recorded below.

## Gates (per-ticket worktree + final integration branch)

Per-ticket: ruff check / format / lint-imports (3 kept) / mypy (exact gate command)
/ pydocstyle / pytest with coverage — all green (critical coverage 82.63–83.50%
across tickets; T2/T3 full-suite variants 661–663 passed). Final integration gates
run on the assembled branch before PR (see PR checks): server full suite **without**
any `-k` filter (Redis integration tests probe-skip locally), client
lint/format/tsc/test ≥80%, openspec validate --all --strict, root npm audit = 0.

## Deferred / discovered (this round)

- `redis_pubsub.py` `_listen()`: message of non-"message" type skips the None-sleep
  (theoretical busy-spin; no current producer) — note only.
- Streak upsert: `get → None → InvalidRequestError` raise branch (post-commit row
  vanish) has no dedicated test — suggested future characterization test.
- Same-day streak activity now issues one idempotent same-value UPDATE (was zero
  writes pre-refactor); no user-visible difference, documented in the header docstring.
- Pre-existing: model-only BYOK override gets cache-locked to the first request's
  model within a provider (not from this round's diffs) — candidate future fix.
- vitest freeze: unfreeze gate is now **vitest ≥5.0.0** (fixes GHSA-82fw + #9957
  together); waiting on 4.1.x is pointless.
- Client Dependabot majors #126–#128 still recommended; #129 engines policy; #141
  prettier split — unchanged from round 1.
