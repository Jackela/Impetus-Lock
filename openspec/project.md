# Impetus Lock - Project Context

## Purpose

Impetus Lock (创意施压者) is an adversarial AI Agent that acts as a "creative sparring partner." It breaks psychological fixation and blank page anxiety by forcibly implanting "un-deletable creative constraints" — turning solitary writing into a human-AI adversarial rogue-like game.

## Tech Stack

### Frontend

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript (strict mode)
- **Editor Core**: Milkdown (ProseMirror-based) with custom plugins
- **State Management**: React Query (@tanstack/react-query) for server state
- **Animation**: Framer Motion
- **Styling**: CSS Modules + CSS Variables
- **Testing**: Vitest (unit) + Playwright (E2E)

### Backend

- **Framework**: FastAPI (Python 3.11+)
- **Package Manager**: Poetry
- **AI Integration**: Instructor + Pydantic for structured LLM outputs
- **Database**: PostgreSQL + SQLAlchemy 2.0 (async)
- **Authentication**: JWT with HttpOnly cookies
- **Testing**: pytest + pytest-asyncio

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Local CI Testing**: Act CLI

## Project Conventions

### Code Style

#### Python (Backend)

- **Line Length**: 100 characters
- **Linter**: Ruff
- **Type Checker**: mypy (strict mode)
- **Docstrings**: Google/NumPy style for all public functions/classes
- **Import Organization**: Use absolute imports, no relative imports beyond package level

#### TypeScript (Frontend)

- **Strict Mode**: Enabled (no implicit any)
- **Linter**: ESLint with @typescript-eslint
- **Formatter**: Prettier
- **Comments**: JSDoc for all exported functions/components
- **Architecture**: Components → Hooks → Services (enforced by ESLint)

### Architecture Patterns

#### Backend (Clean Architecture)

- **SRP (Single Responsibility)**: FastAPI endpoints MUST delegate business logic to service layer
- **DIP (Dependency Inversion)**: High-level logic depends on abstractions (protocols/interfaces)
- **Repository Pattern**: Data access abstracted through interfaces
- **Service Layer**: Business logic isolated from HTTP concerns

#### Frontend (Component-Hook-Service)

```
Components (UI) → Hooks (Logic) → Services (API)
```

- Components cannot directly import from services
- Hooks provide the abstraction layer
- Services handle all HTTP communication

### Testing Strategy

#### Mandatory TDD (Red-Green-Refactor)

1. Write failing test
2. Verify test fails
3. Write minimal implementation
4. Verify test passes
5. Refactor while keeping tests green

#### Coverage Requirements

- **Critical Paths**: ≥80% (un-deletable constraint logic, lock enforcement)
- **P1 Features**: All must have tests before implementation
- **E2E Tests**: Core user flows (Muse/Loki modes, lock enforcement)

### Git Workflow

#### Branching Strategy

- **Main Branch**: `main` (protected, requires PR)
- **Feature Branches**: `feature/<description>`
- **Fix Branches**: `fix/<description>`
- **PRD Branches**: Named in `prd.json` (e.g., `feat/muse-mode`)

#### Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Adding/updating tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks
- `security:` - Security-related changes

## Domain Context

### Core Concepts

#### Lock System

The heart of Impetus Lock - text blocks that cannot be deleted:

- **Lock ID**: Unique identifier embedded in Markdown comments (`<!-- lock:lock_xxx -->`)
- **Filter Transaction**: ProseMirror plugin intercepts delete operations
- **Persistence**: Locks survive page reloads via Markdown serialization
- **Visual Indicators**: Locked text has visual styling (glitch effects, borders)

#### Agent Modes

**Muse Mode (Strict Mentor)**

- Trigger: Detects STUCK state (60s idle)
- Action: Injects creative constraints that force higher-level thinking
- Personality: Encouraging but firm, pushes toward breakthroughs

**Loki Mode (Chaos Trickster)**

- Trigger: Random intervals (30-120s)
- Actions:
  - Provoke: Inject random creative constraints
  - Delete: Remove user's last sentence (irreversible)
  - Rewrite: Transform user's text chaotically
- Personality: Unpredictable, challenges user's control

#### Writing State Machine

```
WRITING → (idle timeout) → IDLE → (stuck timeout) → STUCK
   ↑______________________________________________|
   (user types)
```

### Data Flow

1. User writes in editor
2. Writing state machine tracks activity
3. Agent monitors state and triggers interventions
4. Interventions are fetched from backend (LLM-powered)
5. Locked content is injected into editor
6. User must write around constraints (cannot delete)

## Important Constraints

### Constitutional Requirements (Non-Negotiable)

#### Article I: Simplicity & Anti-Abstraction

- 5-day MVP sprint mentality
- No over-engineering
- Use framework-native features
- Simplest viable implementation path

#### Article II: Vibe-First Imperative

- P1 priority RESERVED ONLY for un-deletable constraint
- All other features P2 or lower
- P1 tasks must represent ≥60% of story points

#### Article III: Test-First Imperative (TDD)

- Red-Green-Refactor cycle mandatory
- Tests for all P1 stories before implementation
- ≥80% coverage for critical paths

#### Article IV: SOLID Principles

- SRP: Endpoints delegate to services
- DIP: Depend on abstractions

#### Article V: Clear Comments & Documentation

- JSDoc (frontend) + Docstrings (backend)
- Explain WHY, not just WHAT

### Technical Constraints

#### Security

- API keys encrypted at rest (AES-256-GCM)
- JWT tokens with 24h expiration
- CSRF protection for state-changing operations
- Rate limiting on sensitive endpoints
- HTTPS required for production

#### Performance

- Editor must remain responsive (<100ms interaction latency)
- API response time <500ms for intervention requests
- Support for documents up to 10,000 words

#### Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile: iOS Safari, Chrome Android

## External Dependencies

### LLM Providers

- **OpenAI**: GPT-4, GPT-4-turbo (primary)
- **Anthropic**: Claude 3 (alternative)
- **Local Models**: Support for Ollama (optional)

### Infrastructure Services

- **PostgreSQL**: Primary database
- **Redis**: Rate limiting, caching (optional but recommended)
- **Docker**: Development and deployment

### Development Tools

- **Act CLI**: Local GitHub Actions testing
- **Pre-commit**: Git hooks for code quality
- **Ruff**: Python linting and formatting
- **ESLint/Prettier**: TypeScript/JavaScript linting

---

## Quick Links

- [API Contract](../API_CONTRACT.md) - OpenAPI specification
- [Architecture Guards](../ARCHITECTURE_GUARDS.md) - Clean Architecture rules
- [Development Guide](../DEVELOPMENT.md) - Setup and workflow
- [Testing Guide](../TESTING.md) - Testing strategy
- [Contributing](../CONTRIBUTING.md) - How to contribute
- [Security](../SECURITY.md) - Security policy
