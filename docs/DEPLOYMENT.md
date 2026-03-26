# Impetus Lock - Deployment Guide

## Overview

This guide covers deploying the Impetus Lock application to staging and production environments using Docker and Docker Compose.

## Architecture

The application consists of four main services:

- **PostgreSQL**: Primary database for persistent storage
- **Redis**: Cache and WebSocket pub/sub for real-time features (Phase 4)
- **API (FastAPI)**: Backend REST API and WebSocket server
- **Client (React)**: Frontend web application served via Nginx

## Prerequisites

### Required Tools

- Docker Engine 24.0+
- Docker Compose 2.20+
- Git
- Bash 4.0+

### For Remote Deployment

- SSH access to target server
- Docker registry account (GitHub Container Registry recommended)

## Configuration

### Environment Files

Create environment-specific configuration files:

#### Staging (`.env.staging`)

```bash
# Database
POSTGRES_DB=impetus_staging
POSTGRES_USER=impetus
POSTGRES_PASSWORD=your_secure_staging_password
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=your_secure_redis_password
REDIS_PORT=6379

# API
API_PORT=8000
API_WORKERS=2
LOG_LEVEL=INFO
SHUTDOWN_TIMEOUT=30

# Security (generate strong secrets)
SECRET_KEY=your-32-character-minimum-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Client
CLIENT_PORT=80
VITE_API_URL=/api

# LLM (optional for staging)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEFAULT_LLM_PROVIDER=anthropic

# CORS
CORS_ORIGINS=http://localhost,https://staging.yourdomain.com
```

#### Production (`.env.production`)

Use the same structure as staging with production-specific values. **Never commit this file.**

### Secret Generation

Generate secure secrets:

```bash
# PostgreSQL password
openssl rand -base64 32

# Redis password
openssl rand -base64 32

# JWT secret (minimum 32 characters)
openssl rand -base64 48
```

## Docker Compose Production Configuration

Create `docker-compose.prod.yml` in the project root:

```yaml
# Impetus Lock - Production Docker Compose
# ==========================================
version: "3.9"

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: impetus-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-impetus}
      POSTGRES_USER: ${POSTGRES_USER:-impetus}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me_in_production}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/alembic:/docker-entrypoint-initdb.d/alembic:ro
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER:-impetus} -d ${POSTGRES_DB:-impetus}",
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - impetus-network
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  # Redis Cache & WebSocket Pub/Sub
  redis:
    image: redis:7-alpine
    container_name: impetus-redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --requirepass ${REDIS_PASSWORD:-change_me_in_production}
    volumes:
      - redis_data:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - impetus-network
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 512M

  # Backend API Server
  api:
    build:
      context: ./server
      dockerfile: Dockerfile.prod
    container_name: impetus-api
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-impetus}:${POSTGRES_PASSWORD:-change_me_in_production}@postgres:5432/${POSTGRES_DB:-impetus}
      POSTGRES_HOST: postgres
      REDIS_URL: redis://:${REDIS_PASSWORD:-change_me_in_production}@redis:6379/0
      APP_ENV: production
      DEBUG: "false"
      API_HOST: 0.0.0.0
      API_PORT: 8000
      API_WORKERS: ${API_WORKERS:-4}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      SHUTDOWN_TIMEOUT: ${SHUTDOWN_TIMEOUT:-30}
      HEALTH_CHECK_ENABLED: "true"
      SECRET_KEY: ${SECRET_KEY:-change_me}
      CORS_ORIGINS: ${CORS_ORIGINS:-https://impetus-lock.example.com}
    ports:
      - "${API_PORT:-8000}:8000"
    volumes:
      - api_logs:/app/logs
      - api_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - impetus-network
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
    stop_grace_period: 30s
    stop_signal: SIGTERM

  # Frontend Client
  client:
    build:
      context: ./client
      dockerfile: Dockerfile.prod
      args:
        - VITE_API_URL=${VITE_API_URL:-/api}
    container_name: impetus-client
    restart: unless-stopped
    ports:
      - "${CLIENT_PORT:-80}:80"
    depends_on:
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - impetus-network
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M

volumes:
  postgres_data:
  redis_data:
  api_logs:
  api_uploads:

networks:
  impetus-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Local Deployment

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/impetus-lock.git
cd impetus-lock

# Create environment file
cp .env.staging.example .env.staging
# Edit .env.staging with your values

# Deploy to staging
./scripts/deploy-staging.sh
```

### Manual Deployment

```bash
# Build images
docker-compose -f docker-compose.prod.yml --env-file .env.staging build

# Start services
docker-compose -f docker-compose.prod.yml --env-file .env.staging up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down
```

## Remote Deployment

