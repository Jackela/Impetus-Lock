## 1. Validation & Context
- [x] 1.1 Run `openspec validate refactor-agentic-hardening --strict` (after drafting)

## 2. Backend Resilience
- [x] 2.1 Add TESTING/debug no-DB fallback (in-memory stub) when DATABASE_URL missing
- [x] 2.2 Keep dev-start Postgres path unchanged; document the fallback
- [x] 2.3 Make contract-version handling backward-compatible and emit server version header
- [x] 2.4 Wire optional TaskRepository into intervention route/service; add tests for with/without repo

## 3. Frontend Persistence & UX
- [x] 3.1 Add task API client for load/save (content + lock_ids + version)
- [x] 3.2 Load initial document/locks into editor; fallback to local storage if API fails
- [x] 3.3 Save on change with optimistic versioning; handle conflicts gracefully
- [x] 3.4 Keep timer indicator/editor-aligned styling compliant with spec; ensure lock hover a11y

## 4. Testing
- [x] 4.1 Backend: unit/integration tests covering no-DB fallback, contract header, repo persistence path
- [x] 4.2 Frontend: unit/e2e covering load/save, offline fallback, timer/lock visuals

## 5. Documentation
- [x] 5.1 Update README/DEVELOPMENT/dev-start notes for fallback mode
- [x] 5.2 Summarize change in CHANGELOG/SESSION summary
