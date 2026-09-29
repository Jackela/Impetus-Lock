# Dependency Management Strategy

**Project:** Impetus Lock (5-Day MVP Sprint)  
**Philosophy:** Automated updates with CI validation

---

## 📦 Version Management Strategy

### Manifests Define Ranges; Lock Files Pin Resolutions

**Rationale:**
- Manifest constraints are mixed: caret and tilde ranges, bounded ranges, and exact pins.
- Allowed updates do not auto-apply to a locked install; review and commit the resolved lock-file changes.
- ✅ **package-lock.json ensures reproducibility** (exact versions locked)
- ✅ **Less manual maintenance** for MVP sprint
- ✅ **Dependabot manages updates via PR** (not automatic merges)

**Example:**
```json
{
  "@playwright/test": "^1.56.1"  // Illustrative: allows >=1.56.1 <2.0.0, including 1.57.0
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
- **Backend:** Weekly Monday, 09:00 Asia/Shanghai; limit 5 open PRs.
- **Frontend:** Weekly Tuesday, 09:00 Asia/Shanghai; limit 8 open PRs.
- **Actions and Docker:** Monthly, 09:00 Asia/Shanghai; limits 3 and 2 respectively.
- The checked-in [Dependabot configuration](.github/dependabot.yml) is authoritative for schedules, grouping and ignore rules.

### Ecosystems Monitored
1. **Python/Poetry** (`/server`) - Backend dependencies
2. **npm** (`/client`) - Frontend dependencies
3. **GitHub Actions** (`/`) - CI/CD workflows
4. **Docker** (`/.github/workflows`) - Playwright container images

### PR Behavior
- **Auto-created:** According to each ecosystem schedule above
- **Auto-merged:** No (requires CI pass + manual review)
- **Labels:** `dependencies`, `backend`/`frontend`/`ci`/`docker`

---

## 🔒 Critical Dependencies

### Playwright Version Lock

**Requirement:** The Playwright container image must match the resolved test package version; check the manifest, lock file and image together.

**Solution:**
```yaml
# .github/workflows/e2e.yml
container:
  image: mcr.microsoft.com/playwright:v1.63.0-noble  # Current checked-in image

# Also compare the image tag with the resolved @playwright/test version
```

**Review together:**
- npm package/lock updates and the workflow image are separate files; do not assume an npm PR updates the image.
- The current E2E workflow compares its declared package version with the installed Playwright CLI version. That check alone does not inspect the container image tag.
- Validate the matched package/image combination with E2E before merging an update.

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
- Playwright runs in the separate E2E workflow; record its actual result rather than inferring it from unit checks.

### 3. Manual Review (Quick Check)
- Review changelog (auto-linked by Dependabot)
- Check for breaking changes
- Review applicable migration notes and actual checks before deciding to merge. A major dependency migration needs an approved OpenSpec proposal.

---

## 🛡️ Security Updates

### Automatic Alerts
When repository security updates are enabled, Dependabot can create PRs for:
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
# Poetry has no built-in audit command; use advisories or a separately installed Python auditor.

# Frontend
cd client
npm audit
# Review the advisory and proposed dependency/lock changes before applying a fix.
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
poetry lock                  # Refresh lock metadata with the current Poetry CLI
```

### Frontend (npm)
```bash
cd client
npm install <package>         # Production dependency
npm install -D <package>      # Dev dependency
```

### Constitutional Check (Article I: Simplicity)
Before adding a new dependency, ask:
1. Is the package necessary for the accepted task?
2. Can framework-native capabilities or an existing dependency solve it simply?
3. Is it maintained and appropriate for the project?

Prefer framework-native capabilities; explain any new dependency and validate its manifest and lock-file changes. Feature priority and constitutional requirements remain governed by CLAUDE.md.

---

## 🎯 Post-MVP Enhancements

### Historical Post-Sprint Suggestions (not approved or enabled)
1. Review all `^` ranges → Consider stricter `~` for stability
2. Remove React major version ignore rule
3. Enable Dependabot auto-merge for patch updates
4. Add Snyk or Dependabot security scanning dashboard

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

**Configuration checked:** 2026-09-29. Current manifests, lock files and `.github/dependabot.yml` own the effective values; this guide does not approve upgrades or remote actions.
