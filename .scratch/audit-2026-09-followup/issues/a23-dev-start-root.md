# a23: Reproduce dev-script --no-root question, then fix or record

Status: ready (2026-09-15)

Blocked by: None

Source base: 051ac7e (main); dispatch pins actual worktree parent after ticket commit.

Write scope (ONLY if reproduction succeeds): `scripts/dev-start.sh`, `scripts/dev-setup.sh`, `scripts/dev-start.ps1`. If reproduction fails: NO file changes — report the evidence only.

## Behavior and acceptance

A23 (P2, "先复现再定修复"). `run_backend_setup()` in `scripts/dev-start.sh:147` runs `poetry install --no-root >/dev/null 2>&1` after `pushd "$SERVER_DIR"`; the same flag appears in `scripts/dev-setup.sh:129` and `scripts/dev-start.ps1:97`. The claim that `--no-root` is needed has never been demonstrated — and repo CLAUDE.md (~lines 151-167) records the opposite experience in CI: `--no-root` caused `Could not import module 'server.main'` there, mandating plain `poetry install` in workflows. This ticket settles it by reproduction.

Reproduction protocol (in YOUR worktree, server/ dir — it gets its own Poetry venv, which is exactly the fresh-install condition):

- [ ] R1: `poetry install --no-root` in worktree server/ — record success/failure (baseline; expected to succeed, output is suppressed in the script but you run it unsuppressed).
- [ ] R2: full `poetry install` (no flag) in the same venv — record success/failure and what installing the root package adds (e.g. `pip list | grep -i impetus` or poetry's output). If it FAILS (e.g. packaging metadata error), STOP: record evidence, change nothing, report.
- [ ] R3: boot smoke both ways, mimicking dev-start's launch pattern from server/ cwd: `poetry run python -c "from server.api.main import app; print('import ok')"` (verify the actual module path in dev-start.sh first and use what the script uses). Must pass.
- [ ] Decision rule: R2 and R3 pass → remove `--no-root` from the three scripts (only the flag; keep everything else including output suppression exactly as-is). Either R2 or R3 fails → no changes, evidence-only report.

If fixing:

- [ ] All three scripts lose exactly the `--no-root` token (dev-start.sh, dev-setup.sh, dev-start.ps1); no other edits.
- [ ] Server gates from worktree server/: `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto` — all pass (your venv already has everything from R2).
- [ ] `git status` shows only the three scripts; `git diff --check` clean; shell syntax check passes: `bash -n scripts/dev-start.sh && bash -n scripts/dev-setup.sh`.
- [ ] Single conventional commit: `fix: install project root package in dev scripts` (or `chore:` if you judge better; state why).

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md (especially the recorded CI --no-root failure), AGENTS.md, and the three scripts first. No push, no remote writes, no alembic migrations, no external LLM calls, no Playwright. Stop and retain evidence on unexpected failure. Main agent is sole integrator and acceptor.
