# GitHub Actions + Poetry Technical Research Findings

**Research Date**: 2025-11-08  
**Context**: Resolving CI failures for Impetus Lock monorepo E2E testing with FastAPI + PostgreSQL

---

## 1. Poetry Package Import in CI Containers

### Decision
**Use `poetry install` (WITHOUT `--no-root`) to install the project package** along with dependencies. The current pyproject.toml configuration is correct:

```toml
[tool.poetry]
packages = [{include = "server"}]
```

### Rationale
1. **`--no-root` Limitation**: The `--no-root` flag installs dependencies but **skips installing the project package itself**, which prevents Python from importing the `server` module. This is why `poetry run uvicorn server.main:app` fails with "Could not import module 'server.main'".

2. **Package Configuration**: The `packages = [{include = "server"}]` directive tells Poetry to install the `server/` directory as an importable package, making `import server.main` work correctly.

3. **PYTHONPATH Mechanics**: When you run `poetry install` (without `--no-root`), Poetry:
   - Creates a virtualenv (typically at `.venv/` if `virtualenvs-in-project = true`)
   - Installs all dependencies from `poetry.lock`
   - **Installs the project package in editable mode** (similar to `pip install -e .`)
   - Adds the project package to the virtualenv's `site-packages` or directly modifies `sys.path`

4. **Evidence from Search Results**:
   - Poetry issue #1868: "ModuleNotFoundError when using poetry run" → Fixed by adding `packages = [{include = "my_pkg"}]`
   - Stack Overflow (69430109): "Installing package with poetry in github actions installs dependencies but not my project" → Solved by removing `--no-root` flag
   - Poetry docs: "`--no-root` option prevents installing the root package"

### Alternatives Considered
1. **Manual PYTHONPATH**: Adding `PYTHONPATH=.` to all `poetry run` commands
   - ❌ Rejected: Hacky workaround, breaks in containers with different working directories
   - ❌ Doesn't follow Python packaging best practices

2. **`poetry shell` + activation**: Activating the virtualenv manually
   - ❌ Rejected: Not idiomatic for CI/CD; `poetry run` handles activation automatically
   - ❌ Adds unnecessary complexity to CI scripts

3. **Docker layer optimization with `--no-root`**: Using `--no-root` for dependency caching
   - ⚠️ Conditional use: Valid for Docker multi-stage builds (install deps first, then install package)
   - ✅ Pattern: `RUN poetry install --no-root` → `COPY . .` → `RUN poetry install`
   - ❌ Not applicable to GitHub Actions runner jobs (no multi-stage caching)

### Implementation Notes
**For GitHub Actions CI** (current `.github/workflows/ci.yml`):
```yaml
- name: Install dependencies
  working-directory: ./server
  run: poetry install  # NO --no-root flag
```

**For Docker production deployments** (future optimization):
```dockerfile
# Layer 1: Dependencies (cached)
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --no-dev

# Layer 2: Application code
COPY . .
RUN poetry install --no-dev  # Installs package in editable mode
```

**Current Project Status**:
- ✅ `pyproject.toml` has `packages = [{include = "server"}]` configured
- ✅ CI uses `poetry install --no-root` (NEEDS FIX: remove `--no-root`)
- ⚠️ This explains why CI lint/type-check jobs pass (no imports needed) but E2E tests would fail (uvicorn needs to import `server.main`)

---

## 2. Container Networking for Service Containers

### Decision
**Use the service label as the hostname when running jobs in a container**:
- **Container job**: `DATABASE_URL=postgresql://user:pass@postgres:5432/db`
- **Runner job** (runs-on ubuntu-latest, no container directive): `DATABASE_URL=postgresql://user:pass@localhost:5432/db`

### Rationale
1. **Docker Network Bridge Behavior**: GitHub Actions creates a user-defined Docker bridge network when you use the `container:` directive for a job. All containers in the same job (job container + service containers) are attached to this network.

2. **Automatic DNS Resolution**: Docker provides DNS resolution within user-defined bridge networks. The hostname is the service label you define in the workflow YAML (e.g., `postgres`).

