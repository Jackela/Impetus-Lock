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

### Quick Commands

```bash
# From repository root (D:\Code\Impetus-Lock)

# 1. Dry run (syntax validation, no execution)
act -n

# 2. List available jobs
act -l

# 3. Test specific job (recommended)
act -j lint         # Fast, reliable
act -j type-check   # Fast, reliable
act -j backend-tests  # Works (no PostgreSQL required)
act -j frontend-tests # Works (no backend required)

# 4. Test E2E workflow (⚠️ PostgreSQL networking issues expected)
act -j e2e
```

### Expected Results

✅ **Will work**:
- Syntax validation (`act -n`)
- Individual jobs (lint, type-check, backend-tests, frontend-tests)
- Workflow structure verification

⚠️ **May fail**:
- `act -j e2e` due to service container networking (known Act CLI limitation)
- PostgreSQL connection from Playwright container

### Troubleshooting

**Issue**: `ERROR: Cannot connect to Docker daemon`  
**Fix**: Start Docker Desktop, ensure it's running

**Issue**: `Error: image not found`  
**Fix**: Act CLI will prompt to download missing images, choose "medium" image

**Issue**: Service container networking fails  
**Expected**: Act CLI has known limitations with service containers, use Docker Compose for full E2E validation

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
