# Technical Debt Report

**Project**: Impetus Lock  
**Report Date**: 2026-04-09  
**Author**: Tech Lead  
**Status**: Pre-Team-Scaling Assessment

---

## Executive Summary

This report identifies technical debt across the Impetus Lock codebase before team scaling. The project is a 5-day MVP that has evolved beyond its original scope, accumulating debt in testing, architecture enforcement, and documentation.

**Overall Debt Grade**: B- (Manageable but requires attention before scaling)

---

## 1. Code Quality Issues

### 1.1 Frontend Code Quality

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Magic numbers in components | Medium | `EditorCore.tsx`, `FloatingToolbar.tsx` | Maintainability |
| Complex component logic | Medium | `EditorCore.tsx` (~650 lines) | Testability, SRP |
| Missing error boundaries | Low | Async hook failures | User experience |
| ESLint ignore warning | Low | `eslint.config.js` | Tooling deprecation |

**Details**:
- `EditorCore.tsx` violates SRP by handling editor initialization, transaction filtering, sensory feedback, and manual delete operations
- Animation timing constants scattered across components (800ms, 1500ms, 1000ms)
- Some hooks lack comprehensive error handling for edge cases

### 1.2 Backend Code Quality

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Repository pattern inconsistency | Medium | `tasks.py` routes | Testability |
| Type adapter as module global | Low | `tasks.py:28` | Thread safety |
| Missing input sanitization | Medium | Content fields | Security |
| Alembic migration naming | Low | Migration files | Consistency |

**Details**:
- Routes directly use repository but some validation logic leaks into endpoints
- `_anchor_adapter` global may cause issues with concurrent requests
- Content fields lack XSS sanitization before storage

---

## 2. Architecture Pain Points

### 2.1 Frontend Architecture

```
Current: Components → Hooks → Services
Issues:
  - EditorCore.tsx bypasses hook layer for some operations
  - Sensory feedback logic split between hook and component
  - Transaction filter tightly coupled to EditorCore
```

**Specific Pain Points**:

1. **EditorCore God Component** (`client/src/components/Editor/EditorCore.tsx`)
   - 650+ lines of code
   - Responsibilities: Editor setup, lock enforcement, sensory feedback, manual delete, toolbar coordination
   - **Recommendation**: Extract into focused hooks (already partially done in `refactor/architecture-improvements` branch)

2. **Hook Dependencies**
   - `useTaskSync` depends on `useWritingState` timing
   - Circular dependency risk between writing state and intervention triggers
   - **Recommendation**: Define clear event bus or state machine

3. **Service Layer Inconsistency**
   - Some services use fetch, others use axios pattern
   - Error handling not standardized across services
   - **Recommendation**: Standardize on TaskAPIError pattern used in `taskClient.ts`

### 2.2 Backend Architecture

```
Current: API → Repository → Models
Strengths:
  - Repository pattern well-implemented
  - Clean separation between domain and infrastructure
Issues:
  - Missing service layer for business logic
  - No CQRS for read-heavy operations
  - Direct repository access from routes
```

**Specific Pain Points**:

1. **Missing Service Layer**
   - Business logic (optimistic locking, conflict resolution) in routes
   - `tasks.py` lines 255-276 contain business rules that should be in service
   - **Recommendation**: Introduce TaskService layer between routes and repository

2. **Repository Implementation Gap**
   - Only PostgreSQL implementation exists
   - No in-memory implementation for testing (despite interface supporting it)
   - Tests use real database or mocks inconsistently
   - **Recommendation**: Implement InMemoryTaskRepository for unit tests

3. **API Versioning**
   - No versioning strategy in place
   - Breaking changes will affect all clients
   - **Recommendation**: Add `/v1/` prefix to all routes

---

## 3. Test Coverage Gaps

### 3.1 Coverage Summary

| Component | Lines | Tests | Coverage | Status |
|-----------|-------|-------|----------|--------|
| Backend Source | 9,722 | 13,170 | ~58% | Below target |
| Frontend Source | ~15,000 | ~8,500 | ~65% | Below target |
| Critical Paths | - | - | ~80% | Meets target |

### 3.2 Backend Test Gaps

| Area | Coverage | Priority | Risk |
|------|----------|----------|------|
| Database resilience | 40% | High | Production stability |
| Circuit breaker logic | 35% | High | Failure handling |
| Repository edge cases | 50% | Medium | Data integrity |
| API error handling | 60% | Medium | Client experience |
| Authentication middleware | 45% | High | Security |

**Missing Test Scenarios**:
- Database connection failure recovery
- Circuit breaker state transitions
- Concurrent update conflicts (optimistic locking)
- PostgreSQL-specific constraint violations
- Rate limiting edge cases

### 3.3 Frontend Test Gaps

| Area | Coverage | Priority | Risk |
|------|----------|----------|------|
| Editor transaction filtering | 70% | High | Core feature |
| Sensory feedback system | 55% | Medium | UX consistency |
| Task sync conflict resolution | 60% | High | Data loss |
| Lock decoration rendering | 50% | Medium | Visual feedback |
| Mobile touch interactions | 30% | Low | Mobile support |