3. **Port Mapping Differences**:
   - **Container jobs**: All ports are exposed between containers on the bridge network (no port mapping needed). Service containers run on their native ports (PostgreSQL on 5432).
   - **Runner jobs**: Service container ports must be mapped to the host (e.g., `ports: ["5432:5432"]`), and you access them via `localhost:<mapped-port>`.

4. **Official GitHub Docs** (Creating PostgreSQL service containers):
   - "The hostname of the PostgreSQL service is the label you configured in your workflow, in this case, postgres."
   - "Docker containers on the same user-defined bridge network expose all ports to each other, so you don't need to map any of the service container ports to the Docker host."

5. **Evidence from Search Results**:
   - Stack Overflow (57510530): "Use the service label (e.g., 'postgres') when running in a container, not localhost"
   - Simon Willison's TIL: "For custom containers, attach to the network named in `job.container.network`, then access services by name"
   - Community discussion #26675: "Change hostname from 127.0.0.1 to postgres for containerized jobs"

### Alternatives Considered
1. **Using `localhost` in container jobs**:
   - ❌ Rejected: `localhost` inside a container refers to the container's own loopback interface, not the Docker host
   - ❌ Will fail with "connection refused" errors

2. **Using Docker's magic IP `172.17.0.1`**:
   - ⚠️ Conditional: Works for accessing the Docker host from a container
   - ❌ Not needed for service-to-service communication (DNS is cleaner)
   - ❌ Brittle (IP can change with custom networks)

3. **Using `host.docker.internal`**:
   - ⚠️ Conditional: Works on Docker Desktop (macOS/Windows) for host access
   - ❌ Not supported on Linux runners (GitHub Actions uses Linux)
   - ❌ Not needed for service containers (use service label)

### Implementation Notes
**Example GitHub Actions Workflow**:
```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.40.0-jammy  # Runs job in container
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - name: Run FastAPI with PostgreSQL
        env:
          DATABASE_URL: postgresql://postgres:testpass@postgres:5432/testdb
        run: poetry run uvicorn server.main:app --host 0.0.0.0 --port 8000
```

**Key Configuration**:
- Service label: `postgres` (becomes the hostname)
- No `ports:` mapping needed (containers share bridge network)
- Health check ensures PostgreSQL is ready before job steps run

**Common Pitfalls**:
- ❌ Using `localhost:5432` in `DATABASE_URL` (fails with "connection refused")
- ❌ Forgetting to add health check options (job starts before PostgreSQL is ready)
- ❌ Mixing runner jobs and container jobs (different networking models)

---

## 3. Health Check Reliability for FastAPI Startup

### Decision
**Use a multi-retry polling script with exponential backoff**:
- **Polling interval**: 2 seconds (initial), increasing to 5 seconds
- **Timeout**: 60 seconds total (allows for slow container starts)
- **Retry strategy**: Exponential backoff with max 20 attempts
- **Health endpoint**: `/health` (simple 200 OK response)

### Rationale
1. **Uvicorn Startup Time**: FastAPI + Uvicorn typically binds to a port within 1-3 seconds on modern hardware, but in CI environments (containerized, shared resources), startup can take 5-10 seconds.

2. **GitHub Actions Service Container Behavior**: Service containers with health checks use exponential backoff (~5-6 retries before marking unhealthy), but job containers (your FastAPI app) have no built-in health check.

3. **Best Practices from Research**:
   - Docker health checks use `--interval=5s --timeout=5s --retries=5` (25 seconds max)
   - Kubernetes readiness probes use `initialDelaySeconds=10`, `periodSeconds=5`, `timeoutSeconds=3`, `failureThreshold=3`
   - Production deployments add `start_period` for slow-starting apps

4. **Evidence from Search Results**:
   - Medium (ntjegadeesh): "Health check with interval=2s, timeout=5s, retries=3"
   - GitHub Discussion #8520: "Use --interval=5s --timeout=5s --retries=5"
   - FastAPI lifecycle guide: "DB/Redis clients belong in lifespan startup, not module import time"

