# Deployment Guide

**Last Updated**: 2026-02-05

Production deployment instructions for Impetus Lock.

---

## Table of Contents

- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Frontend Build](#frontend-build)
- [Docker Deployment](#docker-deployment)
- [Production Environment Variables](#production-environment-variables)
- [Health Check Endpoints](#health-check-endpoints)

---

## Environment Configuration

### Prerequisites

- Python 3.11+
- Node.js 20+ (LTS)
- PostgreSQL 16+
- Anthropic API key or Google AI API key

### Backend Environment

Create `/server/.env`:

```bash
# Database (required for production)
DATABASE_URL=postgresql://user:password@localhost:5432/impetus_lock

# LLM Provider (required - at least one)
ANTHROPIC_API_KEY=sk-ant-xxx...
GOOGLE_API_KEY=xxx...

# Provider Selection
LLM_PROVIDER=anthropic  # 'anthropic' | 'gemini' | 'instructor'

# Observability (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
ENABLE_METRICS=true
ENABLE_TRACING=false

# Cache
IDEMPOTENCY_CACHE_TTL=15  # seconds
```

### Frontend Environment

Create `/client/.env`:

```bash
# Backend API URL (without trailing slash)
VITE_API_URL=https://api.impetus-lock.com

# Disable dev mode in production
DEV=false

# Optional debug logging
VITE_DEBUG=false
```

---

## Database Setup

### PostgreSQL Setup

#### Using Docker

```bash
docker run -d \
  --name impetus-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=impetus \
  -e POSTGRES_PASSWORD=change-me-production-password \
  -e POSTGRES_DB=impetus_lock \
  -p 5432:5432 \
  -v impetus-db:/var/lib/postgresql/data \
  postgres:16-alpine

# Verify connection
docker exec -it impetus-postgres psql -U impetus -d impetus_lock -c "SELECT 1;"
```

#### Using Managed PostgreSQL (e.g., AWS RDS, Cloud SQL)

```bash
# Update DATABASE_URL with connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Database Migrations

```bash
cd server

# Run migrations
poetry run alembic upgrade head

# Verify migrations
poetry run alembic current

# Rollback if needed
poetry run alembic downgrade -1
```

---

## Frontend Build

### Production Build

```bash
cd client

# Install dependencies
npm ci

# Build for production
npm run build

# Output: client/dist/
```

### Verify Build

```bash
# Preview production build locally
npm run preview

# Check build output
ls -lh dist/
# Should contain index.html, assets/, vite-assets/
```

### Build Optimization

The Vite build already includes:
- Code splitting
- Tree shaking
- Minification
- Asset hashing

For additional optimization:

```bash
# Analyze bundle size
npm run build -- --mode analyze
```

---

## Docker Deployment

### Backend Dockerfile

Create `server/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies (without dev packages)
RUN poetry install --only main --no-root

# Copy application code
COPY . .

# Install the package
RUN poetry install --only main

# Expose port
EXPOSE 8000

# Run application
CMD ["poetry", "run", "uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile

Create `client/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Nginx Config

Create `client/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional - for serving frontend and backend together)
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: impetus-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: impetus
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: impetus_lock
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./server
    container_name: impetus-backend
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://impetus:${POSTGRES_PASSWORD}@postgres:5432/impetus_lock
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      LLM_PROVIDER: anthropic
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./client
    container_name: impetus-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"

volumes:
  postgres-data:
```

### Deploy with Docker Compose

```bash
# Set environment variables
export POSTGRES_PASSWORD=your-secure-password
export ANTHROPIC_API_KEY=sk-ant-xxx...

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## Production Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `ANTHROPIC_API_KEY` or `GOOGLE_API_KEY` | LLM provider key | `sk-ant-xxx...` |
| `LLM_PROVIDER` | LLM provider to use | `anthropic` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` |
| `ENABLE_METRICS` | Enable OpenTelemetry metrics | `false` |
| `ENABLE_TRACING` | Enable OpenTelemetry tracing | `false` |
| `IDEMPOTENCY_CACHE_TTL` | Cache duration (seconds) | `15` |

### Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use secret management** - AWS Secrets Manager, HashiCorp Vault, etc.
3. **Rotate keys regularly** - Every 90 days
4. **Use read-only database credentials** for read operations
5. **Enable CORS** only for trusted domains

---

## Health Check Endpoints

### Backend Health Check

```bash
curl http://localhost:8000/health

# Response: 200 OK
{
  "status": "ok",
  "service": "impetus-lock",
  "version": "0.1.0"
}
```

### Database Health Check

```bash
curl http://localhost:8000/health/db

# Response: 200 OK
{
  "status": "healthy",
  "database": "connected",
  "latency_ms": 5
}

# Response: 503 Service Unavailable
{
  "status": "unhealthy",
  "database": "disconnected"
}
```

### LLM Provider Health Check

```bash
curl http://localhost:8000/health/llm

# Response: 200 OK
{
  "status": "healthy",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022"
}
```

---

## Monitoring

### Logs

```bash
# Backend logs (Docker)
docker-compose logs -f backend

# Frontend logs (nginx)
docker-compose logs -f frontend
```

### Metrics (Optional)

If `ENABLE_METRICS=true`:

```bash
# OpenTelemetry endpoint
curl http://localhost:8000/metrics
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          docker-compose up -d
          docker-compose exec backend poetry run alembic upgrade head
```

---

## Related Documentation

- [Server README](../../server/README.md) - Backend development
- [Client README](../../client/README.md) - Frontend development
- [Troubleshooting Guide](troubleshooting.md) - Common issues
