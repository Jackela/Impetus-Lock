<!--
Sync Impact Report:
- Version Change: [TEMPLATE] → 1.0.0 (Initial ratification)
- Modified Principles: N/A (initial creation)
- Added Sections:
  * Article I: Simplicity & Anti-Abstraction
  * Article II: Vibe-First Imperative
  * Article III: Test-First Imperative
  * Article IV: SOLID Principles
  * Article V: Clear Comments & Documentation
  * Governance & Amendment Process
  * Consistency Propagation Checklist
- Removed Sections: Generic template placeholders
- Templates Requiring Updates:
  ⚠ .specify/templates/plan-template.md (align Constitution Check)
  ⚠ .specify/templates/spec-template.md (align scope constraints)
  ⚠ .specify/templates/tasks-template.md (align task categorization)
  ⚠ .specify/templates/commands/*.md (verify principle references)
  ⚠ README.md / docs/* (ensure principle visibility)
- Follow-up TODOs: Propagate gates to CI configuration (test coverage, linting)
-->

# Impetus Lock Project Constitution

**Version:** 1.0.0  
**Ratified:** 2025-11-05  
**Last Amended:** 2025-11-05

---

## Preamble

This constitution establishes the non-negotiable principles and governance rules for the **Impetus Lock** project—a 5-day MVP sprint focused on creating an un-deletable task pressure system. All project artifacts, AI agents, and contributors MUST adhere to these articles.

---

## Core Principles

### Article I: Simplicity & Anti-Abstraction

**Principle:**  
This is a 5-day MVP sprint project. AI over-engineering is strictly prohibited.

**Gate (Enforcement):**  
During the `plan` phase, AI MUST:
- Prioritize framework-native features over custom implementations
- Choose the simplest viable implementation path
- Prohibit creation of unnecessary wrapper classes or abstraction layers

**Rationale:**  
Time-boxed MVPs require ruthless pragmatism. Every abstraction layer adds cognitive overhead, testing burden, and delivery risk without proportional value in a 5-day context.

**Compliance Test:**  
Code review SHALL reject any PR introducing abstractions not justified by actual (not anticipated) multi-implementation scenarios.

---

### Article II: Vibe-First Imperative

**Principle:**  
The core product "vibe" is **"Impetus Lock"** (un-deletable pressure). This is the ONLY P1 priority.

**Gate (Enforcement):**  
During the `tasks` phase, AI MUST:
- Assign P1 priority ONLY to tasks implementing the un-deletable constraint
- Assign P2 or lower to all other features (UI polish, auxiliary functions)
- Sequence work so P1 tasks are always implemented first

**Rationale:**  
The project's unique value proposition is the psychological pressure of irrevocable commitment. Without this core mechanic, the product is indistinguishable from generic task managers.

**Compliance Test:**  
Any sprint backlog SHALL demonstrate P1 tasks represent ≥60% of story points and are scheduled in wave 1.

---

### Article III: Test-First Imperative

**Principle:**  
This project strictly follows **TDD (Test-Driven Development)**. This is non-negotiable.

**Gate (Enforcement):**  
- **During `tasks` phase:** AI MUST generate test tasks for ALL P1 user stories (especially Vibe-First features) BEFORE implementation tasks
- **During `implement` phase:** AI MUST follow this sequence:
  1. Write a failing test
  2. Verify test failure
  3. Write minimal implementation to pass test
  4. Refactor only after green tests

**Rationale:**  
TDD ensures:
- Requirements are testable (eliminating vague acceptance criteria)
- Regression protection from day 1
- Design emerges from real usage patterns, not speculation

**Compliance Test:**  
CI pipeline SHALL block merges if:
- P1 features lack corresponding test files
- Test coverage falls below 80% for critical paths (un-deletable logic, lock enforcement)

---

### Article IV: SOLID Principles

**Principle:**  
All backend services and modules MUST adhere to SOLID principles.

**Gate (Enforcement):**  
During the `plan` phase, AI MUST enforce:
- **Single Responsibility Principle (SRP):** FastAPI endpoints SHALL delegate business logic to service layer classes
- **Dependency Inversion Principle (DIP):** High-level logic (use cases) SHALL depend on abstractions (protocols/interfaces), not concrete implementations (database clients, external APIs)

Other SOLID principles (Open/Closed, Liskov Substitution, Interface Segregation) SHALL be applied where applicable.

**Rationale:**  
SOLID ensures:
- Testability through dependency injection
- Modularity enabling parallel development
- Maintainability as requirements evolve post-MVP

**Compliance Test:**  
Code review SHALL reject:
- Endpoint handlers containing raw SQL or business rules
- Service classes directly instantiating infrastructure dependencies (must use constructor injection)

---

### Article V: Clear Comments & Documentation

**Principle:**  
All public functions, API endpoints, and core logic modules MUST include complete documentation.

**Gate (Enforcement):**  
During the `implement` phase, AI-generated code MUST include:
- **Frontend (JavaScript/TypeScript):** JSDoc comments for all exported functions/components
- **Backend (Python):** Docstrings (Google/NumPy style) for all public functions and classes

During the `analyze` phase:
- Missing documentation SHALL be flagged as WARN (blocks merge if on critical path)

**Rationale:**  
Documentation-as-code ensures:
- API contracts are self-evident
- Onboarding friction is minimized (critical for 5-day sprints with potential team changes)
- IDE autocomplete provides inline guidance

**Compliance Test:**  
Linters (ESLint + `jsdoc` plugin for frontend, `pydocstyle` for backend) SHALL enforce documentation presence. CI fails on missing docs for public interfaces.

---

## Governance

### Amendment Procedure

1. **Proposal:** Any contributor may propose amendments via PR against `.specify/memory/constitution.md`
2. **Review:** Requires approval from ≥2 project stakeholders
3. **Versioning:**
   - **MAJOR (X.0.0):** Backward-incompatible principle removals or redefinitions
   - **MINOR (x.Y.0):** New principles or material expansions of existing articles
   - **PATCH (x.y.Z):** Clarifications, typos, non-semantic refinements
4. **Propagation:** Amended constitutions trigger updates to all `.specify/templates/*` files per checklist below

### Compliance Review

- **Pre-Merge:** All PRs SHALL pass automated gates (tests, linters, coverage thresholds)
- **Sprint Retrospective:** Constitution adherence SHALL be evaluated; violations documented as process debt
- **Post-MVP:** Constitution MAY be revised based on lessons learned, but core principles (Vibe-First, TDD) are foundational and require MAJOR version bump to modify

### Constitution Supremacy

This constitution supersedes all other development practices, conventions, or guidelines. In case of conflict between this document and other project artifacts, this constitution takes precedence.

---

## Consistency Propagation Checklist

When amending this constitution, the following artifacts MUST be reviewed and updated for consistency:

- [ ] `.specify/templates/plan-template.md` — Align "Constitution Check" section with principles
- [ ] `.specify/templates/spec-template.md` — Update scope/requirements constraints to reflect new/changed articles
- [ ] `.specify/templates/tasks-template.md` — Reflect principle-driven task categorization (P1/P2 definitions, TDD task ordering)
- [ ] `.specify/templates/commands/*.md` — Remove agent-specific guidance if principles are genericized; verify no outdated references
- [ ] `README.md` / `docs/quickstart.md` — Update principle references for developer onboarding
- [ ] CI configuration (`.github/workflows/*`, linter configs) — Ensure automated gates enforce all principles programmatically

---

**Ratified by:** Impetus Lock Project Stakeholders  
**Effective Date:** 2025-11-05

---

**Version:** 1.0.0 | **Ratified:** 2025-11-05 | **Last Amended:** 2025-11-05