### GitHub Actions (Automated)

The repository includes a GitHub Actions workflow for automated staging deployments.

#### Required Secrets

Configure these in GitHub repository settings:

| Secret                 | Description                                         | Required |
| ---------------------- | --------------------------------------------------- | -------- |
| `STAGING_HOST`         | Staging server hostname                             | Optional |
| `STAGING_USER`         | SSH username                                        | Optional |
| `STAGING_SSH_KEY`      | SSH private key                                     | Optional |
| `STAGING_DEPLOY_DIR`   | Deployment directory (default: `/opt/impetus-lock`) | No       |
| `STAGING_VITE_API_URL` | API URL for client build                            | No       |

#### Workflow Behavior

1. **Build**: Creates Docker images for API and Client
2. **Push**: Uploads images to GitHub Container Registry
3. **Deploy**: Connects to staging server and deploys (if configured)
4. **Health Check**: Verifies all services are running

### Manual Production Deployment

```bash
# Set environment variables
export PRODUCTION_HOST=your-server.com
export PRODUCTION_USER=deploy

# Deploy
./scripts/deploy-production.sh v1.0.0
```

## Health Checks

### Endpoints

- **API Health**: `GET /health`
  - Returns: `{"status": "ok", "service": "impetus-lock", "version": "0.1.0"}`
- **Database Health**: `GET /health/db`
  - Returns detailed database connectivity and pool metrics

- **Client Health**: `GET /health` (served by Nginx)
  - Returns: `healthy`

### Docker Health Checks

All services include Docker health checks:

- **PostgreSQL**: `pg_isready` command
- **Redis**: `redis-cli ping`
- **API**: HTTP request to `/health`
- **Client**: HTTP request to `/health`

## Monitoring

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 api
```

### Resource Usage

```bash
# Container stats
docker stats

# Service resource limits are defined in docker-compose.prod.yml
```

### Database Backups

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U impetus impetus > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T postgres \
  psql -U impetus impetus < backup-file.sql
```

## Troubleshooting

### Services Won't Start

1. Check logs: `docker-compose logs <service>`
2. Verify environment variables are set
3. Check port availability: `netstat -tlnp | grep <port>`

### Database Connection Issues

1. Verify PostgreSQL is healthy: `docker-compose ps`
2. Check DATABASE_URL format in environment
3. Ensure migrations ran: `docker-compose exec api alembic current`

### Redis Connection Issues

1. Verify Redis password matches in all services
2. Check Redis is running: `docker-compose exec redis redis-cli ping`

### Health Checks Failing

1. Check service logs for errors
2. Verify dependent services are healthy first
3. Increase start_period in docker-compose if services need more time

## Security Considerations

### Secrets Management

- Never commit `.env.production` or `.env.staging`
- Use Docker secrets or external secret management in production
- Rotate secrets regularly

### Network Security

- Use HTTPS in production (configure Nginx with SSL)
- Restrict database and Redis ports to internal network only
- Use firewall rules to limit access

### Container Security

- Images run as non-root user (impetus)
- Read-only filesystem where possible
- Minimal base images (Alpine Linux)

## Rollback

### Automatic Rollback

The deployment scripts create database backups before deployment.

### Manual Rollback

```bash
# Stop current version
docker-compose -f docker-compose.prod.yml down

# Pull previous image version
docker pull ghcr.io/your-org/impetus-api:previous-version

# Update docker-compose to use previous image
# Edit docker-compose.prod.yml or use env var

# Restart
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Tuning

### API Workers

Adjust based on CPU cores:

```bash
# In .env file
API_WORKERS=4  # 2-4 per CPU core
```

### Database Connections

```bash
# In .env file
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
```

### Redis Memory

```bash
# In docker-compose.prod.yml, adjust redis command:
--maxmemory 512mb
--maxmemory-policy allkeys-lru
```

## Maintenance

### Regular Tasks

- Update base images monthly
- Rotate secrets quarterly
- Review and prune old Docker images
- Monitor disk usage for logs and uploads

### Cleanup Commands

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (careful!)
docker volume prune

# Full cleanup
docker system prune -a
```

## Support

For deployment issues:

1. Check logs: `docker-compose logs`
2. Review health endpoints
3. Consult GitHub Issues
4. Contact: team@impetus-lock.dev

## Files Created

The following files were created as part of this deployment configuration:

1. **docker-compose.prod.yml** - Production Docker Compose configuration
2. **scripts/deploy-staging.sh** - Staging deployment script
3. **scripts/deploy-production.sh** - Production deployment script
4. **.github/workflows/deploy-staging.yml** - GitHub Actions workflow
5. **docs/DEPLOYMENT.md** - This documentation
