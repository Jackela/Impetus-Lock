# Planning Phase Complete: Impetus Lock Core

**Feature**: Impetus Lock Core - Agent Intervention System  
**Branch**: `001-impetus-core`  
**Date**: 2025-11-06  
**Status**: ✅ All Planning Phases Complete → Ready for Implementation

---

## Planning Deliverables Summary

### Phase 0: Research & Technology Decisions ✅

**Document**: [research.md](research.md)  
**Completed**: 2025-11-06

**Key Decisions** (8 technology choices):
1. **Editor**: Milkdown ^7.x (ProseMirror-based) for `filterTransaction` API
2. **AI Integration**: Instructor ^1.4.0 for strongly-typed LLM outputs
3. **Animations**: Framer Motion ^11.x (GPU-accelerated)
4. **State Machine**: Custom React hook (no XState/Zustand - Article I compliance)
5. **Audio**: Native Web Audio API (no Howler.js needed)
6. **API Client**: Native `fetch` with TypeScript types from OpenAPI
7. **Persistence**: localStorage + Markdown comments (`<!-- lock:xxx -->`)
8. **Random Timer**: Web Crypto API for uniform distribution

**Constitutional Compliance**:
- ✅ Article I: No unnecessary abstractions (native features preferred)
- ✅ Justified abstractions: LockManager needed for actual multi-editor support

---

### Phase 1: Design & Contracts ✅

**Documents Created**:
- [data-model.md](data-model.md) - Entity definitions & state machines
- [contracts/intervention.yaml](contracts/intervention.yaml) - OpenAPI 3.0.3 specification
- [quickstart.md](quickstart.md) - Developer setup guide
- [CLAUDE.md](../../CLAUDE.md) - Updated agent context

**Completed**: 2025-11-06

#### Data Model (5 Core Entities)

1. **LockBlock**: Un-deletable text blocks with UUID lock_id
   ```typescript
   interface LockBlock {
     lock_id: string;        // UUID v4
     content: string;        // Markdown blockquote
     source: AgentMode;      // "muse" | "loki"
     created_at: number;     // Unix timestamp
     is_deletable: false;    // Constant
   }
   ```

2. **WritingState**: State machine (WRITING → IDLE → STUCK)
   - WRITING: User typed within last 5 seconds
   - IDLE: User stopped typing 5-60 seconds ago
   - STUCK: User stopped typing >60 seconds (triggers Muse)

3. **InterventionAction**: AI decisions
   - **provoke**: Inject content with lock_id
   - **delete**: Remove text at anchor (bypass Undo)

4. **Anchor**: Target positioning (pos | range | lock_id)

5. **AgentMode**: muse | loki | off

#### API Contract

**Endpoint**: `POST /impetus/generate-intervention`

**Key Features**:
- Idempotency via `Idempotency-Key` header (15s cache)
- Contract versioning via `X-Contract-Version: 2.0.0`
- Safety guards: Reject Delete if doc <50 chars
- Error handling: 400, 422, 429, 500

**Request Schema**:
```json
{
  "context": "他打开门,犹豫着要不要进去。",
  "mode": "muse" | "loki",
  "client_meta": {
    "doc_version": 42,
    "selection_from": 1234,
    "selection_to": 1234
  }
}
```

**Response Schema**:
```json
{
  "action": "provoke" | "delete",
  "content": "门后是一堵砖墙。",
  "lock_id": "lock_01j4z3m8a6q3qz2x8j4z3m8a",
  "anchor": { "type": "pos", "from": 1234 },
  "action_id": "act_550e8400-e29b-41d4-a716-446655440000"
}
```

#### Developer Quickstart

**Setup Workflows**:
- Backend: Poetry + FastAPI + OpenAI API key
- Frontend: npm + Vite + Milkdown
- Type generation: `openapi-typescript` for TypeScript types
- Act CLI: Local GitHub Actions simulation

**TDD Examples**:
- Lock enforcement: E2E test → filterTransaction implementation
- STUCK detection: Unit test → useWritingState hook
- API integration: Contract test → endpoint + service layer

---

### Phase 2: Task Breakdown ✅

**Document**: [tasks.md](tasks.md)  
**Completed**: 2025-11-06

**Total Tasks**: 155 tasks across 8 phases

#### Task Distribution