5. **Port Binding Delays**: In containerized environments, port binding can be delayed by:
   - Container network setup (bridge creation)
   - Dependency initialization (database connections, async event loops)
   - Resource contention (CPU/memory limits in CI)

### Alternatives Considered
1. **Fixed sleep (e.g., `sleep 10`)**:
   - ❌ Rejected: Wastes time if app starts quickly, may timeout if app is slow
   - ❌ No feedback on actual readiness

2. **Single curl attempt**:
   - ❌ Rejected: Fails if app takes >1 second to start
   - ❌ No retry logic for transient failures

3. **Using GitHub Actions marketplace actions** (e.g., `Jtalk/url-health-check-action`):
   - ✅ Valid alternative: Provides built-in retry logic (max-attempts, retry-delay)
   - ⚠️ Adds external dependency
   - ⚠️ Less control over backoff strategy

4. **No health check (assume immediate readiness)**:
   - ❌ Rejected: Flaky tests, race conditions
   - ❌ Playwright tests would fail with "connection refused"

### Implementation Notes
**Recommended Polling Script** (add to workflow):
```yaml
- name: Wait for FastAPI to be ready
  run: |
    echo "Waiting for FastAPI to start on port 8000..."
    timeout=60
    elapsed=0
    interval=2
    
    while [ $elapsed -lt $timeout ]; do
      if curl -f http://localhost:8000/health --silent --show-error --max-time 3; then
        echo "✅ FastAPI is ready!"
        exit 0
      fi
      echo "⏳ Not ready yet, retrying in ${interval}s... (${elapsed}s elapsed)"
      sleep $interval
      elapsed=$((elapsed + interval))
      # Exponential backoff: increase interval (2s → 5s)
      if [ $interval -lt 5 ]; then
        interval=$((interval + 1))
      fi
    done
    
    echo "❌ FastAPI failed to start within ${timeout}s"
    exit 1
```

**FastAPI Health Endpoint** (add to `server/main.py`):
```python
@app.get("/health")
async def health_check():
    """Health check endpoint for readiness probes."""
    return {"status": "healthy"}
```

**Why This Works**:
- ✅ Fast startup: Detects readiness in ~2-4 seconds (1-2 retries)
- ✅ Slow startup: Gracefully handles 10-20 second delays (exponential backoff)
- ✅ Failure detection: Times out at 60 seconds with clear error message
- ✅ No false negatives: Retries handle transient network issues
- ✅ Informative logs: Shows progress and elapsed time

**Production Considerations**:
- For Docker deployments, add `HEALTHCHECK` instruction:
  ```dockerfile
  HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
  ```
- For Kubernetes, use readiness probe:
  ```yaml
  readinessProbe:
    httpGet:
      path: /health
      port: 8000
    initialDelaySeconds: 10
    periodSeconds: 5
    timeoutSeconds: 3
    failureThreshold: 3
  ```

**Common Pitfalls**:
- ❌ Using `/` instead of `/health` (triggers full application logic, slower)
- ❌ Not setting `--max-time` in curl (hangs indefinitely on network issues)
- ❌ Too short timeout (<30s) in CI (fails on resource-constrained runners)
- ❌ Forgetting `--show-error` flag (silent failures, hard to debug)

---

## 4. Act CLI Local Validation

### Decision
**Use Act CLI for workflow validation, but understand service container limitations**:
- ✅ **Recommended for**: Linting individual jobs, testing job syntax, validating environment setup
- ⚠️ **Limited support**: Service containers (partial support with workarounds)
- ❌ **Not recommended for**: Full E2E testing with PostgreSQL service containers (use real CI or Docker Compose)

### Rationale
1. **Act CLI Service Container Support Status** (as of 2024):
   - **Partial support**: Service containers are only evaluated when the job runs in a container (using `container:` directive)
   - **Host executor limitation**: Services don't spin up when using `-P ubuntu-latest=-self-hosted` (host executor mode)
   - **Networking issues**: Service hostnames often fail to resolve (DNS issues in custom Docker networks)
   - **Active issues**: GitHub issues #173, #944, #2711, #5929 remain open with ongoing reports

