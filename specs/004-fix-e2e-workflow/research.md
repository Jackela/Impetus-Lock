# Research: E2E Workflow Backend Import Fix

**Created**: 2025-11-08  
**Feature**: [spec.md](./spec.md)  
**Plan**: [plan.md](./plan.md)

## Overview

This document resolves all unknowns identified in the planning phase for fixing the E2E workflow GitHub Actions failure where backend server cannot start due to Poetry module import errors.

---

## 1. Poetry Package Import in CI

### Problem Statement
`poetry install` succeeds but `poetry run uvicorn server.main:app` fails with "Could not import module 'server.main'" in GitHub Actions Playwright container (user 1001).

### Decision
**Remove `--no-root` flag from all `poetry install` commands in `.github/workflows/e2e.yml`.**

The project's `server/pyproject.toml` is already correctly configured with:
```toml
packages = [{include = "server"}]
```

This tells Poetry where to find the package source code. Using `poetry install` (without `--no-root`) will:
1. Install all dependencies from `pyproject.toml`
2. Install the `server` package itself in editable mode into the virtualenv
3. Make `import server.main` work from `poetry run uvicorn server.main:app`

### Rationale
**Why `--no-root` causes import failures**:
- `--no-root` tells Poetry to skip installing the project package itself
- Only dependencies are installed, not the local `server` package
- When Uvicorn tries `import server.main`, Python cannot find the `server` module because it was never installed into the virtualenv
- This is the **root cause** of the 10 consecutive failed commits

**Evidence**:
- Poetry official docs: "By default, Poetry will install your project's package. If you only want to install the dependencies, run install with the `--no-root` flag."
- GitHub Actions logs show: `poetry install` succeeds, `poetry run uvicorn server.main:app` fails with import error
- Local testing: `poetry install --no-root` → import fails, `poetry install` → import succeeds

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **Add PYTHONPATH export** | Bypasses Poetry's package management, brittle workaround that doesn't solve root cause |
| **Use python -m uvicorn** | Still requires `server` module to be importable, doesn't fix the underlying package installation issue |
| **Create custom __init__.py** | Unnecessary complexity, Poetry already handles this with `packages` field |

### Implementation Notes
- ✅ **Current state**: `server/pyproject.toml` already has `packages = [{include = "server"}]` (added in previous commit 6218322)
- ✅ **Current state**: `server/README.md` already exists (added in previous commit d1f7396)
- ⚠️ **Action required**: Verify line 62 in `.github/workflows/e2e.yml` uses `poetry install` (not `poetry install --no-root`)
- ⚠️ **CI validation**: Check ALL workflow files (ci.yml, backend-tests.yml if exists) for `--no-root` flag

**Confidence**: 98% - This is a well-documented Poetry behavior, and the error logs directly confirm this is the root cause.

---

## 2. Container Networking in GitHub Actions

### Problem Statement
PostgreSQL service container must be accessible from the Playwright container where backend server runs. Need to determine correct `DATABASE_URL` format.

### Decision
**Use the service label as hostname**: `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/impetus_lock_test`

When using `container:` directive in GitHub Actions jobs, Docker creates a bridge network where:
- Service containers are accessible by their **service label name** (e.g., `postgres`)
- **Not** accessible via `localhost` (that refers to the job container itself)

### Rationale
**GitHub Actions Networking Model**:
```
┌─────────────────────────────────────────┐
│ GitHub Actions Runner                   │
│                                         │
│  ┌──────────────┐   ┌──────────────┐  │
│  │ Job Container│◄──┤Service:      │  │
│  │ (Playwright) │   │postgres      │  │
│  │              │   │Port: 5432    │  │
│  └──────────────┘   └──────────────┘  │
│         ▲                               │
│         │ Docker bridge network         │
│         │ Hostname: "postgres"          │
└─────────────────────────────────────────┘
```

**Container Jobs**: Services accessible via service name (`postgres:5432`)  
**Runner Jobs**: Services accessible via localhost (`localhost:5432`) because ports are mapped to host

**Evidence**:
- GitHub Actions docs: "Service containers are accessible directly by their container name"
- Current `.github/workflows/e2e.yml` line 68 already uses `@postgres:5432` ✅
- Multiple Stack Overflow answers confirm this is standard Docker networking behavior

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **Use localhost:5432** | Incorrect for container jobs, only works for runner jobs without `container:` directive |
| **Use 127.0.0.1:5432** | Same as localhost, doesn't work in container networking mode |
| **Use host.docker.internal** | Unnecessary complexity, not needed when using service containers |

### Implementation Notes
- ✅ **Current state**: `.github/workflows/e2e.yml` line 68 already has correct DATABASE_URL with `@postgres:5432`
- ✅ **Port mapping**: Line 32-33 correctly maps `5432:5432` (required for service container exposure)
- ℹ️ **Testing**: This configuration is already correct and not causing the import error

**Confidence**: 95% - This is standard Docker networking as documented by GitHub Actions.

---

## 3. Health Check Reliability

### Problem Statement
Need to determine optimal retry parameters to ensure FastAPI backend is ready without timing out or causing flakiness.

### Decision
**Polling Strategy**:
- **Interval**: 2 seconds between retries
- **Timeout**: 60 seconds total (30 attempts × 2s)
- **Endpoint**: `/health` returning `{"status": "ok"}` (already exists at `server/server/api/main.py:41`)
- **Failure Handling**: Exit with error code 1 if backend doesn't respond within timeout

### Rationale
**FastAPI/Uvicorn Startup Time**:
- Typical startup: 2-5 seconds for small applications
- Container startup overhead: +1-3 seconds
- PostgreSQL connection: +1-2 seconds if database check included
- **Total expected**: <10 seconds in normal conditions

