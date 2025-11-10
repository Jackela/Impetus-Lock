# OpenSpec Proposal: resolve-merge-conflicts

## Why

The automated Chrome DevTools audit (change `execute-devtools-audit`) discovered **3 critical git merge conflicts** blocking deployment:

1. **client/index.html** (lines 6-13): Duplicate viewport meta tag with merge markers
2. **client/e2e/responsive.spec.ts** (multiple locations): Formatting conflicts in test code
3. **specs/006-responsive-design/COMPLETION.md** (lines 444+): Conflicting test status sections

**Impact**:
- 🚨 **BLOCKS DEPLOYMENT**: Code cannot ship with merge conflict markers
- ⚠️ **CI Risk**: May cause linting/parsing failures
- 📱 **Mobile Accessibility Risk**: Duplicate meta tags may cause viewport inconsistencies
- 🧪 **Test Execution Blocked**: E2E tests cannot run with syntax errors

**Root Cause**: Incomplete merge between Feature 006 (responsive-design) and current branch (007-chrome-devtools-audit).

**User Request**: "Fix the issues exposed by the previous work" (audit findings)

## What Changes

This change resolves all 3 merge conflicts using the following strategy:

### 1. client/index.html (CRITICAL - Deployment Blocker)
**Conflict**: Identical viewport meta tag, different formatting (multiline vs single-line)
**Resolution**: Keep **multiline format** (lines 7-10 from "Updated upstream")
**Rationale**: Better readability for long attribute lists, consistent with HTML formatting standards

### 2. client/e2e/responsive.spec.ts (HIGH - Test Execution)
**Conflicts**:
- Function parameter formatting (lines 52-58)
- Variable declaration formatting (lines 60-66)
- Comment wording (lines 92-100)

**Resolution**: Keep **"Updated upstream"** version (multiline formatting)
**Rationale**:
- More readable test code (multiline function params)
- Preserves detailed browser scaling comment (lines 95-97)
- Consistent with project's Prettier configuration

### 3. specs/006-responsive-design/COMPLETION.md (MEDIUM - Documentation)
**Conflict**: Test status section content differs
- "Updated upstream": Detailed test results (8/9 E2E, 146/165 unit)
- "Stashed changes": Deferred status (rollup dependency issue)

**Resolution**: Keep **"Updated upstream"** (detailed test results)
**Rationale**:
- Rollup issue was fixed during audit execution
- Tests have since been executed and passed
- Updated version reflects current reality

## Specs Affected

**New Capability**: `git-conflict-resolution` (merge conflict resolution procedures)

**Delta Summary**:
- **ADDED**: 1 requirement (Merge Conflict Resolution Process)
- **MODIFIED**: 0 requirements
- **REMOVED**: 0 requirements

## Success Criteria

- ✅ All 3 merge conflicts resolved (no conflict markers remain)
- ✅ `git status` shows no "Unmerged paths"
- ✅ `git diff --check` returns no errors (no whitespace/conflict issues)
- ✅ ESLint passes on all modified files
- ✅ TypeScript type-check passes
- ✅ Prettier formatting check passes
- ✅ Application builds and runs successfully (`npm run dev`)
- ✅ E2E tests execute without syntax errors

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Choosing wrong conflict side** | Both sides have identical content (viewport tag) or updated version is functionally correct (tests) |
| **Breaking tests** | Run `npm run test:e2e` after resolution to verify syntax correctness |
| **Whitespace issues** | Use `git diff --check` to detect trailing whitespace or CRLF issues |
| **Losing important changes** | Review diff before committing; both versions documented in audit reports |

## Timeline Estimate

**Total**: 15 minutes

- Resolution: 10 minutes (3 files × 3-4 minutes each)
- Validation: 5 minutes (lint, type-check, format, git status)

## Dependencies

**Depends On**:
- Change `execute-devtools-audit` (archived 2025-11-09) - discovered these issues

**Blocks**:
- Deployment to production
- Creating pull request from branch `007-chrome-devtools-audit`
- Further development on branch (conflicts must be resolved first)