2. **Evidence from Search Results**:
   - nektos/act issue #173: "Services not working" (opened 2019, still open)
   - nektos/act issue #944: "act does not support service hostname"
   - nektos/act issue #2711: "Spin up service containers when using host executor" (services only work in container executor mode)
   - Stack Overflow (76539861): "Services don't seem to be available in the Docker container when using act"

3. **What Act CLI DOES Support Well**:
   - ✅ Running individual jobs with `act -j <job-name>`
   - ✅ Validating workflow syntax and job dependencies
   - ✅ Testing environment variable injection (`-s`, `-e` flags)
   - ✅ Simulating matrix strategies and job conditions
   - ✅ Using custom Docker images (`-P` flag)
   - ✅ Dry runs (`act -n`) to preview workflow execution

4. **Recommended Act CLI Usage**:
   ```bash
   # ✅ GOOD: Test individual jobs without service containers
   act -j lint                # Lint job (no services needed)
   act -j type-check          # Type check job (no services needed)
   act -j backend-tests       # Unit tests (no services needed)
   
   # ⚠️ LIMITED: E2E tests requiring PostgreSQL
   act -j e2e-tests           # May fail due to service container issues
   
   # ✅ GOOD: Dry run to validate workflow
   act -n                     # Preview all jobs without execution
   act -l                     # List all available jobs
   ```

### Alternatives Considered
1. **Running full CI locally without Act CLI**:
   - **Option 1: Docker Compose** (recommended for E2E tests)
     ```yaml
     # docker-compose.test.yml
     version: '3.8'
     services:
       postgres:
         image: postgres:15
         environment:
           POSTGRES_PASSWORD: testpass
           POSTGRES_DB: testdb
         healthcheck:
           test: ["CMD", "pg_isready"]
           interval: 5s
           timeout: 5s
           retries: 5
       
       backend:
         build: ./server
         depends_on:
           postgres:
             condition: service_healthy
         environment:
           DATABASE_URL: postgresql://postgres:testpass@postgres:5432/testdb
         command: poetry run uvicorn server.main:app --host 0.0.0.0
     ```
     - ✅ Full service container support
     - ✅ Reliable networking (Docker Compose handles DNS)
     - ✅ Matches GitHub Actions service container behavior
     - ❌ Requires separate configuration file
     - ❌ Doesn't validate GitHub Actions workflow syntax

   - **Option 2: Manual Docker commands**
     ```bash
     # Start PostgreSQL
     docker run -d --name postgres \
       -e POSTGRES_PASSWORD=testpass \
       -e POSTGRES_DB=testdb \
       -p 5432:5432 \
       postgres:15
     
     # Wait for health
     docker exec postgres pg_isready
     
     # Run tests
     cd server && \
       DATABASE_URL=postgresql://postgres:testpass@localhost:5432/testdb \
       poetry run pytest
     ```
     - ✅ Full control over environment
     - ❌ Manual teardown required
     - ❌ No workflow validation

2. **Using GitHub Actions locally with alternative tools**:
   - **Earthly** (alternative to Act)
     - ✅ Better service container support
     - ✅ Reproducible builds (Dockerfile + Makefile hybrid)
     - ❌ Requires learning new syntax
     - ❌ Not a direct GitHub Actions simulator

   - **GitLab Runner** (for GitLab CI/CD)
     - ❌ Not applicable (different CI system)

3. **Skipping local validation entirely**:
   - ❌ Rejected: Wastes time pushing failing commits
   - ❌ Clutters commit history with CI fixes

### Implementation Notes
**Recommended Local Development Workflow**:

1. **Quick validation** (before commit):
   ```bash
   # Backend checks (fast, no services needed)
   cd server
   poetry run ruff check .
   poetry run mypy .
   poetry run pytest tests/
   
   # Frontend checks (fast)
   cd client
   npm run lint
   npm run type-check
   npm run test
   ```

