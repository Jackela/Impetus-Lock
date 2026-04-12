# Implementation Plan: Markdown Toolbar (P4 - Foundational)

**Branch**: `005-markdown-toolbar` | **Date**: 2025-11-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-markdown-toolbar/spec.md`

## Summary

Add a context-sensitive floating toolbar for basic Markdown formatting (Bold, Italic, H1, H2, Bullet List). Toolbar appears only when text is selected, positioned near the selection using Floating UI. Leverages Milkdown v7.17.1's built-in formatting commands and ProseMirror state management. Must integrate seamlessly with existing P1-P3 lock enforcement system.

**Primary Requirement**: Enable basic WYSIWYG formatting so the editor becomes "truly usable" for creative writing while maintaining minimalist "Zen mode" aesthetic.

**Technical Approach** (from research.md):
- React component-based toolbar (no custom Milkdown plugin)
- ProseMirror transaction interception for selection detection
- Floating UI for intelligent positioning
- `callCommand` utility for command execution
- `hasMark` helper for active state tracking

---

## Technical Context

**Language/Version**: TypeScript 5.7.x (React 19.x, strict mode)  
**Primary Dependencies**:
- **Milkdown**: `@milkdown/core@7.17.1`, `@milkdown/preset-commonmark@7.17.1`, `@milkdown/react@7.17.1`
- **ProseMirror**: `@milkdown/prose@7.17.1` (wrapper for ProseMirror state/view)
- **Floating UI**: `@floating-ui/dom` (included with Milkdown v7)
- **React**: `react@19.x`, `react-dom@19.x`

**Storage**: N/A (no persistent data - UI state only)  
**Testing**: Vitest + @testing-library/react (unit tests), Playwright (E2E tests)  
**Target Platform**: Web (Chrome, Firefox, Safari - desktop + mobile)

**Project Type**: Web application (monorepo: `client/` frontend, `server/` backend)  

**Performance Goals**:
- <100ms delay from button click to formatting applied (SC-005)
- <2 seconds from selection to formatting applied (SC-001)
- No editor performance degradation

**Constraints**:
- Must respect P1-P3 lock enforcement system (FR-019, FR-020)
- Must maintain "Zen mode" minimalist aesthetic (FR-024, FR-025)
- Toolbar hidden when no text selected (FR-026a)
- Touch targets ≥44x44px for mobile (FR-027)

**Scale/Scope**:
- 5 toolbar buttons (Bold, Italic, H1, H2, Bullet List)
- 1 React component (~200-300 LOC)
- Integration with existing EditorCore.tsx (~50 LOC changes)
- ~150-200 LOC for tests

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Simplicity & Anti-Abstraction

- [x] Framework-native features prioritized over custom implementations  
  *Uses Milkdown's built-in `callCommand` and ProseMirror APIs - no custom plugin layer*
- [x] Simplest viable implementation path chosen  
  *React component approach is simpler than custom Milkdown plugin*
- [x] No unnecessary wrapper classes or abstraction layers  
  *Direct integration with ProseMirror state - no repository pattern or service layer*
- [x] Any abstractions justified by actual (not anticipated) multi-implementation scenarios  
  *No abstractions - single toolbar implementation*

**Violations**: None

---

### Article II: Vibe-First Imperative

- [x] Un-deletable constraint is P1 priority (only this feature is P1)  
  *This is P4 feature - all user stories marked P2/P3 (foundational usability, not core Vibe)*
- [x] All other features (UI polish, auxiliary functions) marked P2 or lower  
  *US1-US3 are P2 (formatting functionality), US4 is P3 (visual design polish)*
- [x] P1 tasks scheduled for wave 1 implementation  
  *N/A - no P1 tasks in this feature (P1 is reserved for lock enforcement from P1-P3)*
- [x] P1 tasks represent ≥60% of story points  
  *N/A - this feature has no P1 tasks*

**Note**: This is P4 (Foundational) feature - provides essential usability but is NOT core "Vibe" functionality. Correctly prioritized as P2/P3.

**Violations**: None

---

### Article III: Test-First Imperative (NON-NEGOTIABLE)

- [x] Test tasks created for ALL P1 user stories BEFORE implementation tasks  
  *N/A - no P1 tasks in this feature*
- [x] TDD workflow enforced: failing test → verify failure → minimal implementation → refactor  
  *To be enforced during implementation phase*
- [ ] Test coverage ≥80% for critical paths (un-deletable logic, lock enforcement)  
  *Will be measured during implementation - toolbar is not critical path (P2/P3 feature)*
- [x] P1 features have corresponding test files  
  *N/A - no P1 features in this spec*

**Test Strategy** (TDD required):
1. Write failing test for toolbar visibility on selection
2. Write failing test for command execution (bold, italic, heading, list)
3. Write failing test for active state tracking
4. Write failing test for lock enforcement integration
5. Write failing test for basic positioning

**Violations**: None (test coverage threshold applies to P1 features only)

---

### Article IV: SOLID Principles

- [x] **SRP**: FastAPI endpoints delegate business logic to service layer classes  
  *N/A - no backend changes required (frontend-only feature)*
- [x] **DIP**: High-level logic depends on abstractions (protocols/interfaces), not concrete implementations  
  *FloatingToolbar depends on Editor interface (Milkdown abstraction), not concrete implementation*
- [x] No endpoint handlers contain raw SQL or business rules  
  *N/A - no backend endpoints*
- [x] Service classes use constructor injection (no direct instantiation of infrastructure dependencies)  
  *N/A - no service layer (frontend component)*

**Frontend SOLID Compliance**:
- **SRP**: FloatingToolbar component has single responsibility (toolbar UI/logic)
- **DIP**: Depends on `Editor` abstraction from `@milkdown/core`, not concrete editor instance

**Violations**: None

---

### Article V: Clear Comments & Documentation

- [x] **Frontend**: JSDoc comments for all exported functions/components  
  *Required for FloatingToolbar component and helper functions*
- [ ] **Backend**: Python docstrings (Google/NumPy style) for all public functions/classes  
  *N/A - no backend changes*
- [x] Documentation present for all public interfaces  
  *Required: FloatingToolbar props interface, hasMark helper function*
- [x] Missing documentation flagged as blocking if on critical path  
  *ESLint with jsdoc plugin enforces documentation*

**Documentation Requirements**:
- `FloatingToolbar` component: JSDoc with props description
- `hasMark` helper: JSDoc with parameters and return type
- Command handlers: JSDoc for each formatting function
- Integration example in EditorCore.tsx

**Violations**: None (to be enforced during implementation)

---

## Constitution Check: Phase 1 Re-Evaluation

**Status**: COMPLETE ✅

**Pre-Design Assessment**:
- ✅ All Article I gates pass (simplicity maintained)
- ✅ All Article II gates pass (P2/P3 prioritization correct)
- ✅ TDD strategy defined (Article III)
- ✅ SOLID principles apply to frontend component (Article IV)
- ✅ Documentation requirements clear (Article V)

**Post-Design Assessment** (Phase 1 Complete):
- ✅ **Article I (Simplicity)**: Data model confirms UI-only state (no abstractions, no persistence layer)
- ✅ **Article II (Vibe-First)**: All user stories correctly marked P2/P3 (foundational, not core Vibe)
- ✅ **Article III (Test-First)**: Quickstart guide enforces TDD Red-Green-Refactor workflow
- ✅ **Article IV (SOLID)**: Component interfaces follow SRP (single toolbar responsibility) and DIP (depends on Editor abstraction)
- ✅ **Article V (Documentation)**: All TypeScript interfaces have JSDoc comments, quickstart provides comprehensive guide

**Final Verdict**: NO CONSTITUTIONAL VIOLATIONS - Ready for Phase 2 (Tasks)

---

## Project Structure

### Documentation (this feature)

```text
specs/005-markdown-toolbar/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (in progress)
├── research.md          # Phase 0 output (completed)
├── data-model.md        # Phase 1 output (next)
├── quickstart.md        # Phase 1 output (next)
├── contracts/           # Phase 1 output (next - component interfaces)
│   └── FloatingToolbar.interface.ts  # TypeScript interface definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
client/                                    # Frontend React application
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── EditorCore.tsx          # MODIFIED: Expose editor instance
│   │   │   ├── FloatingToolbar.tsx     # NEW: Toolbar component
│   │   │   └── FloatingToolbar.test.tsx # NEW: Unit tests
│   │   └── ...
│   ├── hooks/
│   │   └── useFloatingToolbar.ts       # NEW: Selection tracking hook (if extracted)
│   └── utils/
│       └── prosemirror-helpers.ts      # NEW: hasMark helper function
└── e2e/
    └── markdown-toolbar.spec.ts        # NEW: E2E tests

