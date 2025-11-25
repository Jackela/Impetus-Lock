# Change Proposal: improve-act-ci-parity

## Why
- `act -j e2e -W .github/workflows/e2e.yml` fails locally because Docker containers cannot `chdir` into the Windows-mounted `/mnt/d/...` workspace, so backend setup exits with code 127.
- Local CI parity is critical before shipping Playwright or backend changes; without a green `act` run, engineers have to rely on remote GitHub Actions for validation.
- Developers often keep their repo on Windows drives (WSL paths), so we need a documented, automated way to mirror/rsync the repo into a Linux-native path that Act can mount.

## What Changes
- Add an `act-workspace-sync` helper (Bash/PowerShell) that rsyncs the repo into a configurable Linux path (e.g., `/home/<user>/impetus-lock-act`) and rewrites `.actrc`/`ACT_WORKSPACE_BASE` so `act` sees the mirrored directory.
- Update `.github/workflows/e2e.yml` (if needed) to avoid hard-coded relative paths, ensuring steps use `${{ github.workspace }}` so the mirrored layout works.
- Provide documentation in `README.md`/`DEVELOPMENT.md` covering the sync workflow, port collision avoidance (5432), and troubleshooting.
- Capture a reference green `act -j e2e ...` log and store it under `test-results/act-e2e.log` (gitignored) as proof.

## Impact
- Engineers regain local CI confidence and can iterate faster on Playwright/LLM changes.
- Reduces flaky runs caused by Windows mount quirks.
- Encourages consistent developer environments ahead of future infra work.