2. **Act CLI validation** (workflow syntax):
   ```bash
   # Validate workflow parses correctly
   act -n
   
   # Test specific jobs (non-service-dependent)
   act -j lint
   act -j type-check
   act -j backend-tests
   ```

3. **Full E2E testing** (with services):
   ```bash
   # Option A: Docker Compose (recommended)
   docker-compose -f docker-compose.test.yml up --abort-on-container-exit
   
   # Option B: Manual Docker + local test run
   docker run -d --name postgres \
     -e POSTGRES_PASSWORD=testpass \
     -e POSTGRES_DB=testdb \
     -p 5432:5432 \
     postgres:15
   
   sleep 5  # Wait for PostgreSQL startup
   
   cd server
   DATABASE_URL=postgresql://postgres:testpass@localhost:5432/testdb \
     poetry run uvicorn server.main:app &
   
   sleep 3  # Wait for FastAPI startup
   
   cd ../client
   npm run test:e2e
   
   # Cleanup
   kill %1  # Kill uvicorn
   docker stop postgres && docker rm postgres
   ```

**Act CLI Best Practices**:
- ✅ Use `.actrc` for consistent configuration (already configured in project)
- ✅ Specify platform image: `-P ubuntu-latest=catthehacker/ubuntu:act-latest`
- ✅ Use `--container-architecture linux/amd64` for reproducibility
- ✅ Enable verbose output for debugging: `-v` (uncomment in `.actrc`)
- ⚠️ Service containers require `container:` directive in job (not just `runs-on`)

**Current Project Status**:
- ✅ `.actrc` configured with optimal settings
- ✅ Act CLI installed and ready for syntax validation
- ⚠️ Service containers not yet in workflow (future Phase 6 work)
- 📝 Recommendation: Use Act for quick job validation, Docker Compose for E2E

**Resources**:
- Act CLI docs: https://nektosact.com/
- Service container issues: https://github.com/nektos/act/issues?q=service+containers
- Docker Compose for testing: https://docs.docker.com/compose/

---

## Summary & Recommendations

### Immediate Actions (Phase 5 Complete → Phase 6 Prep)

1. **Fix Poetry Installation in CI** (Priority: HIGH):
   - Remove `--no-root` flag from all `poetry install` commands in `.github/workflows/ci.yml`
   - Verify `packages = [{include = "server"}]` exists in `pyproject.toml` ✅ (already present)

2. **Add Health Check Endpoint** (Priority: MEDIUM):
   - Implement `/health` route in `server/main.py`
   - Add health check polling script to workflow (see Section 3)

3. **Configure Service Containers** (Priority: MEDIUM, when adding E2E tests):
   - Use `postgres` as hostname in `DATABASE_URL` (container jobs)
   - Add health check options to PostgreSQL service

4. **Update Local Validation Strategy** (Priority: LOW):
   - Use Act CLI for quick syntax checks: `act -j lint`
   - Use Docker Compose for E2E testing with PostgreSQL
   - Document in CLAUDE.md

### Long-Term Recommendations

1. **CI/CD Pipeline Enhancement**:
   - Add separate E2E job with service containers (Phase 6)
   - Implement caching for Poetry virtualenvs (already done ✅)
   - Add coverage reporting integration

2. **Docker Optimization** (Future Production Deployment):
   - Multi-stage Dockerfile with `--no-root` for layer caching
   - Health check with `/health` endpoint
   - Non-root user for security

3. **Monitoring & Observability**:
   - Structured logging for health check endpoint
   - Metrics for startup time and request latency
   - Alert on repeated health check failures

### Evidence-Based Confidence Scores

| Research Question | Confidence | Evidence Quality |
|-------------------|------------|------------------|
| Poetry `--no-root` issue | 95% | Official docs + multiple GitHub issues + Stack Overflow |
| Container networking | 98% | Official GitHub docs + Docker documentation |
| Health check strategy | 90% | Industry best practices + FastAPI community patterns |
| Act CLI limitations | 85% | GitHub issues (ongoing) + community workarounds |

---

**Next Steps**: Review findings with team, implement Priority HIGH fixes, validate in CI before Phase 6 E2E testing work.
