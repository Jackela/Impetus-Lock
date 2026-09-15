# a16: Declare Node engines policy and align runtime images

Status: ready (2026-09-14)

Blocked by: None

Source base: dde1138 (main); dispatch pins actual worktree parent after ticket commit.

Write scope: `client/package.json`, `client/Dockerfile.prod`, `client/Dockerfile.dev`, new root `.nvmrc`, and `client/README.md` ONLY IF it currently states a Node version.

## Behavior and acceptance

A16 remainder (the doc half — Vite 7 / React 19 correction — was already fixed in the audit). The open half is the Node support policy: no `engines` field exists; CI runs Node 24.x everywhere (`ci.yml:82,144,223`, `ci-client.yml:29,55,80,112`, `e2e.yml:143`); client Docker images use `node:20-alpine` (`Dockerfile.prod:8` builder stage, `Dockerfile.dev:6`). Vite 7 requires `^20.19.0 || >=22.12.0`.

Approved policy (user-approved followup plan, 2026-09-14): engines range `>=20.19 <25` (Vite 7's real support interval), CI/Docker unified on Node 24 (the tested version).

- [ ] `client/package.json` gains `"engines": { "node": ">=20.19 <25" }` (advisory only — do NOT add engine-strict anywhere; `.npmrc` keeps `legacy-peer-deps=true` and `lockfile-version=3` untouched).
- [ ] `client/Dockerfile.prod` builder stage base `node:20-alpine` → `node:24-alpine`; `client/Dockerfile.dev` base `node:20-alpine` → `node:24-alpine`. Runtime nginx stage untouched.
- [ ] New root `.nvmrc` containing `24`.
- [ ] `client/README.md` checked: if it names a Node version, align it to the new policy; if it names none, leave it.
- [ ] No `package-lock.json` change (engines is not recorded in the lockfile); do NOT run npm install.
- [ ] Note in the commit/README where relevant: Docker build validation deferred to CI (no local docker build in this ticket).

Acceptance:

- [ ] `git status` shows only the four write-scope files (README only if edited).
- [ ] Frontend gates pass in worktree (with symlinked node_modules): `npm run lint`, `npm run format`, `npm run type-check`, `npm run test -- --coverage` (aggregate lines ≥80 on the fixed module set).
- [ ] `git diff --check` clean.

## Dispatch contract

Fresh context, depth=1, no delegation. Read CLAUDE.md, AGENTS.md, client README. Configuration-only change — no production code, no dependency changes. Single conventional commit after gates: `build: declare Node engines and align runtime images`. Commit with `HUSKY=0 git commit`. No push, no remote writes. Stop and retain evidence on unexpected failure. Main agent is sole integrator and acceptor.
