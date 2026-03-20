# Security Checklist

Use this checklist before deploying to production.

## Environment Variables

- [ ] `JWT_SECRET` set to random 32+ character string
- [ ] `ENCRYPTION_KEY` set to valid base64-encoded 32-byte key
- [ ] `SECRET_KEY` set to random string
- [ ] `APP_ENV` set to "production"
- [ ] `CORS_ORIGINS` restricted to production domains only
- [ ] `DATABASE_URL` uses SSL/TLS
- [ ] No default/weak passwords in configuration

## Authentication

- [ ] JWT tokens use secure signing algorithm (HS256)
- [ ] Tokens expire after reasonable time (24 hours)
- [ ] HttpOnly, Secure, SameSite=Strict cookies
- [ ] CSRF protection enabled for state-changing operations
- [ ] Password policy enforced (min 8 chars, complexity)

## API Security

- [ ] Rate limiting configured for expensive endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (CSP headers, output encoding)
- [ ] Request size limits configured

## Infrastructure

- [ ] HTTPS/TLS enabled
- [ ] Docker containers run as non-root user
- [ ] Secrets not committed to version control
- [ ] Database not exposed to public internet
- [ ] Redis (if used) has authentication enabled
- [ ] Firewall rules restrict access appropriately

## Monitoring

- [ ] Security logging enabled
- [ ] Failed authentication attempts logged
- [ ] Unusual traffic patterns monitored
- [ ] Error reports don't expose sensitive data

## Dependencies

- [ ] `poetry run safety check` passes
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Docker images scanned for vulnerabilities
- [ ] Dependencies updated to latest secure versions

## Testing

- [ ] Authentication flow tested
- [ ] CSRF protection tested
- [ ] Rate limiting tested
- [ ] Input validation tested with edge cases
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
