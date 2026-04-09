# Implementation Plan: Impetus Lock Core - Agent Intervention System

**Branch**: `001-impetus-core` | **Date**: 2025-11-06 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-impetus-core/spec.md`  
**Status**: ✅ Phase 0 Complete | ✅ Phase 1 Complete | ⏭️ Ready for Phase 2 (Task Execution)

## Summary

Implement the core "Vibe" of Impetus Lock: an adversarial AI agent that enforces **un-deletable creative constraints** through two intervention modes:

1. **Muse Mode (P1)**: STUCK detection (60s idle) → auto-inject context-aware "creative pressure" blockquotes with lock_id
2. **Loki Mode (P1)**: Random chaos (30-120s intervals) → Provoke (inject) or Delete (remove text), both irreversible
3. **Lock Mechanism (P1)**: Editor-level transaction filtering to prevent deletion/undo of AI-injected content

**Technical Approach**:
- **Frontend**: Milkdown (ProseMirror) editor with `filterTransaction` API to intercept delete operations
- **Backend**: FastAPI + Instructor (Pydantic-typed LLM outputs) for structured Agent decisions
- **State Management**: Client-side state machine (WRITING/IDLE/STUCK) + random timer for Loki
- **Persistence**: lock_id stored in document metadata (survives page refresh)

---

## Technical Context

**Language/Version**: 
- Frontend: TypeScript 5.x (ES2020 target)
- Backend: Python 3.11+

**Primary Dependencies**:
- **Frontend**: 
  - Milkdown ^7.x (ProseMirror-based editor with `filterTransaction` support)
  - React 18.x + Vite 5.x
  - Framer Motion ^11.x (animations)
- **Backend**:
  - FastAPI ^0.115.0
  - Instructor ^1.4.0 (strongly-typed LLM outputs)
  - Pydantic ^2.9.0

**Storage**: 
- Client-side: Document metadata (lock_id persistence)
- Backend: Stateless (no database required for P1)

**Testing**:
- **Frontend**: Vitest (unit) + Playwright (E2E for lock enforcement)
- **Backend**: pytest + httpx (FastAPI TestClient)

**Target Platform**:
- Modern browsers (Chrome/Firefox/Edge latest)
- FastAPI server (Linux/Docker deployment)

**Project Type**: Web application (monorepo: client/ + server/)

**Performance Goals**:
- <3s response time for intervention (API call + injection)
- ≥30 FPS animation playback on low-end devices (Intel Core i3, 4GB RAM)
- ≥95% STUCK detection accuracy
- 100% lock enforcement (0 false negatives)

**Constraints**:
- Lock mechanism MUST use editor kernel layer (not DOM manipulation)
- Undo operations MUST be intercepted (not just blocked at UI level)
- Persistence MUST survive page refresh without server round-trip
- Audio assets MUST be <50KB per file

**Scale/Scope**:
- P1 MVP: 3 core user stories (Lock + Muse + Loki)
- Single user (no collaboration)
- 27 functional requirements
- 10 measurable success criteria
- Expected codebase: ~2K LOC frontend, ~1K LOC backend

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Article I: Simplicity & Anti-Abstraction ✅

- [x] **Framework-native features prioritized**: Using Milkdown's native `filterTransaction` API (not building custom editor layer)
- [x] **Simplest viable path**: Direct ProseMirror transaction filtering, no state management library (React useState sufficient)
- [x] **Service layer justified for SOLID compliance**: Backend uses service layer to enforce SRP and DIP (see Article IV justification below)
- [x] **Abstractions justified**: LockManager class (frontend) and InterventionService class (backend) have actual multi-implementation needs

**Justification for LockManager abstraction (Frontend)**:
- **Actual need**: Must support lock_id injection into Markdown AND future visual editors (different transaction APIs)
- **Simpler alternative rejected**: Inline lock logic in editor component would duplicate across editor types (violates DRY for actual scenario)

**Justification for InterventionService abstraction (Backend)**:
- **Actual need**: Enforces SRP (Article IV) - endpoints must delegate business logic to services, not contain it inline
- **Actual need**: Enables DIP (Article IV) - service depends on LLMProvider protocol, allowing swap between OpenAI/Anthropic/local LLM
- **Simpler alternative rejected**: Inline business logic in endpoint violates SOLID (creates tight coupling to HTTP layer, no dependency injection)

---

### Article II: Vibe-First Imperative ✅

- [x] **Un-deletable constraint is ONLY P1**: User Stories 1, 2, 3 (Lock, Muse, Loki) = P1
- [x] **UI polish is P2**: User Story 4 (Demo button), Story 5 (animations/audio) = P2
- [x] **P1 scheduled first**: Wave 1 = Lock mechanism + Muse STUCK detection + Loki random timer
- [x] **P1 ≥60% of story points**: 
  - P1: Lock (8 pts) + Muse (8 pts) + Loki (10 pts) = 26 pts
  - P2: Demo (3 pts) + Vibe (5 pts) = 8 pts
  - **P1 ratio**: 26/34 = 76% ✅

---

### Article III: Test-First Imperative (NON-NEGOTIABLE) ✅

- [x] **Test tasks BEFORE implementation**: 
  - Phase 2 will create test tasks first for each P1 story
  - TDD workflow: `test_lock_enforcement.spec.ts` (FAIL) → implement filterTransaction → (PASS)
  
- [x] **TDD workflow enforced**: 
  - Lock mechanism: E2E test (try delete locked block) → verify blocked → implement filter
  - STUCK detection: Unit test (60s timer) → verify trigger → implement state machine
  - Loki random: Unit test (30-120s distribution) → verify randomness → implement timer
  
- [x] **≥80% coverage for critical paths**:
  - `filterTransaction` logic (lock detection + block) = 100% coverage target
  - State machine transitions (WRITING/IDLE/STUCK) = 100% coverage target
  - API integration (intervention call + response handling) = 90% coverage target
  
- [x] **P1 features have test files**:
  - `client/tests/lock-enforcement.spec.ts` (E2E)
  - `client/tests/state-machine.test.ts` (unit)
  - `client/tests/loki-timer.test.ts` (unit)
  - `server/tests/test_intervention.py` (API contract)

---

### Article IV: SOLID Principles ✅

- [x] **SRP - Endpoints delegate to services**:
  - `/impetus/generate-intervention` → `InterventionService.generate()`
  - Endpoint ONLY handles HTTP (validation, headers, status codes)
  - Service layer handles business logic (LLM call, decision logic)
  
- [x] **DIP - Abstractions over implementations**:
  - `InterventionService` depends on `LLMProvider` protocol (not concrete OpenAI client)
  - Allows future swap to Anthropic/local LLM without changing service code
  - Constructor injection: `InterventionService(llm_provider: LLMProvider)`
  
- [x] **No raw SQL in endpoints**: N/A (stateless P1, no database)
  
- [x] **Constructor injection enforced**:
  ```python
  # Good (DIP compliant)
  class InterventionService:
      def __init__(self, llm_provider: LLMProvider):
          self.llm = llm_provider
  
  # Bad (violates DIP) - PROHIBITED
  class InterventionService:
      def __init__(self):
          self.llm = OpenAI(api_key=...)  # Direct instantiation
  ```

---

### Article V: Clear Comments & Documentation ✅

- [x] **Frontend JSDoc**:
  - All exported functions in `src/services/` (API client, state machine)
  - All React components in `src/components/Editor/` (LockManager, StateMachine)
  
- [x] **Backend Docstrings**:
  - `InterventionService.generate()` - Google-style docstring with Args/Returns/Raises
  - `/impetus/generate-intervention` - FastAPI auto-docs + docstring summary
  
- [x] **Public interfaces documented**:
  - `LockManager.applyLock()` - JSDoc with @param lock_id, @returns success boolean
  - `StateMachine.transition()` - JSDoc with @param event, @returns new_state
  
- [x] **Critical path documentation**:
  - `filterTransaction` implementation - inline comments explaining ProseMirror API usage
  - Idempotency-Key generation - comment explaining UUID v4 + caching strategy

---

## Project Structure

### Documentation (this feature)

```text
specs/001-impetus-core/
├── plan.md              # This file (Phase 0 output)
├── research.md          # Phase 0 output (technology decisions)
├── data-model.md        # Phase 1 output (entities + state machine)
├── quickstart.md        # Phase 1 output (dev setup guide)
├── contracts/           # Phase 1 output (OpenAPI spec)
│   └── intervention.yaml
├── checklists/          # Quality validation
│   └── requirements.md
└── tasks.md             # Phase 2 output (NOT created yet - awaits /speckit.tasks)
```

### Source Code (repository root)

```text
# Web application (monorepo)
client/
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── EditorCore.tsx       # Milkdown integration
│   │   │   ├── LockManager.ts       # Lock enforcement logic
│   │   │   └── TransactionFilter.ts # ProseMirror filterTransaction
│   │   ├── Controls/
│   │   │   ├── ModeSelector.tsx     # Muse/Loki/Off switcher
│   │   │   └── DemoTrigger.tsx      # "我卡住了!" button (P2)
│   │   └── Feedback/
│   │       ├── Animations.tsx       # Glitch/Shake/Whoosh (P2)
│   │       └── AudioPlayer.ts       # Clank/Bonk sounds (P2)
│   ├── services/
│   │   ├── api/
│   │   │   └── interventionClient.ts # Backend API integration
│   │   ├── stateMachine.ts          # WRITING/IDLE/STUCK state machine
│   │   └── lokiTimer.ts             # Random 30-120s interval logic
│   ├── hooks/
│   │   ├── useWritingState.ts       # State machine hook
│   │   └── useLockEnforcement.ts    # Lock logic hook
│   └── types/
│       ├── lock.ts                  # LockBlock, lock_id types
│       └── intervention.ts          # InterventionResponse types
├── tests/
│   ├── e2e/
│   │   └── lock-enforcement.spec.ts # Playwright: try delete locked block
│   └── unit/
│       ├── state-machine.test.ts    # Vitest: STUCK detection
│       └── loki-timer.test.ts       # Vitest: random distribution
├── public/
│   └── audio/
│       ├── clank.mp3                # Lock sound (<50KB)
│       ├── bonk.mp3                 # Invalid action (<50KB)
│       └── whoosh.mp3               # Delete action (<50KB)
└── package.json

server/
├── server/
│   ├── domain/                      # Clean Architecture (pending P1 code)
│   │   └── _placeholder.py
│   ├── application/
│   │   └── _placeholder.py
│   ├── infrastructure/
│   │   └── _placeholder.py
│   └── api/
│       ├── main.py                  # FastAPI app + health endpoint
│       └── routes/
│           └── intervention.py      # POST /impetus/generate-intervention
├── tests/
│   ├── test_intervention_api.py     # API contract tests
│   └── test_health.py               # Health endpoint test
└── pyproject.toml
```

**Structure Decision**: 
- **Web application (Option 2)** selected - project has explicit frontend (React editor) + backend (FastAPI API)
- **Monorepo layout**: Existing structure in place (`client/` + `server/`)
- **Clean Architecture layers**: Prepared but deferred until P1 code (per ARCHITECTURE_SAFETY_NET_STATUS.md)
- **Contract-first design**: OpenAPI spec drives both frontend TypeScript types and backend Pydantic models

---

## Complexity Tracking

> **No violations requiring justification**

All Constitution Check items passed. The single abstraction (LockManager) is justified by actual multi-editor support need (Markdown vs future WYSIWYG), not speculation.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
