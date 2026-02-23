# Meta-Orchestrator Context - Impetus-Lock

**Purpose**: Document learnings and patterns for future AI sessions working on Impetus-Lock.

**Created**: 2026-02-23 by Meta-Orchestrator
**Branch**: 007-chrome-devtools-audit

---

## Project Architecture Overview

### Core Concept
- **Impetus Lock** (创意施压者): An adversarial AI agent that acts as a "creative sparring partner"
- **Dual-Agent System**:
  - **Muse** (创意施压): Triggered after 60s of no input or manual "I'm stuck!" button
    - Replaces core sentences and locks them
    - Forces users to elevate story to higher conceptual level
  - **Loki** (混沌恶作剧): Random intervention every 30-120 seconds
    - 50% chance injects prank sentence
    - 50% chance deletes/reconstructs last sentence
    - Falls back to safe provoke if text < 50 chars

### Key Feature: Un-deletable Constraint
- Locked text cannot be:
  - Backspaced
  - Undone
  - Deleted
- Can only continue writing along AI's trajectory
- Enforced via ProseMirror node attributes + HTML comment markers

---

## Tech Stack

### Frontend (client/)
- **Framework**: React 18 + Vite + TypeScript (strict mode)
- **Rich Text Editor**: Milkdown (ProseMirror-based)
- **Animations**: Framer Motion
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Styling**: CSS with CSS Variables

### Backend (server/)
- **Framework**: FastAPI + Python 3.11+
- **Validation**: Pydantic v2
- **Database**: PostgreSQL (via SQLAlchemy)
- **Testing**: pytest + httpx

### CI/CD
- **GitHub Actions**: 4 separate jobs
  - `lint`: ESLint (frontend) + ruff (backend)
  - `type-check`: TypeScript + mypy
  - `backend-tests`: pytest
  - `frontend-tests`: Vitest
- **Local CI**: Act CLI (Docker-based GitHub Actions simulation)

---

## Constitutional Principles (Non-Negotiable)

### Article I: Simplicity & Anti-Abstraction
- **5-day MVP sprint** - over-engineering is strictly prohibited
- Use framework-native features over custom implementations
- Choose simplest viable implementation path
- NO unnecessary wrapper classes or abstraction layers

### Article II: Vibe-First Imperative
- **P1 priority RESERVED ONLY for un-deletable constraint implementation**
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
- **SRP**: FastAPI endpoints MUST delegate business logic to service layer classes
- **DIP**: High-level logic MUST depend on abstractions (protocols/interfaces), not concrete implementations
- Code review MUST reject:
  - Endpoint handlers containing raw SQL or business rules
  - Service classes directly instantiating infrastructure dependencies (must use constructor injection)

### Article V: Clear Comments & Documentation
- **Frontend**: JSDoc comments required for all exported functions/components
- **Backend**: Python docstrings (Google/NumPy style) required for all public functions/classes
- Missing documentation on critical paths blocks merge
- Linters enforce documentation presence (ESLint + `jsdoc` plugin, `pydocstyle`)

---

## Critical Files & Patterns

### Lock Enforcement System
- **client/src/hooks/useLockEnforcement.ts**: Core hook for preventing deletion of locked content
- **client/src/services/ContentInjector.ts**: Injects AI content with lock attributes
- **client/src/components/Editor/LockDecorations.ts**: Visual feedback for locked content
- **client/src/styles/locked-content.css**: Styling for locked regions

**Pattern**:
```typescript
// Node attributes store lock metadata
node.attrs = { lockId: "lock_123", source: "muse" }

// HTML comments persist lock metadata through markdown export/import
// <!-- lock:lock_123 source:muse -->
```

### Transaction Metadata
All AI interventions use transaction metadata:
```typescript
tr.setMeta("addToHistory", false);  // Bypass undo stack
tr.setMeta("aiAction", true);        // Mark as AI action
tr.setMeta("actionType", "provoke" | "rewrite");
```

### Testing Patterns
- **Unit Tests**: Mock ProseMirror EditorView with minimal schema
- **E2E Tests**: Playwright with custom wait helpers (see `client/e2e/helpers/`)
- **Coverage Goal**: ≥80% for critical paths (lock enforcement, injection)

