# git-conflict-resolution Specification

## Purpose
Define procedures for resolving git merge conflicts discovered during automated audits or CI/CD processes.

## ADDED Requirements

### Requirement: Merge Conflict Resolution Process

The system SHALL resolve git merge conflicts using a deterministic strategy prioritizing code correctness, readability, and current project state.

**Rationale**: Merge conflicts block deployment and can introduce runtime errors if resolved incorrectly. A systematic resolution process ensures conflicts are resolved safely and consistently.

#### Scenario: Resolve Identical Content with Different Formatting

**Given** a git merge conflict exists where both sides have functionally identical content but different formatting
**And** the conflict involves HTML, CSS, or JavaScript code
**When** the conflict is resolved
**Then** the system SHALL:
- Choose the version with better readability (multiline over single-line for long attributes)
- Ensure the resolution complies with project's Prettier/ESLint configuration
- Remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
- Validate the resolved file with linters and type checkers

**Acceptance Criteria**:
- No conflict markers remain in the file
- `git diff --check` reports no issues
- Linter passes on resolved file
- Resolved content is functionally equivalent to both conflict sides

**Example**:
```html
# BEFORE (conflict)
<<<<<<< Updated upstream
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
=======
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
>>>>>>> Stashed changes

# AFTER (resolved - multiline for readability)
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
```

---

#### Scenario: Resolve Test Code Formatting Conflicts

**Given** a git merge conflict exists in test files (e.g., `*.spec.ts`, `*.test.tsx`)
**And** the conflict involves function parameter formatting or variable declarations
**When** the conflict is resolved
**Then** the system SHALL:
- Choose the version with better readability (multiline function parameters)
- Ensure the resolution matches project's test code style conventions
- Verify test syntax correctness with TypeScript compiler
- Run affected tests to ensure no runtime errors

**Acceptance Criteria**:
- Test file syntax is valid (no TypeScript errors)
- Tests execute without syntax errors
- Resolved formatting matches project conventions (Prettier)
- All conflict markers removed

**Example**:
```typescript
# BEFORE (conflict)
<<<<<<< Updated upstream
  test("should do something", async ({
    page,
  }) => {
=======
  test("should do something", async ({ page }) => {
>>>>>>> Stashed changes

# AFTER (resolved - multiline for readability)
  test("should do something", async ({
    page,
  }) => {
```

---

#### Scenario: Resolve Documentation Conflicts with Outdated Information

**Given** a git merge conflict exists in documentation files (e.g., `COMPLETION.md`, `README.md`)
**And** one side has outdated information (e.g., "tests deferred due to build issue")
**And** the other side has current information (e.g., "tests executed and passed")
**When** the conflict is resolved
**Then** the system SHALL:
- Choose the version with **current, accurate information**
- Discard outdated status (e.g., references to resolved bugs)
- Preserve detailed results over vague placeholders
- Ensure documentation reflects current project state

**Acceptance Criteria**:
- Resolved documentation is factually accurate
- No references to resolved issues remain (e.g., "rollup dependency issue")
- Detailed test results preserved over generic status
- Markdown syntax is valid

**Example**:
```markdown
# BEFORE (conflict)
<<<<<<< Updated upstream
✅ 8/9 E2E tests PASSED
✅ 146/165 unit tests PASSED
=======
⚠️ Tests deferred (rollup dependency issue)
>>>>>>> Stashed changes

# AFTER (resolved - keep current detailed results)
✅ 8/9 E2E tests PASSED
✅ 146/165 unit tests PASSED
```

---

### Requirement: Post-Resolution Validation

The system SHALL validate all resolved merge conflicts using automated quality gates before committing changes.

**Rationale**: Prevents introducing broken code or test failures after conflict resolution.

#### Scenario: Validate Resolved Files with Quality Gates

**Given** all merge conflicts have been resolved
**When** validation is performed
**Then** the system SHALL run the following checks:
- `git status` to confirm no "Unmerged paths" remain
- `git diff --check` to detect whitespace issues or leftover conflict markers
- ESLint on all modified files
- TypeScript type-check (`tsc --noEmit`) on TypeScript files
- Prettier format check on all modified files
- Application build test (`npm run dev` starts successfully)

**Acceptance Criteria**:
- All quality gates pass (exit code 0)
- `git status` shows "All conflicts fixed" or no unmerged paths
- Application runs without errors
- No lint, type-check, or format errors

**Example Validation Commands**:
```bash
git status                        # Should show no unmerged paths
git diff --check                  # Should report no issues
npm run lint                      # ESLint passes
npm run type-check                # TypeScript passes
npm run format                    # Prettier passes
npm run dev                       # App starts successfully
```

---