**Missing Test Scenarios**:
- Rapid edit/save cycles
- Network failure during auto-save
- Version conflict resolution UX
- Lock enforcement edge cases (partial selection)
- Accessibility (screen reader) interactions

---

## 4. Performance Bottlenecks

### 4.1 Frontend Performance

| Issue | Location | Impact | Mitigation |
|-------|----------|--------|------------|
| Re-render on every keystroke | `EditorCore.tsx` | High CPU | Debounce already applied (800ms) |
| Large document handling | Milkdown editor | Memory | No virtual scrolling |
| Animation queue buildup | `useSensoryFeedback` | Jank | Cancel-and-replace pattern helps |
| LocalStorage sync | `useTaskSync` | I/O | Async, non-blocking |

**Performance Metrics Needed**:
- Editor responsiveness at 10,000 words
- Memory usage during long sessions
- Animation frame drops during interventions

### 4.2 Backend Performance

| Issue | Location | Impact | Mitigation |
|-------|----------|--------|------------|
| N+1 query risk | `list_tasks` with count | Database | Current: fetch all + count |
| No query result caching | All endpoints | Latency | None implemented |
| Connection pool sizing | `database.py` | Concurrency | Environment-configurable |
| Missing database indexes | `tasks.content` | Search | No full-text search |

**Query Analysis**:
```python
# Current (tasks.py:153-157) - Inefficient for large datasets
all_tasks = await repository.list_tasks(limit=10000, offset=0)
total = len(all_tasks)  # Loads all tasks into memory
```

**Recommendation**: Add `count()` method to repository for efficient pagination.

---

## 5. Security Debt

| Issue | Severity | Location | Mitigation |
|-------|----------|----------|------------|
| No input sanitization | Medium | Content fields | Add bleach/cleaning |
| Missing rate limiting | High | Intervention endpoints | Implement in middleware |
| JWT secret rotation | Low | Auth config | Document process |
| No audit logging | Medium | All mutations | Add audit table |
| CORS configuration | Medium | `main.py` | Review for production |

---

## 6. Documentation Debt

| Area | Status | Gap |
|------|--------|-----|
| API documentation | Partial | Missing error response examples |
| Architecture decisions | Partial | ADRs not formalized |
| Onboarding guide | Outdated | Does not cover new patterns |
| Deployment guide | Missing | No production deployment docs |
| Troubleshooting | Partial | Common errors not documented |

---

## 7. Top 3 Technical Debt Priorities

### 7.1 P1: Implement Service Layer (Backend)

**Why**: Business logic currently in routes violates SRP and makes testing difficult.

**Scope**:
- Create `TaskService` class
- Move optimistic locking logic from routes
- Move conflict resolution from routes
- Update tests to use service mocks

**Effort**: 2-3 days  
**Risk if not addressed**: Increasing complexity, harder to test, regression risk

### 7.2 P2: Extract EditorCore Responsibilities (Frontend)

**Why**: 650-line component is difficult to maintain and test.

**Scope**:
- Complete hook extraction (in progress on `refactor/architecture-improvements`)
- Extract transaction filter configuration
- Extract toolbar coordination logic
- Add integration tests for composed behavior

**Effort**: 2 days  
**Risk if not addressed**: Bug fixes become risky, new features slow down

### 7.3 P3: Add Repository Count Method (Backend)

**Why**: Current pagination loads all tasks into memory.

**Scope**:
- Add `count_tasks()` to `TaskRepository` interface
- Implement in `PostgreSQLTaskRepository`
- Update `list_tasks` endpoint to use count
- Add tests for pagination edge cases

**Effort**: 1 day  
**Risk if not addressed**: Performance degradation with large datasets

---

## 8. Recommendations for Team Scaling

### 8.1 Immediate (Before New Developers)

1. **Complete architecture improvements branch** - Clean up EditorCore extraction
2. **Document coding standards** - Create `dev-standards.md`
3. **Set up pre-commit hooks** - Enforce linting and formatting
4. **Create architecture decision records** - Document key decisions

### 8.2 Short-term (First Sprint)

1. **Implement service layer** - Enable parallel backend development
2. **Add integration tests** - Cover critical user flows
3. **Set up staging environment** - Test deployments
4. **Create onboarding checklist** - Reduce ramp-up time

### 8.3 Medium-term (First Month)

1. **Add performance monitoring** - Identify real bottlenecks
2. **Implement caching layer** - Redis for query results
3. **Add error tracking** - Sentry or similar
4. **Create runbooks** - Incident response procedures

---

## Appendix: Debt Metrics

```
Code Quality:
- Backend lint errors: 0 (Ruff clean)
- Frontend lint errors: 0 (ESLint clean)
- Type errors (backend): 0 (mypy strict)
- Type errors (frontend): 0 (tsc strict)

Test Coverage:
- Backend test lines: 13,170
- Backend source lines: 9,722
- Frontend test files: 42
- Frontend source files: 143

Architecture:
- Import linter contracts: 3/3 passing
- Circular dependencies: None detected
- God classes: 1 (EditorCore.tsx)

Documentation:
- Public API docstrings: 95%
- JSDoc coverage: 90%
- Architecture docs: Partial
```

---

**Next Review**: 2026-04-23 (bi-weekly)