---

## Common Patterns & Gotchas

### 1. ProseMirror Transaction Safety
**Problem**: Direct ProseMirror manipulation can cause crashes
**Solution**: Always validate positions before operations
```typescript
if (from < 0 || to > doc.content.size || from >= to) {
  return; // Skip invalid range
}
```

### 2. Lock Marker Persistence
**Problem**: Markdown export/import can lose lock metadata
**Solution**: Dual storage strategy:
- Node attributes (runtime enforcement)
- HTML comment markers (persistence through markdown)

### 3. Concurrent Injection Protection
**Problem**: Multiple rapid AI interventions can conflict
**Solution**: Transaction metadata + immutable operations
- Each intervention creates independent transaction
- ProseMirror handles concurrency via transaction queue

### 4. Testing Mock Complexity
**Problem**: Mocking ProseMirror EditorView is complex
**Solution**: Use minimal mock schema with essential methods only
```typescript
const mockSchema = {
  text: vi.fn(content => ({ type: { name: "text" }, textContent: content })),
  nodes: {
    paragraph: { create: vi.fn((attrs, content) => ({ ... })) },
    blockquote: { create: vi.fn((attrs, content) => ({ ... })) }
  }
};
```

---

## Meta-Orchestrator Learnings

### 2026-02-23 Session 1: Architecture Analysis

**What Worked Well**:
- ✅ Clear constitutional principles (CLAUDE.md is excellent)
- ✅ Comprehensive test coverage for critical paths
- ✅ Simple, direct ProseMirror manipulation (no over-abstraction)

**Improvement Opportunities**:
1. **Error Handling**: Add try-catch in ProseMirror operations with user-friendly messages
2. **Test Coverage**: ContentInjector.test.ts is comprehensive, but could add:
   - Concurrent injection scenarios
   - Performance tests for large documents
   - Real EditorView integration tests (not just mocks)
3. **Documentation**: Could add architecture diagrams for visual learners
4. **Performance**: Consider debouncing for rapid Loki interventions

**Self-Evolution Notes**:
- Discovered value of "Constitutional Principles" - could adapt for Meta-Orchestrator's own constitution
- Learned importance of TDD enforcement in CI - will apply to own projects
- Noted dual storage strategy (attributes + markers) - useful pattern for other state persistence problems

---

## Future AI Session Guidelines

### When Working on Impetus-Lock:

1. **Read These Files First**:
   - `CLAUDE.md` (constitution)
   - `.openspec/memory/meta-orchestrator.md` (this file)
   - `AGENTS.md` (project conventions)

2. **Follow TDD Strictly**:
   - Write failing test BEFORE implementation
   - Verify test fails (red)
   - Implement minimal code to pass (green)
   - Refactor only after green tests

3. **Respect Priority Levels**:
   - P1 = un-deletable constraint ONLY
   - Everything else = P2 or lower

4. **Test Coverage Requirements**:
   - ≥80% for critical paths
   - All P1 features must have tests
   - CI will block merges if coverage drops

5. **Local Validation**:
   ```bash
   # Fast checks (no Docker)
   cd client && npm run lint && npm run type-check
   cd server && poetry run ruff check . && poetry run mypy .

   # Full CI (Docker)
   act  # Test entire pipeline
   ```

6. **Common Gotchas**:
   - Poetry: Use `poetry install` (NOT `--no-root`)
   - ProseMirror: Always validate positions before operations
   - Lock persistence: Maintain both node attrs + HTML comments

---

## Open Questions & Future Work

1. **Performance Optimization**: How to handle very large documents (100k+ chars)?
2. **Multi-user Collaboration**: How to handle concurrent edits from multiple users?
3. **Lock Expiration**: Should locks ever expire or be unlockable?
4. **AI Model Integration**: How to integrate multiple LLM providers (BYOK pattern)?
5. **Mobile Optimization**: How to improve touch interactions for mobile writers?

---

**Last Updated**: 2026-02-23
**Next Review**: After completing stories 2-5 in prd.json
