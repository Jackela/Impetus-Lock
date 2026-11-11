# Dependency Management

Impetus Lock uses two lockfiles and Dependabot. Reproducibility comes from the lockfiles; updates come from reviewed PRs.

## Reproducible installs

| Ecosystem    | Manifest                | Lockfile                   | Install                       |
| ------------ | ----------------------- | -------------------------- | ----------------------------- |
| Backend      | `server/pyproject.toml` | `server/poetry.lock`       | `cd server && poetry install` |
| Frontend     | `client/package.json`   | `client/package-lock.json` | `cd client && npm ci`         |
| Repo tooling | `package.json`          | `package-lock.json`        | `npm ci`                      |

Poetry **2.5.1** is pinned in CI and in `server/Dockerfile.prod` because the lockfile uses the Poetry 2.x format. Do not install a different Poetry major version and regenerate the lock casually.

Commit lockfile changes with the manifest change that caused them. Never hand-edit a lockfile.

## Dependabot

`.github/dependabot.yml` covers:

- pip/Poetry in `/server`
- npm in `/client`
- GitHub Actions at `/`
- Docker in `/server` and `/client`

Updates are grouped (minor/patch where practical), labelled, and scheduled weekly/monthly. Dependabot PRs still need a human review/merge decision; a green check is not approval. Security advisories should be handled ahead of the normal schedule.

If a Dependabot label is missing, the PR is created without it. Labels used by the config must exist in the repository.

## Upgrade policy

- **Patch/minor**: normal Dependabot PR, full gate.
- **Major**: open or link a tracking issue, read the migration guide, and run the full gate plus the affected E2E suites. Do not merge a major runtime bump just because CI is green if the supported runtime range has not been updated deliberately.
- **Runtime floors**: Python 3.11+ (CI 3.12), Node 22.13+/24.x. A dependency that requires a newer runtime needs an explicit decision and a CI matrix update.
- **Held majors** (as of 2026-11): Python 3.13–3.15, Node 26 / `@types/node` 26, Vite 8 + `@vitejs/plugin-react` 6, ESLint 10 + `eslint-plugin-react-hooks` 7, `lint-staged` 17, `pytest` 9, `redis` 8, `google-genai` 3, and the `actions/setup-node` / `docker/*` action majors. These are tracked in [#266](https://github.com/Jackela/Impetus-Lock/issues/266) and held in `.github/dependabot.yml`; do not merge them piecemeal. Remove the hold as part of the coordinated upgrade PR.

## Adding a dependency

1. Check whether the standard library or an existing dependency already covers the need.
2. If it is a new runtime dependency, follow the OpenSpec rule in `AGENTS.md` (new dependency = proposal before implementation).
3. Add it with the ecosystem tool, update the lockfile, and run the full gate.
4. Remove unused dependencies in the same change when safe; do not keep a package only for a dead script.

```bash
# Backend
cd server
poetry add <package>
poetry add --group dev <package>
poetry lock

# Frontend
cd client
npm install <package>
npm install -D <package>
```

## Audits

```bash
# Backend
cd server
poetry check
poetry show --outdated

# Frontend
cd client
npm outdated
npm audit
```

Do not run `npm audit fix --force` or downgrade/remove a package to silence an advisory without reviewing the change. If an advisory cannot be fixed in scope, record it in the PR and, when needed, `.scratch/<date>-<topic>/handoff.md`.

## CI behaviour

- `Backend Tests` installs from `poetry.lock` with Poetry 2.5.1 and enforces branch coverage ≥78%.
- `Frontend Tests` uses `npm ci` and enforces the Vitest coverage thresholds plus the `node:test` coverage gate.
- `Validate (API Types + OpenSpec)` checks generated API types and strict OpenSpec validation.
- Playwright browsers are cached by `client/package-lock.json`; a Playwright bump invalidates the cache.

## References

- [Dependabot documentation](https://docs.github.com/en/code-security/dependabot)
- [Semantic Versioning](https://semver.org/)
- [Poetry dependency specification](https://python-poetry.org/docs/dependency-specification/)
- `AGENTS.md` — current gates and proposal rules