server/                                    # Backend (NO CHANGES)
└── (no modifications required)
```

**Structure Decision**: Web application (monorepo with `client/` and `server/`). This feature is **frontend-only** - no backend modifications required. All implementation occurs in `client/src/components/Editor/` directory.

**Key Files**:
- **NEW**: `FloatingToolbar.tsx` - Main toolbar component
- **NEW**: `FloatingToolbar.test.tsx` - Unit tests for toolbar
- **NEW**: `prosemirror-helpers.ts` - Reusable ProseMirror utilities (hasMark, etc.)
- **NEW**: `markdown-toolbar.spec.ts` - E2E tests for toolbar functionality
- **MODIFIED**: `EditorCore.tsx` - Expose editor instance to FloatingToolbar

---

## Complexity Tracking

**No constitutional violations** - this section is empty.

All gates pass:
- ✅ Article I: Framework-native approach (Milkdown commands + ProseMirror)
- ✅ Article II: P2/P3 prioritization (not core Vibe)
- ✅ Article III: TDD strategy defined
- ✅ Article IV: SOLID compliance (SRP, DIP)
- ✅ Article V: Documentation requirements clear

---

## Phase 0: Research (COMPLETE)

**Output**: [research.md](./research.md)

**Key Findings**:
1. **Milkdown v7.17.1** provides all necessary commands via `@milkdown/preset-commonmark`
2. **React component approach** is simpler than custom plugin (aligns with Article I)
3. **ProseMirror transaction interception** pattern already exists in EditorCore.tsx
4. **Floating UI** library already available (included with Milkdown)
5. **`onMouseDown` + `preventDefault()`** required to preserve selection when clicking buttons
6. **Lock enforcement** should work automatically through existing transaction filtering

**Research Tasks Completed**:
- [x] Milkdown plugin system and command execution patterns
- [x] Selection detection via ProseMirror transactions
- [x] Active state tracking with `hasMark` helper
- [x] Floating positioning with Floating UI
- [x] Integration points in existing EditorCore.tsx
- [x] Constitutional compliance assessment

---

## Phase 1: Design & Contracts (IN PROGRESS)

### Data Model (next step)

**File**: `data-model.md`

**Content**: Define TypeScript interfaces for toolbar state and component props.

**Entities**:
1. **ToolbarState**: Active/inactive state for each button
2. **FloatingToolbarProps**: Component props interface
3. **FormattingCommand**: Type definition for command handlers

**No persistent data** - all state is UI-only (React component state).

---

### API Contracts (next step)

**Directory**: `contracts/`

**Files**:
- `FloatingToolbar.interface.ts`: TypeScript interface definitions
- `prosemirror-helpers.interface.ts`: Helper function type definitions

**No REST/GraphQL API** - this is a frontend-only feature.

**Component Contracts**:
- FloatingToolbar props interface
- Command handler function signatures
- ProseMirror helper function types

---

### Quickstart Guide (next step)

**File**: `quickstart.md`

**Content**: Developer guide for implementing and testing the floating toolbar.

**Sections**:
1. Prerequisites (Milkdown knowledge, ProseMirror basics)
2. Development setup (local dev server)
3. Implementation steps (TDD workflow)
4. Testing guide (unit + E2E)
5. Integration checklist (EditorCore.tsx modifications)

---

### Agent Context Update (next step)

**Command**: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`

