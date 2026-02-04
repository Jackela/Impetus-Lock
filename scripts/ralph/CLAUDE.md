# Ralph Agent Instructions - Impetus Lock

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

**CRITICAL**: Do NOT commit if any quality check fails.

---

## Impetus-Lock Constitutional Requirements ⚖️

### Article I: Simplicity & Anti-Abstraction
- This is a **5-day MVP sprint** — over-engineering is strictly prohibited
- MUST use framework-native features over custom implementations
- NO unnecessary wrapper classes or abstraction layers

### Article II: Vibe-First Imperative
- **P1 priority is RESERVED ONLY for un-deletable constraint implementation**
- All other features (UI polish, auxiliary functions) MUST be P2 or lower

### Article III: Test-First Imperative (TDD - NON-NEGOTIABLE)
- **Red-Green-Refactor cycle MUST be followed**: Write failing test → Verify failure → Implement → Refactor
- CI MUST block merges if P1 features lack tests or coverage < 80% for critical paths

### Article IV: SOLID Principles
- **SRP**: FastAPI endpoints MUST delegate business logic to service layer classes
- **DIP**: High-level logic MUST depend on abstractions (protocols/interfaces)

### Article V: Clear Comments & Documentation
- **Frontend**: JSDoc comments required for all exported functions/components
- **Backend**: Python docstrings (Google/NumPy style) required for all public functions/classes

---

## Codebase Patterns

### Monorepo Structure
- Frontend: `client/` (React + Vite + TypeScript)
- Backend: `server/` (FastAPI + Python 3.11+ + Poetry)
- Commands MUST be run from respective directories

### Backend Patterns
- Service layer: `server/services/`
- Repository pattern: Use protocols/interfaces for DIP compliance
- Type checking: mypy strict mode
- Testing: pytest in `tests/`
- Linting: Ruff (line-length=100)

### Frontend Patterns
- Architecture: Components → Hooks → Services (ESLint enforced)
- Editor: `EditorCore.tsx` is integration layer (exempt from import rules)
- State: React Query (@tanstack/react-query) for server state, native hooks for UI state
- Testing: Vitest + @testing-library/react (use QueryClient wrapper for React Query tests)
- E2E: Playwright in `client/e2e/`

### Critical Gotchas
- **Poetry**: NEVER use `--no-root` flag in CI
- **Commands**: Always `cd server` or `cd client` before running commands
- **npm**: Use `npm ci` instead of `npm install`
- **React Query tests**: Use `QueryClient` wrapper in test setup for hooks that use useQuery/useMutation

---

## Progress Report Format

APPEND to progress.txt (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

---

## Consolidate Patterns

If you discover a **reusable pattern**, add it to the `## Codebase Patterns` section at the TOP of progress.txt:
```
## Codebase Patterns
- Example pattern here
```

---

## Update CLAUDE.md Files

Before committing, check if edited files have learnings worth preserving in nearby CLAUDE.md files:
- API patterns or conventions
- Gotchas or non-obvious requirements
- Dependencies between files
- Testing approaches

Only update CLAUDE.md if you have **genuinely reusable knowledge**.

---

## Browser Testing

For UI stories, verify in the browser if tools are available (e.g., via MCP):
1. Navigate to the relevant page
2. Verify the UI changes work
3. Take screenshot if helpful

If no browser tools, note manual verification is needed.

---

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally.

---

## Important

- Work on ONE story per iteration
- Commit frequently
- Keep CI green
- Read the Codebase Patterns section in progress.txt before starting
