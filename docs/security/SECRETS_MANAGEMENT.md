# Secrets Management

This document tracks secrets that require rotation for production deployment.

## Server Secrets (`server/server/.env`)

The following secrets are defined in the server `.env` file and **must be rotated** before production:

| Secret           | Purpose               | Rotation Action                           |
| ---------------- | --------------------- | ----------------------------------------- |
| `OPENAI_API_KEY` | LLM API access        | Generate new key at platform.openai.com   |
| `DATABASE_URL`   | PostgreSQL connection | Regenerate credentials in PostgreSQL      |
| `JWT_SECRET`     | JWT token signing     | Generate new random string (min 32 chars) |

### Rotation Procedure

1. **Generate new secrets:**

   ```bash
   # JWT_SECRET - generate secure random string
   openssl rand -base64 32

   # For database, use your PostgreSQL admin tool
   ```

2. **Update `server/server/.env`** with new values (file is gitignored, not committed)

3. **Document the new values** in your secrets manager (e.g., 1Password, HashiCorp Vault)

### Verification

After rotation, verify:

- [ ] Server starts without errors
- [ ] Existing user sessions are invalidated (expected for JWT change)
- [ ] Database connections work with new credentials

## Client Secrets

No client-side secrets require rotation. All API keys are stored in the browser's localStorage via `llmKeyVault` and are user-provided (BYOK model).

## GitHub Actions Secrets

For CI/CD, add these secrets in GitHub repository settings:

| Secret              | Used By           |
| ------------------- | ----------------- |
| `OPENAI_API_KEY`    | E2E tests in CI   |
| `POSTGRES_PASSWORD` | E2E test database |

See `.github/ workflows/ci.yml` and `.github/workflows/e2e.yml` for exact usage.

## Security Best Practices

1. **Never commit `.env` files** - They are in `.gitignore`
2. **Use environment-specific secrets** - Dev/staging/prod should have different credentials
3. **Rotate regularly** - Rotate API keys quarterly, JWT secrets monthly
4. **Monitor for leaks** - Enable GitHub secret scanning alerts
