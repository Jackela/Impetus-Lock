# a13-server: Close pydocstyle gaps and wire the gate into CI

Status: ready (2026-09-15)

Blocked by: None (base ead4d46; run AFTER t1 so signatures are stable — satisfied)

Source base: ead4d46 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `server/server/**/*.py` (docstring additions/fixes ONLY — no logic changes), `.github/workflows/ci-server.yml`, `.github/workflows/ci.yml` (lint job additions only).

## Behavior and acceptance

A13 server half. pydocstyle 6.3.0 is declared (pyproject dev group) and configured (`[tool.pydocstyle]` convention=google, match excludes test_*, match_dir excludes tests) but never runs in CI. Measured gap on the current tree (2026-09-15, from server/ cwd): `pydocstyle .` reports 91 violations, of which the package-relevant mix is ~59 missing-docstring codes (D101/D102/D103/D104/D107) + ~40 style/format codes (D202 blank-line-after-docstring ×27, D415/D403 first-line wording ×13, D301/D212/D207). Two pollution sources must be EXCLUDED, not fixed: `alembic/versions/**` (auto-generated migrations) and `.venv.windows.broken_*/**` (junk dir) — solve by scoping the run to the package, see below.

- [ ] Run `poetry run pydocstyle server/` (note: the `server/` path scope, run from server/ cwd) and fix EVERY reported violation inside `server/server/`: add Google-style docstrings for missing public module/class/function/method/`__init__` docstrings; fix D202/D415/D403/D207/D212/D301 formatting/wording issues. Docstrings must be accurate and specific (Args/Returns/Raises where applicable) — not filler. NO logic/behavior changes anywhere; a reviewer must be able to verify every hunk is comment-only.
- [ ] Do NOT touch `alembic/**`, tests, or anything under a venv dir; the `server/` scope keeps them out.
- [ ] CI wiring: add a pydocstyle step to the lint jobs in BOTH `.github/workflows/ci-server.yml` and `.github/workflows/ci.yml` (wherever ruff check runs): `poetry run pydocstyle server/`. Match the existing step style (name, working directory conventions used by neighboring steps).
- [ ] Gates from worktree server/: `poetry run pydocstyle server/` exits 0 (the new gate itself), plus `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run lint-imports`, `poetry run mypy . --no-site-packages --ignore-missing-imports`, `poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub"` — all pass.
- [ ] Critical coverage unaffected: `poetry run coverage report --rcfile=coverage-critical.ini` still ≥80 (docstrings add executed statements; verify from the pytest --cov run: add `--cov=server --cov-report=term`).
- [ ] `git status` only write-scope files; `git diff --check` clean; every hunk comment-only outside the two workflow files.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md (Article V documentation requirements), AGENTS.md, pyproject's pydocstyle config first. Documentation-only change: no renames, no signature changes, no moved code (diff noise makes review harder). Single conventional commit after GREEN: `docs: close pydocstyle gaps and gate docstrings in CI`. Commit with `HUSKY=0 git commit`. No push, no remote writes. Stop and retain evidence on unexpected failure. Main agent is sole integrator and acceptor.
