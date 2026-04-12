# Database Connection Pool Optimization Guide

## Overview

This document describes the connection pool configuration and optimization strategies for PostgreSQL with SQLAlchemy 2.0 async.

## Current Configuration

The `DatabaseManager` class in `server/infrastructure/persistence/database.py` provides:

- **Pool Size**: 5 (configurable via `POOL_SIZE` env var)
- **Max Overflow**: 10 (configurable via `MAX_OVERFLOW` env var)
- **Pool Recycle**: 3600 seconds (1 hour)
- **Pool Timeout**: 30 seconds
- **Pool Pre-ping**: Enabled (connection health check before use)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POOL_SIZE` | 5 | Base pool size (permanent connections) |
| `MAX_OVERFLOW` | 10 | Additional connections allowed beyond pool_size |
| `DATABASE_URL` | Required | PostgreSQL connection URL |

## Pool Sizing Guidelines

### Development
```bash
POOL_SIZE=5
MAX_OVERFLOW=5
```

### Production (Small Instance)
```bash
# For 2 vCPU, 4GB RAM
POOL_SIZE=10
MAX_OVERFLOW=20
```

### Production (Medium Instance)
```bash
# For 4 vCPU, 8GB RAM
POOL_SIZE=20
MAX_OVERFLOW=40
```

### Production (High Load)
```bash
# For 8+ vCPU, 16GB+ RAM
POOL_SIZE=40
MAX_OVERFLOW=80
```

## Connection Pool Math

```
Total Possible Connections = POOL_SIZE + MAX_OVERFLOW

Example:
  POOL_SIZE = 20
  MAX_OVERFLOW = 40
  Total = 60 connections

PostgreSQL max_connections should be:
  max_connections > (app_instances * total_pool_size) + admin_connections
```

## Monitoring

### Pool Metrics

The `DatabaseManager` exposes pool metrics via `get_pool_metrics()`:

```python
from server.infrastructure.persistence.database import get_db_manager

manager = get_db_manager()
metrics = manager.get_pool_metrics()

print(f"Pool Size: {metrics.size}")
print(f"Checked Out: {metrics.checked_out}")
print(f"Checked In: {metrics.checked_in}")
print(f"Overflow: {metrics.overflow}")
print(f"Utilization: {metrics.utilization:.1f}%")
```

### Health Check Endpoint

```python
@app.get("/health/database")
async def database_health():
    from server.infrastructure.persistence.database import health_check
    status = await health_check()
    return status.to_dict()
```

## Circuit Breaker Pattern

The `DatabaseManager` includes a circuit breaker for resilience:

- **Failure Threshold**: 5 consecutive failures
- **Recovery Timeout**: 30 seconds
- **States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)

## Best Practices

### 1. Use Context Managers

```python
async with db_manager.session() as session:
    # Use session
    pass  # Automatically closed
```

### 2. Short-Lived Transactions

```python
# Good: Short transaction
async with db_manager.session() as session:
    repo = PostgreSQLTaskRepository(session)
    task = await repo.get_task(task_id)
    task.update_content("New content", [])
    await repo.update_task(task)
    await session.commit()

# Bad: Long-running transaction
async with db_manager.session() as session:
    # Don't hold connection during slow operations
    await asyncio.sleep(10)  # Wrong!
    await repo.get_task(task_id)
```

### 3. Proper Error Handling

```python
from sqlalchemy.exc import OperationalError

try:
    async with db_manager.session() as session:
        # Database operations
        pass
except OperationalError as e:
    # Handle connection failure
    logger.error(f"Database error: {e}")
```

### 4. Connection Pool Tuning

```python
# For high-concurrency scenarios
manager = DatabaseManager(
    database_url="postgresql://...",
    pool_size=40,
    max_overflow=80,
)
```

## Troubleshooting

### "QueuePool limit of size X overflow Y reached"

**Cause**: All connections are in use

**Solutions**:
1. Increase `POOL_SIZE` and `MAX_OVERFLOW`
2. Check for connection leaks (missing `session.close()`)
3. Reduce transaction duration
4. Add connection pooling at PgBouncer layer

### "Connection reset by peer"

**Cause**: Network issues or PostgreSQL restart

**Solutions**:
1. Enable `pool_pre_ping=True` (already enabled)
2. Implement retry logic with tenacity
3. Check network stability

### High Connection Utilization

**Symptoms**: `utilization > 80%` consistently

**Solutions**:
1. Increase pool size
2. Add application-level caching
3. Optimize slow queries
4. Consider read replicas

## Migration Commands

### Create Migration

```bash
cd server
poetry run alembic revision --autogenerate -m "Add users table"
```

### Apply Migrations

```bash
cd server
poetry run alembic upgrade head
```

### Rollback One Migration

```bash
cd server
poetry run alembic downgrade -1
```

### View Current Version

```bash
cd server
poetry run alembic current
```

## Load Testing

Use the following to test pool behavior under load:

```python
import asyncio
from server.infrastructure.persistence.database import init_database

async def load_test():
    db = await init_database()

    async def worker(worker_id: int):
        for i in range(100):
            async with db.session() as session:
                # Your query here
                await session.execute(text("SELECT 1"))
            await asyncio.sleep(0.01)

    await asyncio.gather(*[worker(i) for i in range(50)])

asyncio.run(load_test())
```