| Phase | User Story | Priority | Tasks | Act CLI Gates |
|-------|------------|----------|-------|---------------|
| 1 | Setup (Dependencies) | - | 7 | No |
| 2 | Foundational (Blocking) | - | 11 | No |
| 3 | US1 - Lock Enforcement | **P1** | 32 | **Required** |
| 4 | US2 - Muse STUCK Detection | **P1** | 28 | **Required** |
| 5 | US3 - Loki Random Chaos | **P1** | 31 | **Required** |
| 6 | US4 - Demo Button | P2 | 10 | Required |
| 7 | US5 - Visual/Audio Feedback | P2 | 19 | Required |
| 8 | Polish & Final Validation | - | 17 | **Required** |

#### P1 MVP Scope

**Tasks T001-T109** (109 tasks):
- Lock Enforcement (32 tasks)
- Muse Mode (28 tasks)
- Loki Mode (31 tasks)
- Setup + Foundation (18 tasks)

**P1 Ratio**: 109/155 = 70% (exceeds 60% Article II requirement) ✅

#### TDD Cycle Integration

Every P1 user story follows:
1. **RED**: Write failing tests (T019-T025, T051-T056, T079-T086)
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Improve while tests stay green
4. **ACT CLI**: Validate all CI checks pass

**Test Coverage Requirements**:
- Critical paths: ≥80% coverage (lock enforcement, state machine, intervention service)
- Success criteria: SC-001 to SC-010 validated

#### Act CLI Validation Gates

**6 Mandatory Checkpoints**:
1. User Story 1 (Lock): T045-T050
2. User Story 2 (Muse): T073-T078
3. User Story 3 (Loki): T104-T109
4. User Story 4 (Demo): T117-T119
5. User Story 5 (Vibe): T136-T138
6. Final Validation: T148-T155

**CI Pipeline** (all must pass):
- Lint: ESLint + Ruff
- Type-check: TypeScript strict + mypy strict
- Backend tests: pytest with coverage
- Frontend tests: Vitest + Playwright E2E

**Tasks remain incomplete until `act` command passes all jobs** ✅

---

## Constitutional Compliance Summary

### Article I: Simplicity & Anti-Abstraction ✅

**Decisions**:
- ✅ Milkdown's native `filterTransaction` (no custom editor layer)
- ✅ React hooks for state machine (no XState/Zustand)
- ✅ Native fetch (no axios/ky)
- ✅ Native Web Audio API (no Howler.js)
- ✅ Web Crypto API (no third-party random)

**Justified Abstraction**:
- LockManager class: Actual need for multi-editor support (Markdown vs future WYSIWYG)

### Article II: Vibe-First Imperative ✅

**P1 Priority**:
- Lock enforcement (US1) - Core Vibe
- Muse Mode (US2) - Core Vibe
- Loki Mode (US3) - Core Vibe

**P2 Priority**:
- Demo button (US4) - Auxiliary
- Visual/Audio feedback (US5) - UI polish

**Story Points**:
- P1: Lock (8) + Muse (8) + Loki (10) = 26 points
- P2: Demo (3) + Vibe (5) = 8 points
- **P1 Ratio**: 26/34 = 76% ✅ (exceeds 60%)

**Task Ratio**:
- P1 Tasks: 109/155 = 70% ✅

### Article III: Test-First Imperative ✅

**TDD Enforcement**:
- All P1 user stories have test tasks BEFORE implementation tasks
- RED-GREEN-REFACTOR cycle mandated for US1, US2, US3
- Act CLI validation gates ensure tests pass before completion

**Test Tasks**:
- US1: T019-T025 (tests) before T026-T044 (implementation)
- US2: T051-T056 (tests) before T057-T072 (implementation)
- US3: T079-T086 (tests) before T087-T103 (implementation)

**Coverage Requirements**:
- Backend: ≥80% for intervention service, lock logic
- Frontend: ≥80% for lock enforcement, state machine, transaction filter

### Article IV: SOLID Principles ✅

**SRP (Single Responsibility)**:
- Endpoints delegate to service layer (T027, intervention.py)
- Services contain business logic only (T026, intervention_service.py)

**DIP (Dependency Inversion)**:
- LLMProvider protocol (T008) - abstraction
- InstructorLLMProvider (T009) - concrete implementation
- Constructor injection enforced (T026 depends on T008)

**Example**:
```python
# Protocol (abstraction)
class LLMProvider(Protocol):
    def generate_intervention(self, context: str, mode: str) -> InterventionResponse: ...

# Service uses abstraction (DIP)
class InterventionService:
    def __init__(self, llm: LLMProvider):  # Constructor injection
        self.llm = llm
```

### Article V: Clear Comments & Documentation ✅

