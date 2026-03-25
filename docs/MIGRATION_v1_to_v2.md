# Migration Guide: v1.x → v2.0

## Overview

Version 2.0 introduces significant security improvements and breaking changes.
This guide helps you migrate from v1.x to v2.0.

## Breaking Changes

### 1. Authentication System

**Before (v1.x):**

```bash
# API Key in header
curl -H "X-LLM-Api-Key: sk-xxx" \
  http://api.impetus-lock.com/intervention
```

**After (v2.0):**

```bash
# JWT Cookie-based authentication
# 1. Login to get cookies
curl -X POST http://api.impetus-lock.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}' \
  -c cookies.txt

# 2. Make authenticated requests
curl -b cookies.txt \
  http://api.impetus-lock.com/intervention \
  -H "X-CSRF-Token: <token_from_cookie>"
```

### 2. Environment Variables

**New Required Variables:**

```bash
# Security
JWT_SECRET=your-secret-key-min-32-chars
ENCRYPTION_KEY=your-32-byte-key-base64
SECRET_KEY=your-app-secret

# Rate Limiting (optional, has defaults)
RATE_LIMIT_DEFAULT=100/minute
RATE_LIMIT_INTERVENTION=10/minute
REDIS_URL=redis://localhost:6379/0
```

**Updated Variables:**

```bash
# CORS now strictly validated in production
CORS_ORIGINS=https://app.impetus-lock.com

# Testing flag behavior changed
TESTING=false  # Must be explicit string "true" to enable
```

### 3. API Response Format

**Error responses now have unified structure:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description",
    "details": {
      "field": "additional context"
    }
  }
}
```

## Migration Steps

### Step 1: Backup

```bash
# Backup database
pg_dump impetus_lock > backup_$(date +%Y%m%d).sql

# Backup .env files
cp server/.env server/.env.backup
cp client/.env client/.env.backup
```

### Step 2: Update Environment

```bash
# Add new variables to server/.env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> server/.env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> server/.env
echo "SECRET_KEY=$(openssl rand -base64 32)" >> server/.env

# Update CORS for production
sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=https://your-domain.com|' server/.env
```

### Step 3: Database Migration

```bash
cd server
poetry run alembic upgrade head
```

### Step 4: Update Client Code

**For JavaScript/TypeScript clients:**

```typescript
// Before
const response = await fetch("/intervention", {
  headers: { "X-LLM-Api-Key": apiKey },
});

// After
// Login first
await fetch("/auth/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});

// Subsequent requests automatically include cookies
const response = await fetch("/intervention", {
  credentials: "include",
  headers: {
    "X-CSRF-Token": getCsrfToken(), // From cookie
  },
});
```

### Step 5: Deploy

```bash
# Build new Docker images
docker-compose build

# Deploy with zero downtime (if using orchestration)
docker-compose up -d

# Verify health
curl http://localhost:8000/health
```

## Rollback Procedure

If you need to rollback to v1.x:

```bash
# 1. Stop v2.0 services
docker-compose down

# 2. Restore database
psql impetus_lock < backup_YYYYMMDD.sql

# 3. Checkout v1.x code
git checkout v1.x

# 4. Start v1.x services
docker-compose up -d
```

## Client Library Updates

### Python

```python
# Before
import requests
headers = {"X-LLM-Api-Key": api_key}
response = requests.post(url, headers=headers)

# After
import requests
session = requests.Session()
# Login
session.post(f"{base_url}/auth/login", json={
    "email": email,
    "password": password
})
# Subsequent requests use session cookies
response = session.post(f"{base_url}/intervention")
```

### JavaScript/TypeScript

```typescript
// Use the provided secureApiClient
import { secureApiClient } from "./services/security/secureApi";

// Login
await secureApiClient.post("/auth/login", {
  email: "user@example.com",
  password: "password",
});

// All subsequent requests are authenticated
const response = await secureApiClient.post("/intervention", data);
```

## Troubleshooting

### Issue: "Authentication required" errors

**Cause**: Not logged in or session expired

**Solution**:

```bash
# Check if cookie is set
curl -b cookies.txt http://api/health

# Re-login if needed
curl -X POST http://api/auth/login -c cookies.txt ...
```

### Issue: "CSRF validation failed"

**Cause**: Missing or mismatched CSRF token

**Solution**:

```bash
# Include CSRF token from cookie in header
curl -b cookies.txt \
  -H "X-CSRF-Token: <value_from_csrf_token_cookie>" \
  http://api/intervention
```

### Issue: "Rate limit exceeded"

**Cause**: Too many requests

**Solution**:

- Implement request queuing
- Add exponential backoff
- Increase limits if legitimate traffic

## Support

For migration assistance:

- Open a GitHub Discussion
- Email: support@impetus-lock.com
- Check troubleshooting guide: docs/guides/troubleshooting.md