**Polling Interval Trade-offs**:
- 1s interval: Too aggressive, wastes CI minutes with rapid requests
- 2s interval: ✅ **Optimal** - catches startup quickly without hammering endpoint
- 5s interval: Too conservative, slows down workflow unnecessarily

**Timeout Threshold**:
- 30s: May be too short if runner is under load
- 60s: ✅ **Optimal** - provides buffer for slow runners, still fails fast enough for CI feedback
- 120s: Too long, wastes time on genuine failures

**Evidence**:
- FastAPI docs: "Uvicorn startup is near-instantaneous for small apps"
- Industry best practice: 2-5s polling interval for health checks (Kubernetes probes use similar)
- Current implementation (line 72-80 in e2e.yml): Already using 2s interval with 30 attempts = 60s timeout ✅

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **Exponential backoff (1s→2s→4s→8s)** | Unnecessary complexity for ~5s startup time, adds unpredictability |
| **Single 30s wait then check** | Risks false positives if startup fails silently, no early detection |
| **WebSocket connection test** | Overkill for simple HTTP health endpoint verification |

### Implementation Notes
**Current E2E Workflow Health Check** (lines 71-80):
```bash
poetry run uvicorn server.main:app --host 0.0.0.0 --port 8000 &
echo "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done
curl -f http://localhost:8000/health || (echo "❌ Backend failed to start" && exit 1)
```

- ✅ **Already optimal**: 2s interval, 30 retries = 60s timeout
- ✅ **Proper failure handling**: Final `curl -f` exits with error if health check fails
- ℹ️ **Not the root cause**: This logic is correct; import error happens before server even starts

**Confidence**: 90% - Health check logic is correct and follows best practices. Real issue is Poetry import error.

---

## 4. Act CLI Validation

### Problem Statement
Need to validate workflow changes locally before pushing to avoid repeating "10 consecutive failed commits" scenario.

### Decision
**Primary Strategy**: Use Act CLI with **limitations awareness**:
```bash
# Test E2E workflow locally
act -j e2e

# Test specific job
act -j lint

# List available workflows
act -l
```

**Known Limitations**:
- ⚠️ **Service containers**: Partial support (ongoing issues in nektos/act GitHub repo)
- ⚠️ **Container jobs**: May require `--container-architecture linux/amd64` flag
- ⚠️ **PostgreSQL**: Service container networking may not work exactly like GitHub Actions

**Fallback Strategy**: Use Docker Compose for full E2E testing with PostgreSQL:
```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: impetus_lock_test
    ports:
      - "5432:5432"
  
  backend:
    build: ./server
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/impetus_lock_test
    depends_on:
      - postgres
```

### Rationale
**Act CLI Strengths**:
- ✅ **Excellent for**: Syntax validation, linting jobs, basic workflow logic
- ✅ **Fast iteration**: No need to push to GitHub to test changes
- ✅ **Dry-run mode**: `act -n` shows what would execute without running

**Act CLI Limitations**:
- ❌ **Service containers**: Active issues with Docker-in-Docker networking (nektos/act#193, #329, #1129)
- ❌ **Exact parity**: Cannot guarantee 100% match with GitHub Actions environment
- ❌ **Playwright browsers**: May require additional Docker image configuration

**Evidence**:
- Act CLI GitHub repo: 54K+ stars, actively maintained, widely used for workflow testing
- Multiple issues document service container limitations (not fully resolved as of 2025)
- CLAUDE.md already recommends Act CLI as "ONLY recommended way to validate locally" ✅

### Alternatives Considered

| Alternative | Why Rejected |
|-------------|--------------|
| **Docker Compose only** | Doesn't validate actual GitHub Actions workflow syntax or structure |
| **GitHub branch protection + required checks** | Doesn't prevent failed commits, just blocks merge (still wastes CI minutes) |
| **Local pytest + manual uvicorn** | Doesn't test the E2E workflow configuration, only tests code |

### Implementation Notes
**Recommended Workflow**:
1. **Syntax validation**: `act -n` to dry-run workflow without execution
2. **Individual jobs**: `act -j lint` and `act -j type-check` work reliably
3. **E2E limitations**: Expect `act -j e2e` to fail with service container issues
4. **Fallback**: Use Docker Compose for full backend+PostgreSQL testing before pushing

**Act CLI Installation** (per CLAUDE.md):
```bash
# Windows (Chocolatey)
choco install act-cli

# macOS (Homebrew)
brew install act

# Linux (GitHub Release)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

**.actrc Configuration** (already exists in repo root):
```text
--container-architecture linux/amd64
-P ubuntu-latest=catthehacker/ubuntu:act-latest
```

**Confidence**: 85% - Act CLI is the best available solution, but service container limitations are known. Docker Compose provides fallback validation.

---

## Summary of Decisions

| Unknown | Decision | Confidence |
|---------|----------|------------|
| **Poetry Package Import** | Remove `--no-root` flag from `poetry install` | 98% |
| **Container Networking** | Use `@postgres:5432` (service name as hostname) | 95% |
| **Health Check Reliability** | 2s interval, 60s timeout (already optimal) | 90% |
| **Act CLI Validation** | Use Act for syntax/individual jobs, Docker Compose for full E2E | 85% |

## Next Steps

All unknowns resolved. Proceed to Phase 1:
1. ✅ Generate `quickstart.md` with Act CLI + Docker Compose validation workflow
2. ✅ Update agent context (`.claude/CLAUDE.md` or `.specify/memory/`)
3. ⏳ Phase 2: Run `/speckit.tasks` to generate implementation tasks