**Documentation Requirements**:
- All tasks include "Include JSDoc/docstrings per Article V"
- Backend: Google-style docstrings for all public APIs
- Frontend: JSDoc for all exported functions/components
- Critical paths: Inline comments for complex logic (filterTransaction, Undo bypass)

**Example Task**:
- T026: "Include Google-style docstrings with Args/Returns/Raises per Article V"
- T030: "Include JSDoc for function and complex logic per Article V"

---

## File Structure Summary

### Planning Documents (specs/001-impetus-core/)

```
specs/001-impetus-core/
├── spec.md                    # Feature specification (5 user stories, 27 FRs, 10 SCs)
├── plan.md                    # Implementation plan with Constitution Check
├── research.md                # Technology decisions (8 choices)
├── data-model.md              # Entity definitions & state machines
├── quickstart.md              # Developer setup guide
├── tasks.md                   # Task breakdown (155 tasks)
├── contracts/
│   └── intervention.yaml      # OpenAPI 3.0.3 specification
├── checklists/
│   └── requirements.md        # Quality validation (all ✅)
└── PLANNING_COMPLETE.md       # This file
```

### Implementation Structure (from plan.md)

```
client/
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── EditorCore.tsx           # Milkdown integration
│   │   │   ├── LockManager.ts           # Lock enforcement logic
│   │   │   └── TransactionFilter.ts     # ProseMirror filterTransaction
│   │   ├── Controls/
│   │   │   ├── ModeSelector.tsx         # Muse/Loki/Off switcher
│   │   │   └── DemoTrigger.tsx          # "我卡住了!" button
│   │   └── Feedback/
│   │       ├── Animations.tsx           # Glitch/Shake/Whoosh
│   │       └── AudioPlayer.ts           # Clank/Bonk sounds
│   ├── services/
│   │   ├── api/interventionClient.ts    # Backend API integration
│   │   ├── stateMachine.ts              # WRITING/IDLE/STUCK
│   │   └── lokiTimer.ts                 # Random 30-120s interval
│   ├── hooks/
│   │   ├── useWritingState.ts           # State machine hook
│   │   └── useLockEnforcement.ts        # Lock logic hook
│   └── types/
│       ├── lock.ts                      # LockBlock, lock_id types
│       └── api.generated.ts             # OpenAPI TypeScript types
├── tests/
│   ├── e2e/
│   │   ├── lock-enforcement.spec.ts     # Playwright: delete prevention
│   │   ├── muse-intervention.spec.ts    # Playwright: STUCK detection
│   │   └── loki-delete.spec.ts          # Playwright: random chaos
│   └── unit/
│       ├── LockManager.test.ts          # Vitest: lock state management
│       ├── useWritingState.test.ts      # Vitest: state machine
│       └── useLokiTimer.test.ts         # Vitest: random timer
└── package.json

server/
├── server/
│   ├── domain/
│   │   ├── llm_provider.py              # LLMProvider protocol (DIP)
│   │   └── models/
│   │       ├── intervention.py          # Pydantic models
│   │       └── anchor.py                # Anchor union types
│   ├── application/
│   │   └── services/
│   │       └── intervention_service.py  # Business logic (uses LLMProvider)
│   ├── infrastructure/
│   │   ├── llm/
│   │   │   ├── instructor_provider.py   # Concrete LLM implementation
│   │   │   └── prompts/
│   │   │       ├── muse_prompt.py       # Muse mode prompt
│   │   │       └── loki_prompt.py       # Loki mode prompt
│   │   └── cache/
│   │       └── idempotency_cache.py     # 15s TTL cache
│   └── api/
│       ├── main.py                      # FastAPI app
│       └── routes/
│           └── intervention.py          # POST /impetus/generate-intervention
├── tests/
│   ├── test_intervention_api.py         # Contract tests
│   └── test_loki_logic.py               # Loki decision logic tests
└── pyproject.toml
```

---

## Success Criteria Mapping

All 10 success criteria from spec.md mapped to tasks:

- **SC-001**: Lock enforcement 100% success → T019-T025 (tests), T026-T044 (implementation)
- **SC-002**: STUCK detection ≥95% accuracy → T051-T056 (tests), T059-T064 (implementation)
- **SC-003**: Response time <3s → T069 (performance validation)
- **SC-004**: Random distribution uniform → T079 (distribution test), T090 (crypto random)
- **SC-005**: User satisfaction ≥4/5 → Manual testing after T109 (P1 complete)
- **SC-006**: Auto-pause after 5 failures → T062 (error handling)
- **SC-007**: Lock persistence 100% → T033 (Markdown comments)
- **SC-008**: Animation ≥30 FPS → T120, T135 (performance tests)
- **SC-009**: Loki ≥2 interventions/5min → T100 (frequency test)
- **SC-010**: Demo trigger <1s → T116 (response time test)

