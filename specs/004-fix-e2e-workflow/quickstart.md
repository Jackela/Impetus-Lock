# Quickstart: Local E2E Workflow Validation

**Feature**: E2E Workflow Backend Import Fix  
**Purpose**: Validate workflow changes locally to prevent "10 consecutive failed commits" scenarios

---

## Overview

This guide explains how to test GitHub Actions E2E workflow changes **locally** before pushing, using:
1. **Act CLI** - Simulates GitHub Actions environment (best for syntax/individual jobs)
2. **Docker Compose** - Full backend + PostgreSQL testing (best for integration validation)

---

## Prerequisites

### Required
- **Docker Desktop** (Windows/macOS) or Docker Engine (Linux)
- **Act CLI** ([installation guide](https://github.com/nektos/act#installation))

### Verify Installation
```bash
# Check Docker
docker --version  # Should show v20.10+

# Check Act CLI
act --version     # Should show v0.2.40+
```

---

## Strategy 1: Act CLI (GitHub Actions Simulation)

**Best for**: Syntax validation, linting jobs, type-check jobs  
**Limitations**: Service containers (PostgreSQL) may not work exactly like GitHub Actions

### ⚠️ Act CLI Limitations (Why It Missed Our Bugs)

**Root Cause**: Act CLI **executes scripts** but uses **different environments/defaults** than GitHub Actions:

1. **Shell defaults differ**
   - **GitHub Actions** (in containers): Defaults to `sh`, NOT `bash` ([docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/run-jobs-in-a-container))
   - **Act CLI**: May use different shell depending on image
   - **Example**: `{1..30}` brace expansion is **bash-only** syntax, fails in `sh` (our bug #1)
   - **Fix**: Always specify `shell: bash` explicitly ([GitHub best practice](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/set-default-values-for-jobs))

2. **Runner images incomplete**
   - Act's default images are **deliberately minimal** vs GitHub hosted runners ([act docs](https://nektosact.com/usage/runners.html))
   - Missing system-level capabilities (systemd, some tools)
   - **Fix**: Use heavier images like `catthehacker/ubuntu:full-*` with `-P` flag

3. **Service container networking differs**
   - GitHub Actions: Services accessible by service name (e.g., `postgres:5432`) ([docs](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers))
   - Act CLI: Network alias issues, `job.container.network` unsupported ([issue #2074](https://github.com/nektos/act/issues/2074))
   - **Fix**: Use Docker Compose with identical service names for integration testing

4. **Poetry editable install + working directory mismatch** (our bug #2)
   - **NOT an Act issue** - This affects both Act and GitHub Actions
   - Root cause: `poetry install` creates `.pth` file, but execution context differs from install context
   - **Fix**: Build wheel + install, or use `python -m` invocation ([SO discussion](https://stackoverflow.com/questions/66474844/import-local-package-during-poetry-run))

**What Act CLI DOES provide**:
- Workflow logic validation in "near-similar" environment
- Script execution in Linux containers (catches many issues)
- Fast local iteration (faster than pushing to GitHub)

### Quick Commands

```bash
# From repository root (D:\Code\Impetus-Lock)

# 1. Dry run (syntax validation, no execution)
act -n  # ⚠️ Only catches YAML syntax, NOT shell script bugs!

# 2. List available jobs
act -l

# 3. Test specific job (recommended)
act -j lint         # ✅ Reliable
act -j type-check   # ✅ Reliable
act -j backend-tests  # ✅ Works (no PostgreSQL required)
act -j frontend-tests # ✅ Works (no backend required)

# 4. Test E2E workflow (⚠️ Limited value, use Docker Compose instead)
act -j e2e  # ❌ Service container networking differs from GitHub Actions
```

### Expected Results

✅ **Will work**:
- Syntax validation (`act -n`)
- Individual jobs (lint, type-check, backend-tests, frontend-tests)
- Workflow structure verification

⚠️ **May fail** (expected, NOT a bug):
- `act -j e2e` due to service container networking (known Act CLI limitation)
- PostgreSQL connection from Playwright container
- Shell script differences (sh vs bash)

### Troubleshooting

**Issue**: `ERROR: Cannot connect to Docker daemon`  
**Fix**: Start Docker Desktop, ensure it's running

**Issue**: `Error: image not found`  
**Fix**: Act CLI will prompt to download missing images, choose "medium" image

**Issue**: Service container networking fails  
**Expected**: Act CLI has known limitations with service containers, use Docker Compose for full E2E validation

**Issue**: Shell syntax works in Act but fails in GitHub Actions (or vice versa)  
**Root cause**: Act CLI uses different shell defaults than GitHub Actions  
**Fix**: Always specify `shell: bash` when using bash-specific syntax (`{1..30}`, arrays, etc.)

---

## Strategy 2: Docker Compose (Full Integration Testing)

**Best for**: Backend + PostgreSQL integration, health check validation  
**Advantages**: Exact container networking, reliable PostgreSQL connectivity

### Setup

Create `docker-compose.test.yml` in repository root:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: impetus_lock_test
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile.test  # Create this file (see below)
    environment:
      TESTING: "true"
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/impetus_lock_test
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
```

### Create `server/Dockerfile.test`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock README.md ./

# Copy source code
COPY server/ ./server/

# Install dependencies (WITHOUT --no-root flag)
RUN poetry install

# Expose port
EXPOSE 8000

# Start server
CMD ["poetry", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Run Full Integration Test

```bash
# From repository root

# 1. Start services
docker-compose -f docker-compose.test.yml up -d

# 2. Wait for backend health check
timeout 60 bash -c 'until curl -s http://localhost:8000/health > /dev/null 2>&1; do echo "Waiting for backend..."; sleep 2; done'

# 3. Verify backend is accessible
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"impetus-lock","version":"0.1.0"}

# 4. Verify PostgreSQL connection
docker-compose -f docker-compose.test.yml exec backend poetry run python -c "from server.main import app; print('✅ Backend imports working')"

# 5. Cleanup
docker-compose -f docker-compose.test.yml down -v
```

### Expected Results

✅ **Success indicators**:
- PostgreSQL container starts with healthy status
- Backend container starts without import errors
- Health endpoint returns 200 OK
- Backend can import `server.main` successfully

❌ **Failure indicators**:
- "Could not import module 'server.main'" → Poetry package not installed (check `poetry install` without `--no-root`)
- Health endpoint timeout → Backend crashed on startup (check container logs)
- PostgreSQL connection refused → Service not healthy (increase healthcheck timeout)

---

## Recommended Workflow

**Before Pushing Commits**:

```bash
# Step 1: Validate workflow syntax (fast, ~10s)
act -n

# Step 2: Test individual jobs (fast, ~1-2min each)
act -j lint
act -j type-check

# Step 3: Full backend integration test (slow, ~3-5min)
docker-compose -f docker-compose.test.yml up -d
curl -f http://localhost:8000/health || echo "❌ Backend failed"
docker-compose -f docker-compose.test.yml down -v

# Step 4: If all pass, push to GitHub
git push origin 004-fix-e2e-workflow
```

**After Pushing**:
- Monitor GitHub Actions E2E workflow status
- If fails, check logs and iterate locally using Docker Compose

---

## Best Practices to Avoid Act CLI Blind Spots

### 1. Shell Script Safety

**Problem**: Act CLI doesn't validate shell script semantics  
**Solution**: Always specify shell explicitly

```yaml
# ❌ BAD - Uses default shell (sh on Linux, may differ from GitHub Actions)
- name: Loop example
  run: |
    for i in {1..30}; do echo $i; done  # Fails in sh!

# ✅ GOOD - Explicitly specify bash
- name: Loop example
  shell: bash
  run: |
    for i in {1..30}; do echo $i; done  # Works!
```

**Bash-specific syntax that needs `shell: bash`**:
- Brace expansion: `{1..30}`, `{a,b,c}`
- Arrays: `arr=(1 2 3)`
- Process substitution: `<(command)`
- `[[` conditional: `[[ -f file ]]`

### 2. Working Directory + Editable Installs

**Problem**: Poetry editable installs use `.pth` files that add project root to `sys.path`  
**Gotcha**: If `working-directory` is the same as the package root, imports fail

```yaml
# ❌ BAD - Working directory conflicts with editable install
- name: Install dependencies
  working-directory: ./server
  run: poetry install  # Creates .pth pointing to ./server

- name: Start server
  working-directory: ./server  # Now in server/, looking for server/server/main.py!
  run: poetry run uvicorn server.main:app

# ✅ GOOD - Use python -m or run from parent directory
- name: Start server
  working-directory: ./server
  run: poetry run python -m uvicorn server.main:app  # Module resolution works correctly
```

### 3. Service Container Networking

**Problem**: Act CLI service containers have different networking than GitHub Actions  
**Solution**: Always test service container workflows with Docker Compose

```yaml
# GitHub Actions uses service label as hostname
services:
  postgres:
    image: postgres:16
    
container:
  image: playwright:latest
  
steps:
  - name: Connect to DB
    run: psql postgresql://user:pass@postgres:5432/db  # 'postgres' is hostname
```

**Act CLI limitation**: Service container hostname resolution may fail  
**Workaround**: Test with Docker Compose using identical service names

### 4. Environment Variable Differences

**Problem**: Act CLI may not set all GitHub Actions default environment variables  
**Solution**: Explicitly set critical env vars in workflow

```yaml
# ✅ GOOD - Explicitly set all required env vars
env:
  CI: true
  TESTING: true
  DATABASE_URL: postgresql://user:pass@host:5432/db
```

### 5. Validation Checklist

Before pushing workflow changes, verify:

- [ ] **Shell syntax**: Used `shell: bash` for bash-specific syntax?
- [ ] **Working directory**: Tested with actual directory structure (not just Act CLI)?
- [ ] **Service containers**: Validated with Docker Compose if using services?
- [ ] **Import paths**: Tested Poetry editable installs with actual startup?
- [ ] **Environment vars**: All required vars explicitly defined?

**Golden Rule**: 
> **Act validates workflow logic and script execution in "near-similar" environments;  
> Docker Compose validates multi-service system behavior with production-like networking.**

**Prerequisites for consistency**:
1. **Fix shell ambiguity**: Use workflow-level `defaults.run.shell: bash` ([GitHub docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/set-default-values-for-jobs))
2. **Fix working directory**: Use `defaults.run.working-directory` to keep install/test contexts aligned
3. **Fix Poetry packaging**: Build wheel + install instead of editable install for CI consistency:
   ```bash
   poetry build && pip install dist/*.whl
   ```
   Or ensure editable install works by using `python -m` invocation ([Poetry issue #9311](https://github.com/python-poetry/poetry/issues/9311))
4. **Match service names**: Use identical service names in Docker Compose and GitHub Actions `services:`

---

## Common Issues

### Issue 1: "Could not import module 'server.main'"

**Root Cause**: `poetry install --no-root` was used  
**Fix**: Change to `poetry install` (installs `server` package)  
**Verify**: In `Dockerfile.test`, ensure line is `RUN poetry install` (not `RUN poetry install --no-root`)

### Issue 2: PostgreSQL connection refused

**Symptoms**: Backend logs show "connection refused" or "could not connect to server"  
**Fix**: Ensure `depends_on` with `condition: service_healthy` in docker-compose.test.yml  
**Verify**: `docker-compose ps` should show postgres as "healthy"

### Issue 3: Health endpoint timeout

**Symptoms**: `curl` keeps failing after 60s  
**Debugging**:
```bash
# Check backend container logs
docker-compose -f docker-compose.test.yml logs backend

# Check if backend process is running
docker-compose -f docker-compose.test.yml exec backend ps aux | grep uvicorn
```

**Common causes**:
- Import error during startup (check for "Could not import module")
- Port binding issue (ensure port 8000 not already in use)
- Database migration errors (check if alembic migrations needed)

---

## Resources

- **Act CLI Documentation**: https://github.com/nektos/act
- **Docker Compose Documentation**: https://docs.docker.com/compose/
- **GitHub Actions Service Containers**: https://docs.github.com/en/actions/using-containerized-services
- **Poetry Package Installation**: https://python-poetry.org/docs/cli/#install

---

## Summary

| Validation Type | Tool | Speed | Reliability | Use Case |
|----------------|------|-------|-------------|----------|
| **Syntax check** | Act CLI `-n` | ⚡ Fast (10s) | ✅ High | Pre-commit validation |
| **Individual jobs** | Act CLI `-j` | ⚡ Fast (1-2min) | ✅ High | Lint, type-check |
| **E2E workflow** | Act CLI `-j e2e` | 🐢 Slow (3-5min) | ⚠️ Medium | Limited by service containers |
| **Full integration** | Docker Compose | 🐢 Slow (3-5min) | ✅ High | Backend + PostgreSQL testing |

**Golden Rule**: Always validate with Docker Compose before pushing E2E workflow changes.
