## 1. Workspace Strategy
- [x] 1.1 Prototype syncing the repo into `/home/$USER/impetus-lock-act` (or configurable path) and confirm `act` can access `server/` within the container.
- [x] 1.2 Document environment variables (`ACT_WORKSPACE_BASE`, `ACT_CACHE_DIR`, port overrides) required for WSL/Windows setups.

## 2. Tooling & Scripts
- [x] 2.1 Add a Bash helper (and optional PowerShell wrapper) that rsyncs the repo to the Linux path, preserves git metadata, and exports the necessary env vars before running `act`.
- [x] 2.2 Ensure the script stops any conflicting Docker containers (e.g., `impetus-lock-postgres`) or reroutes Act services to alternate ports.

## 3. Workflow & Docs
- [x] 3.1 Audit `.github/workflows/e2e.yml` for hard-coded `./server` references; ensure steps rely on `${{ github.workspace }}` so mirrored paths work.
- [x] 3.2 Update `README.md` / `DEVELOPMENT.md` with a "Local CI via Act" section (setup, sync, troubleshooting).
- [x] 3.3 Run `act -j e2e -W .github/workflows/e2e.yml --artifact-server-path /tmp/act-artifacts` using the new workflow and attach the tail output in `test-results/act-e2e.log` (ignored in git) for reference.