---

## Next Steps: Implementation Phase

### Immediate Actions

1. **Review Planning Documents**:
   - Read spec.md for user requirements
   - Review data-model.md for entity definitions
   - Study contracts/intervention.yaml for API contract
   - Follow quickstart.md for setup

2. **Begin Task Execution**:
   - Start with Phase 1: Setup (T001-T007)
   - Complete Phase 2: Foundational (T008-T018)
   - Begin User Story 1: Lock Enforcement (T019-T050)

3. **Follow TDD Cycle**:
   - Write tests first (RED phase)
   - Verify tests fail
   - Implement minimal code (GREEN phase)
   - Refactor while tests stay green
   - Run Act CLI validation

### Implementation Strategy

**MVP First** (Recommended):
```bash
# Phase 1: Setup (7 tasks)
T001-T007: Install dependencies, configure Act CLI

# Phase 2: Foundational (11 tasks)
T008-T018: Build backend/frontend foundation

# Phase 3: User Story 1 - Lock (32 tasks)
T019-T050: TDD cycle → Act CLI validation

# Phase 4: User Story 2 - Muse (28 tasks)
T051-T078: TDD cycle → Act CLI validation

# Phase 5: User Story 3 - Loki (31 tasks)
T079-T109: TDD cycle → Act CLI validation

# STOP: P1 MVP Complete (109 tasks)
# Validate with Act CLI, deploy/demo
```

**Full Delivery** (P1 + P2):
```bash
# Continue from P1 MVP...

# Phase 6: User Story 4 - Demo (10 tasks)
T110-T119: Demo button → Act CLI validation

# Phase 7: User Story 5 - Vibe (19 tasks)
T120-T138: Animations/Audio → Act CLI validation

# Phase 8: Polish (17 tasks)
T139-T155: Documentation, final Act CLI validation

# COMPLETE: All features delivered
```

### Parallel Team Strategy

With 3 developers after Foundational phase:

- **Developer A**: User Story 1 (Lock) → T019-T050
- **Developer B**: User Story 2 (Muse) → T051-T078
- **Developer C**: User Story 3 (Loki) → T079-T109

All integrate via Foundational layer (T008-T018).

---

## Quality Gates

### Pre-Implementation

- ✅ Specification complete (spec.md validated via requirements.md)
- ✅ Clarification phase passed (no ambiguities detected)
- ✅ Constitution check passed (all 5 articles compliant)
- ✅ Technology decisions documented (research.md)
- ✅ Data model defined (data-model.md)
- ✅ API contract specified (intervention.yaml)
- ✅ Task breakdown complete (tasks.md)

### During Implementation

- Test-first for all P1 features (RED-GREEN-REFACTOR)
- Act CLI validation after each user story
- Test coverage ≥80% for critical paths
- All code includes JSDoc/docstrings
- SOLID principles enforced

### Post-Implementation

- Full Act CLI pipeline passes (T148-T155)
- All success criteria validated (SC-001 to SC-010)
- Performance benchmarks met
- Documentation complete
- Production ready

---

## Resources

### Planning Documents
- [spec.md](spec.md) - Feature specification
- [plan.md](plan.md) - Implementation plan
- [research.md](research.md) - Technology decisions
- [data-model.md](data-model.md) - Entity definitions
- [contracts/intervention.yaml](contracts/intervention.yaml) - API contract
- [quickstart.md](quickstart.md) - Developer guide
- [tasks.md](tasks.md) - Task breakdown

### Constitutional Documents
- [constitution.md](../../.specify/memory/constitution.md) - Project governance

### Agent Context
- [CLAUDE.md](../../CLAUDE.md) - Claude Code context

### External References
- Milkdown Docs: https://milkdown.dev/docs/guide/getting-started
- ProseMirror Guide: https://prosemirror.net/docs/guide/
- Instructor Docs: https://github.com/jxnl/instructor
- FastAPI Docs: https://fastapi.tiangolo.com/
- Act CLI Docs: https://github.com/nektos/act

---

**Planning Phase Complete**: 2025-11-06  
**Ready for Implementation**: Yes ✅  
**Next Command**: Begin task execution starting with T001

---

*This document serves as a comprehensive summary of all planning deliverables. All artifacts are ready for implementation following the TDD cycle with Act CLI validation gates.*