**Updates**:
- Add Milkdown v7.17.1 API patterns (callCommand, editorViewCtx)
- Add Floating UI usage patterns
- Add ProseMirror state tracking patterns
- Preserve existing context (lock enforcement, sensory feedback)

**Technology to Add**:
- Floating UI (`@floating-ui/dom`)
- Milkdown command execution patterns
- ProseMirror mark/node type checking

---

## Phase 2: Tasks (FUTURE)

**NOT CREATED BY /speckit.plan** - requires separate `/speckit.tasks` command

**Expected Output**: `tasks.md` with TDD-ordered task list:
1. Test tasks for each user story (write failing tests first)
2. Implementation tasks (minimal code to pass tests)
3. Integration tasks (EditorCore.tsx modifications)
4. E2E test tasks (Playwright scenarios)

**Test-First Order** (Article III compliance):
- T001-T010: Write failing tests for toolbar visibility
- T011-T020: Write failing tests for command execution
- T021-T030: Write failing tests for active state tracking
- T031-T040: Implement FloatingToolbar component (make tests pass)
- T041-T050: Integrate with EditorCore.tsx
- T051-T060: Write E2E tests
- T061-T070: Polish and documentation

---

## Next Steps

1. ✅ **Phase 0: Research** - COMPLETE (research.md generated)
2. ✅ **Phase 1: Data Model** - COMPLETE (data-model.md created)
3. ✅ **Phase 1: Contracts** - COMPLETE (contracts/ directory with FloatingToolbar.interface.ts and prosemirror-helpers.interface.ts)
4. ✅ **Phase 1: Quickstart** - COMPLETE (quickstart.md developer guide created)
5. ✅ **Phase 1: Agent Context** - COMPLETE (update-agent-context.ps1 executed)
6. ⏳ **Phase 2: Tasks** - Run `/speckit.tasks` command (separate from /speckit.plan)

**Current Phase**: Phase 1 (Design & Contracts) - COMPLETE ✅

---

## Risk Assessment

**Low Risk**:
- ✅ All dependencies already available (Milkdown, Floating UI)
- ✅ Pattern exists in codebase (EditorCore.tsx transaction interception)
- ✅ No backend changes required
- ✅ No database migrations

**Medium Risk**:
- ⚠️ Lock enforcement integration needs testing (verify formatting transactions are filtered)
- ⚠️ Mobile touch interaction might need special handling

**Mitigation**:
- Early testing with locked content
- Mobile E2E tests with touch events

**Estimated Complexity**: P2 (moderate) - simpler than P1-P3 lock enforcement system
