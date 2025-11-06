# Dependency Management Strategy

**Project:** Impetus Lock (5-Day MVP Sprint)  
**Philosophy:** Automated updates with CI validation

---

## 📦 Version Management Strategy

### Dependencies Use Semver Ranges (`^`)

**Rationale:**
- ✅ **Security patches auto-apply** (e.g., `^1.56.1` → `1.56.2`)
- ✅ **Bug fixes auto-apply** (patch versions)
- ✅ **package-lock.json ensures reproducibility** (exact versions locked)
- ✅ **Less manual maintenance** for MVP sprint
- ✅ **Dependabot manages updates via PR** (not automatic merges)

**Example:**
```json
{
  "@playwright/test": "^1.56.1"  // Allows 1.56.x, blocks 1.57.0
}
```

**When NOT to use `^`:**
- Libraries published to npm (use exact versions for peer deps)
- Known breaking changes in patch versions
- Regulatory compliance requiring change control

---

## 🤖 Dependabot Configuration

**File:** `.github/dependabot.yml`

### Update Schedule
- **Frequency:** Weekly (Mondays at 9:00 AM)
- **Max PRs:** 5 (backend), 5 (frontend), 3 (actions), 2 (docker)

### Ecosystems Monitored
1. **Python/Poetry** (`/server`) - Backend dependencies
2. **npm** (`/client`) - Frontend dependencies
3. **GitHub Actions** (`/`) - CI/CD workflows
4. **Docker** (`/.github/workflows`) - Playwright container images

### PR Behavior
- **Auto-created:** Yes (weekly batch)
- **Auto-merged:** No (requires CI pass + manual review)
- **Labels:** `dependencies`, `backend`/`frontend`/`ci`/`docker`

---

## 🔒 Critical Dependencies

### Playwright Version Lock

**Problem:** Docker image must match package.json version.

**Solution:**
```yaml
# .github/workflows/e2e.yml
container:
  image: mcr.microsoft.com/playwright:v1.56.1-noble  # Must match package.json

# Automatic version verification step added (fails early on mismatch)
```

**Dependabot handles:**
- Creates PR to update `package.json` → `@playwright/test: ^1.56.2`
- Creates separate PR to update `e2e.yml` → `v1.56.2-noble`
- CI validates both changes before merge

---

## 🚦 Update Workflow

### 1. Dependabot Creates PR
```
chore(deps): bump @playwright/test from 1.56.1 to 1.56.2
```

### 2. GitHub Actions Validates
- ✅ Lint (Ruff, ESLint)
- ✅ Type-check (mypy, tsc)
- ✅ Unit tests (pytest, Vitest)
- ✅ E2E tests (Playwright)

### 3. Manual Review (Quick Check)
- Review changelog (auto-linked by Dependabot)
- Check for breaking changes
- Merge if green ✅

---

## 🛡️ Security Updates

### Automatic Alerts
Dependabot creates **high-priority PRs** for:
- Known CVEs in dependencies
- Security advisories from GitHub

### Response Protocol
1. **Critical vulnerabilities:** Review + merge within 24h
2. **Medium vulnerabilities:** Review + merge within 1 week
3. **Low vulnerabilities:** Batch with weekly updates

---

## 📊 Ignored Updates (During MVP)

### Major Version Bumps (Temporary)
```yaml
ignore:
  - dependency-name: "react"
    update-types: ["version-update:semver-major"]
  - dependency-name: "react-dom"
    update-types: ["version-update:semver-major"]
```

**Reason:** Focus on MVP delivery, defer major upgrades to post-launch.

**After MVP:** Remove ignore rules, evaluate major updates quarterly.

---

## 🔍 Local Dependency Audits

### Security Scanning
```bash
# Backend
cd server
poetry audit

# Frontend
cd client
npm audit
npm audit fix  # Apply non-breaking fixes
```

### Outdated Dependencies
```bash
# Backend
poetry show --outdated

# Frontend
npm outdated
```

---

## 🏗️ Adding New Dependencies

### Backend (Poetry)
```bash
cd server
poetry add <package>          # Production dependency
poetry add --group dev <pkg>  # Dev dependency
poetry lock --no-update       # Update lock file only
```

### Frontend (npm)
```bash
cd client
npm install <package>         # Production dependency
npm install -D <package>      # Dev dependency
```

### Constitutional Check (Article I: Simplicity)
Before adding a new dependency, ask:
1. ✅ Is it essential for P1 feature (un-deletable constraint)?
2. ✅ Can we implement it ourselves in <50 LOC?
3. ✅ Does it have active maintenance + good security track record?

**If any answer is "No" → Reject the dependency.**

---

## 🎯 Post-MVP Enhancements

### After 5-Day Sprint
1. ✅ Review all `^` ranges → Consider stricter `~` for stability
2. ✅ Remove React major version ignore rule
3. ✅ Enable Dependabot auto-merge for patch updates
4. ✅ Add Snyk or Dependabot security scanning dashboard

### Quarterly Reviews
- Evaluate major version updates (React, FastAPI, etc.)
- Remove unused dependencies
- Consolidate duplicate functionality

---

## 📚 References

- [Dependabot Docs](https://docs.github.com/en/code-security/dependabot)
- [Semver Specification](https://semver.org/)
- [npm Dependency Hell Guide](https://npm.github.io/how-npm-works-docs/)
- [Poetry Dependency Management](https://python-poetry.org/docs/dependency-specification/)

---

**Last Updated:** 2025-11-06  
**Status:** ✅ Dependabot active, version verification enabled
