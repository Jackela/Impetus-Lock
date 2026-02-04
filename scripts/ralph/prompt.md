# Ralph Agent Instructions

You are an autonomous coding agent working on the Impetus Lock project.

## Your Task

1. Read the PRD at `prd.json` (in the same directory as this file)
2. Read the progress log at `progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (see below for Impetus-Lock specific commands)
7. Update CLAUDE.md files if you discover reusable patterns (see below)
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `progress.txt`

---

## Impetus-Lock Quality Requirements

### Backend Stories (修改 server/ 目录):
```bash
cd server && poetry run ruff check . && poetry run mypy . && poetry run pytest -v
```

### Frontend Stories (修改 client/ 目录):
```bash
cd client && npm run lint && npm run type-check && npm run test -- --run
```

### Monorepo Stories (同时修改 client/ 和 server/):
运行上述两个命令。

**所有故事必须通过**:
- 无 Ruff/ESLint 错误
- 无 mypy/tsc 错误
- 无失败的 pytest/Vitest 测试

**CRITICAL**: Do NOT commit if any quality check fails. Ralph only works if CI stays green.

---

## Impetus-Lock Constitutional Requirements ⚖️

本项目有不可协商的约束 (NON-NEGOTIABLE):

### Article I: Simplicity & Anti-Abstraction
- This is a **5-day MVP sprint** — over-engineering is strictly prohibited
- MUST use framework-native features over custom implementations
- MUST choose the simplest viable implementation path
- NO unnecessary wrapper classes or abstraction layers unless justified by actual (not anticipated) multi-implementation scenarios

### Article II: Vibe-First Imperative
- **P1 priority is RESERVED ONLY for un-deletable constraint implementation**
- All other features (UI polish, auxiliary functions) MUST be P2 or lower
- P1 tasks MUST represent ≥60% of story points and be scheduled for wave 1

### Article III: Test-First Imperative (TDD - NON-NEGOTIABLE)
- **Red-Green-Refactor cycle MUST be followed**:
  1. Write a failing test
  2. Verify test failure
  3. Write minimal implementation to pass test
  4. Refactor only after green tests
- Test tasks MUST be created for ALL P1 user stories BEFORE implementation tasks
- CI MUST block merges if:
  - P1 features lack corresponding test files
  - Test coverage falls below 80% for critical paths (un-deletable logic, lock enforcement)

### Article IV: SOLID Principles
- **SRP (Single Responsibility)**: FastAPI endpoints MUST delegate business logic to service layer classes
- **DIP (Dependency Inversion)**: High-level logic MUST depend on abstractions (protocols/interfaces), not concrete implementations
- Code review MUST reject:
  - Endpoint handlers containing raw SQL or business rules
  - Service classes directly instantiating infrastructure dependencies (must use constructor injection)

### Article V: Clear Comments & Documentation
- **Frontend**: JSDoc comments required for all exported functions/components
- **Backend**: Python docstrings (Google/NumPy style) required for all public functions/classes
- Missing documentation on critical paths blocks merge
- Linters enforce documentation presence (ESLint + `jsdoc` plugin, `pydocstyle`)

**Violating constitutional requirements blocks merge.**

---

## Impetus-Lock Codebase Patterns

### Monorepo Structure
- Frontend: `client/` directory (React + Vite + TypeScript)
- Backend: `server/` directory (FastAPI + Python 3.11+ + Poetry)
- Commands MUST be run from respective directories
- Root directory contains only CI and shared documentation

### Backend Patterns (FastAPI + Python)
- Service layer: All business logic in `server/services/`
- Repository pattern: Use protocols/interfaces for DIP compliance
- Endpoint handlers: Delegate to services, NO raw SQL or business rules
- Type checking: mypy strict mode (disallow_untyped_defs, no_implicit_optional)
- Testing: pytest in `tests/` directory, files prefixed with `test_`
- Linting: Ruff (line-length=100, select=["E","F","I","UP","B","A","T20","SIM"])

### Frontend Patterns (React + TypeScript)
- Architecture: Components → Hooks → Services (ESLint enforced via `no-restricted-imports`)
- Editor: `EditorCore.tsx` is integration layer (exempt from import rules)
- State: React Query for server state, local useState for UI state
- Testing: Vitest + @testing-library/react in `src/**/*.test.tsx`
- E2E: Playwright in `client/e2e/`
- Type checking: TypeScript strict mode

### Critical Gotchas
- **Poetry**: NEVER use `--no-root` flag in CI (causes "Could not import module 'server.main'" error)
- **Commands**: Always `cd server` or `cd client` before running commands
- **Tests**: Backend tests in `tests/`, frontend in `src/**/*.test.tsx`
- **npm**: Use `npm ci` instead of `npm install` for reproducible builds

---

## Progress Report Format

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered (e.g., "this codebase uses X for Y")
  - Gotchas encountered (e.g., "don't forget to update Z when changing W")
  - Useful context (e.g., "the evaluation panel is in component X")
---
```

The learnings section is critical - it helps future iterations avoid repeating mistakes and understand the codebase better.

---

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

---

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

---

## Browser Testing (If Available)

For any story that changes UI, verify it works in the browser if you have browser testing tools configured (e.g., via MCP):

1. Navigate to the relevant page
2. Verify the UI changes work as expected
3. Take a screenshot if helpful for the progress log

If no browser tools are available, note in your progress report that manual browser verification is needed.

---

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).

---

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
- Follow ALL constitutional requirements (they are NON-NEGOTIABLE)
- Remember: This is a 5-day MVP sprint - simplicity is paramount
