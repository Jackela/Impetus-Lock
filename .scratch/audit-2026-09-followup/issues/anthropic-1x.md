# deps: Migrate anthropic SDK 0.40 → 1.5 (PR #148)

Status: ready (2026-09-15). User-approved continuation ("彻底解决") of the deferred-major dispositions.

Blocked by: mypy 2.3 landed (#159, merged).

Source base: current main (post-#159); dispatch pins actual worktree parent after ticket commit.

Write scope: `server/pyproject.toml`, `server/poetry.lock`, `server/server/infrastructure/llm/anthropic_provider.py`, `server/server/infrastructure/llm/claude_provider.py`, `server/tests/**` (anthropic/claude test files only if adaptation is needed), docstrings in the touched providers where behavior wording changes.

## Verified SDK facts (research, 2026-09-15, sources: anthropic-sdk-python v1.0.0 release + MIGRATION.md, v1.5.0 pyproject/constants)

- v1.0.0 (2026-08-20) breaking changes vs 0.40 relevant to this repo:
  1. **`temperature` / `top_p` / `top_k` REMOVED from `messages.create/stream/parse`** — passing them raises `TypeError`. To preserve sampling behavior use `extra_body={"temperature": <value>}`. Three call sites must change: `anthropic_provider.py:54`, `claude_provider.py:202` (instructor path), `claude_provider.py:323`.
  2. httpx → **httpx2** (transitive; repo's own `httpx >=0.28.1,<1` is a separate package — no conflict, and do NOT pass any `http_client=`).
  3. Python floor 3.10 (repo is ^3.11 ✓). Legacy Text Completions removed (unused here). `with_raw_response` shape changed (unused here).
- Unchanged for our surface: `Anthropic(api_key=...)`; `messages.create(model, system, max_tokens, messages)`; `Message.content` + `TextBlock` + `usage.input_tokens/output_tokens`; error constructors `RateLimitError(message=, response=MagicMock(status_code=429), body=)` / `AuthenticationError(...)` / `APIError(message=, request=..., body=...)`; retry/timeout defaults (max_retries=2, timeout 600s, delays 0.5–8.0).
- New 1.5 exports (optional finer mapping): `ServiceUnavailableError`, `OverloadedError` (529), `DeadlineExceededError`, `RequestTooLargeError`. Current fallback maps them to `APIError`→502; keeping that is acceptable (contract preservation).
- Constraint to declare: `anthropic = ">=1.5,<2"`.
- **Known risk — instructor path**: `ClaudeProvider` defaults `use_instructor=True` with `instructor.from_anthropic(client, mode=instructor.Mode.ANTHROPIC_TOOLS)`. instructor's anthropic extra pins `anthropic==0.93.0` upstream (main branch); runtime compatibility with 1.5 is UNVERIFIED upstream. The repo pins `instructor = "^1.4.0"` (no conflict at resolution). ESCALATION RULE: after migration, if the instructor-path tests fail in a way that indicates instructor incompatibility (not our code), STOP and report — do not refactor instructor usage or flip `use_instructor` defaults on your own; that is a product decision.

## Behavior and acceptance

- [ ] 1. TDD: before swapping the dependency, add/extend provider tests pinning CURRENT behavior that could shift: temperature reaches the API request payload (mock at `messages.create` and assert the temperature value is still transmitted — after migration via `extra_body`), error mapping (429→quota 402/429 semantics per existing tests, 401→invalid_api_key, APIError→502), max_tokens=400/system prompt/message shape, usage token extraction. Run them GREEN against 0.40 first where possible.
- [ ] 2. Swap dependency: `anthropic = ">=1.5,<2"`, `poetry lock`/`poetry update anthropic` (accept new transitive `httpx2`; keep repo `httpx` constraint untouched). Confirm `poetry run pip show anthropic` reports 1.5.x.
- [ ] 3. Adapt the three call sites: remove `temperature=` kwarg, pass `extra_body={"temperature": self.temperature}` (or equivalent per-file attribute) to preserve sampling behavior. Update affected docstrings/comments to describe the extra_body form accurately. Touch nothing else in the providers.
- [ ] 4. Full server gates from server/: `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run pydocstyle server/`, `poetry run lint-imports` (3 kept), `poetry run mypy . --no-site-packages --ignore-missing-imports` (now mypy 2.3), `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub" --cov=server --cov-report=term`, `poetry run coverage report --rcfile=coverage-critical.ini` ≥80 (report the number).
- [ ] 5. Instructor-path evidence: report explicitly whether claude/instructor tests pass unchanged under anthropic 1.5 (they mock at client level; instructor internals still execute). Any instructor-internal incompatibility → STOP per the escalation rule.
- [ ] 6. `git status` only write-scope files; `git diff --check` clean. Single commit: `HUSKY=0 git add -A && HUSKY=0 git commit -m "build(deps): migrate anthropic SDK to 1.5"`.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, both providers and their tests before editing. Behavior-preserving externally: same prompts/models/error statuses/token semantics; the ONLY intended behavioral delta is zero (temperature still transmitted). No alembic, no live LLM calls, no Playwright, no push, no remote writes. Stop and retain evidence on unexpected failure; the instructor escalation in 5 is a hard stop. Main agent is sole integrator and acceptor.
