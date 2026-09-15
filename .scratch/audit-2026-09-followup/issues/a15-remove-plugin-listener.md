# a15: Remove unused @milkdown/plugin-listener direct dependency

Status: ready (2026-09-14)

Blocked by: a16 (package.json already integrated at 36d564f)

Source base: 36d564f (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `client/package.json`, `client/package-lock.json` ONLY.

## Behavior and acceptance

A15 (P2). `@milkdown/plugin-listener` is declared at `^7.19.2` (client/package.json:25) while every other @milkdown/* package is `^7.18.0`. This mismatch nests a second full @milkdown kernel at 7.19.2 inside the tree, including a duplicate `@milkdown/prose` 7.19.2 alongside the top-level 7.18.0 (dual-ProseMirror-instance hazard). Audit verified zero imports of `@milkdown/plugin-listener` anywhere in client/src and client/tests — it is a declared-but-unused direct dependency. Approved disposition (user-approved followup plan, 2026-09-14): remove it rather than align versions.

- [ ] Full-repo verification first: grep the ENTIRE worktree (src, tests, vite config, scripts, e2e, docs that affect builds) for `plugin-listener` references. Only acceptable remaining hits after removal: the transitive nested copy `node_modules/@milkdown/kit/node_modules/@milkdown/plugin-listener` (v7.18.0, a dependency of @milkdown/react — that one STAYS, it is transitive, not declared) and its package-lock entries. Any OTHER reference found (source import, config, script) = STOP and report instead of removing.
- [ ] Remove the direct dependency WITHOUT touching anything else: prefer `npm uninstall @milkdown/plugin-listener` from client/ (uses symlinked node_modules; do not run a full install). If the sandbox registry blocks it, use offline modes (`npm uninstall --offline` / `--prefer-offline`). package.json must lose only that one line.
- [ ] Lock verification: `client/package-lock.json` diff shows ONLY removals related to this dependency chain — the top-level `node_modules/@milkdown/plugin-listener` entry AND its nested 7.19.2 kernel copies (core/ctx/exception/prose/transformer under it) must be gone; the nested `node_modules/@milkdown/kit/node_modules/@milkdown/plugin-listener` (7.18.0) entries REMAIN. Grep the new lock: exactly ONE `node_modules/@milkdown/prose` resolution at 7.18.0 (no 7.19.2 anywhere). NO unrelated version bumps or additions anywhere in the lock — if npm rewrites unrelated entries, report instead of committing.
- [ ] Gates from worktree client/: `npm run lint`, `npm run format`, `npm run type-check`, `npm run test -- --coverage` — all pass, fixed-module-set aggregate LINES ≥80 (report the number).
- [ ] `git status` shows only the two write-scope files; `git diff --check` clean.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, client/package.json first. Dependency-hygiene change — no source code edits. Single conventional commit after acceptance: `build: remove unused @milkdown/plugin-listener dependency`. Commit with `HUSKY=0 git commit`. No push, no remote writes. Stop and retain evidence on any unexpected failure or any discovered usage. Main agent is sole integrator and acceptor.
