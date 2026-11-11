# Changelog

All notable changes to the Impetus Lock project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-11-11

### Changed - Repository hygiene and test suite (2026-11-11)

- **Test suite**: moved the coverage gate out of Vitest into a `node:test` process, removed duplicate/skipped tests, enabled branch coverage, added `pytest-timeout`, and restored the toolbar performance checks. See `docs/reports/20261111-test-suite-optimization.md` (PR #249).
- **CI**: pinned Poetry 2.5.1 across workflows and the production Dockerfile; added JUnit/coverage artifacts, E2E permissions/concurrency/browser cache, and failure-evidence uploads.
- **Repository hygiene**: archived stale root guides, removed tracked test state and dead scripts, added `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.editorconfig`, and a current documentation index.
- **Quality roadmap**: dead UI/services removal, CI consolidation, dependency cleanup, and bundle reduction are recorded in `docs/reports/20261109-quality-roadmap.md` (PR #246).

### Changed - Code Quality Improvements (2026-03-27)

- **Documentation**: Enhanced public API documentation
  - Added module-level docstrings to collaboration endpoints (collaboration.py)
  - Documented pending permission persistence with GitHub issue tracking
  - Improved test documentation for auth placeholders (test_security.py)
  - Fixed whitespace issues in intervention.py docstrings (W293)
- **TODO Resolution**: Converted production code TODOs to tracked issues
  - Collaboration permission storage (tracked in GitHub issues)
  - Auth test placeholders properly documented
- **Import Optimization**: Verified clean import structure across server codebase
- **Naming Consistency**: Verified snake_case for Python, camelCase for TypeScript

### Added

- **Test Documentation Suite**: Comprehensive testing documentation
  - `server/tests/README.md`: Test suite overview, structure explanation, running guide, fixture usage, mock factory examples, troubleshooting
  - `server/tests/STYLE_GUIDE.md`: Naming conventions, file organization, fixture patterns, mock guidelines, parameterized test examples
  - `server/tests/TESTING_PHILOSOPHY.md`: Testing philosophy, test categories (Unit/Integration/E2E), async testing best practices, CI/CD integration
  - All documentation includes code examples and quick reference cards

### Changed

- Backend testing mode now tolerates missing `DATABASE_URL` (in-memory repo) and accepts backward-compatible `X-Contract-Version` headers while persisting interventions when a repository is available.
- Editor now loads/saves documents through Task API with local cache fallback and optimistic versioning; timer/lock visuals align with spec (non-intrusive timer, hover-only lock icon + aria label).

### Added - P2 Vibe Enhancements (2025-11-07)

#### Manual Trigger Button (User Story 1)

- **Manual AI Intervention**: Added "I'm stuck!" button in Muse mode for instant AI assistance
  - Reduces wait time from 60 seconds (automatic STUCK detection) to <2 seconds
  - Button enabled only in Muse mode; disabled in Loki/Off modes
  - 2-second debouncing prevents rapid-fire API calls
  - Loading state shows "Thinking..." during API call
  - Accessibility: `aria-label` for screen readers, `data-testid` for testing

#### Sensory Feedback System (User Story 2)

- **Visual Animations**: Added Framer Motion animations for all AI actions
  - **PROVOKE** (Muse mode): Glitch effect with opacity flicker (1.5s duration)
  - **DELETE** (Loki mode): Fade-out effect (0.75s duration)
  - **REJECT** (locked content): Shake effect (reuses P1 implementation)
- **Audio Effects**: Added Web Audio API sound feedback
  - **Clank** (28.8 KB): Plays on PROVOKE actions - metallic lock sound
  - **Whoosh** (18.4 KB): Plays on DELETE actions - air whoosh sound
  - **Bonk** (10.9 KB): Plays on REJECT actions - impact sound (P1 feature)
- **Cancel-and-Replace**: Previous animation/audio stops when new action triggers
- **Accessibility**:
  - Respects `prefers-reduced-motion` browser setting (simplified animations)
  - Graceful degradation when Web Audio API unavailable
  - Visual feedback works even when audio is muted

#### Infrastructure & Polish

- **Configuration System**: Centralized sensory feedback configuration
  - `AIActionType` enum with JSDoc documentation
  - `SensoryFeedbackConfig` interface for animation/audio mappings
  - `FEEDBACK_CONFIG` constant for type-safe configuration
- **Hooks**:
  - `useManualTrigger`: Debounced trigger with loading state
  - `useAudioFeedback`: Web Audio API with preloading and error handling
  - `useAnimationController`: Framer Motion variants with accessibility support
- **Components**:
  - `ManualTriggerButton`: Mode-aware button with loading state
  - `SensoryFeedback`: Orchestrates visual + audio feedback
  - `SensoryFeedbackDemo`: 存在但未挂载（demo 组件仅作为手动验证入口保留，不在 App 布局/路由中渲染）
- **Testing**:
  - 24 new unit tests for editor components (SimpleEditor, EditorCore)
  - 10 unit tests for `useManualTrigger` hook
  - 14 unit tests for `useAudioFeedback` and `useAnimationController` hooks
  - 5 unit tests for `ManualTriggerButton` component
  - 5 unit tests for `SensoryFeedback` component
  - E2E tests for manual trigger flow and sensory feedback
  - E2E tests for editor initialization (10 scenarios)
  - **Test Coverage**: 118/121 tests passing (97.5%)
- **Documentation**:
  - `docs/components/audio-feedback.md`: Complete audio system reference
  - `CREDITS.md`: Audio asset attribution
  - Comprehensive JSDoc comments for all components and hooks
- **Accessibility**:
  - `@media (prefers-reduced-motion)` CSS rules
  - Simplified animations for motion-sensitive users
  - WCAG 2.1 AA compliance for interactive elements

### Fixed

- **Milkdown Integration**: Fixed React 19 compatibility issue
  - Moved `useEditor` hook inside `MilkdownProvider` context
  - Added ProseMirror CSS (`white-space: pre-wrap`)
  - Resolved `setEditorFactory is not a function` error
- **Test Mocks**: Fixed `triggerMuseIntervention` mock in `useManualTrigger.test.ts`
- **ESLint**: Removed unused `container` variables in test files

### Changed

- **App Layout**: 更正前一条历史记录——`SensoryFeedbackDemo` 存在但未挂载，从未加入主应用布局；测试请直接针对组件本身。

## [0.1.0] - P1 Core Features (2025-11-06)

### Added

- **Un-deletable Lock System**: Core P1 functionality
  - Lock enforcement via ProseMirror transaction filtering
  - Lock persistence through Markdown comments
  - Lock state management with `LockManager` service
- **AI Intervention System**:
  - **Muse Mode**: STUCK detection → AI Provoke action (automatic, 60s delay)
  - **Loki Mode**: Random interventions (Provoke or Delete)
  - Safety guards: Prevents DELETE on short context (<50 chars)
- **Backend API** (FastAPI):
  - `/impetus/generate-intervention` endpoint
  - Idempotency cache (TOCTOU protection, thread-safe)
  - Contract versioning support
  - Health check endpoint
- **Frontend** (React + Vite + TypeScript):
  - Milkdown rich text editor with Commonmark support
  - Mode selector (Off / Muse / Loki)
  - Lock visualization in editor
- **Testing**:
  - Backend: 40 pytest tests (100% passing)
  - Frontend: 94 Vitest tests (100% passing)
  - Comprehensive test coverage for lock enforcement
- **Documentation**:
  - Architecture documentation
  - API contract specifications
  - Constitutional principles (CLAUDE.md)

---

## Notes

- **P1 Features**: Core un-deletable constraint functionality (locked content enforcement)
- **P2 Features**: UX enhancements (manual trigger, sensory feedback) - current release
- **Constitutional Compliance**: All features follow project constitution ([CLAUDE.md](CLAUDE.md#constitutional-requirements-️))
  - Article I: Simplicity & Anti-Abstraction
  - Article II: Vibe-First Imperative (P1 = un-deletable only)
  - Article III: Test-First Imperative (TDD workflow)
  - Article IV: SOLID Principles
  - Article V: Clear Comments & Documentation
