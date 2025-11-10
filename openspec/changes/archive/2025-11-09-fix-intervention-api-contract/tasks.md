# Implementation Tasks: fix-intervention-api-contract

## Overview
Fix API contract mismatch in intervention client to match backend schema.

## Prerequisites
- [ ] Backend running on WSL (port 8000)
- [ ] Frontend dev server running (port 5173)
- [ ] Chrome DevTools MCP available for testing

## Phase 1: Code Analysis & Preparation

### T1.1: Review Current Implementation
- [ ] Read `client/src/services/api/interventionClient.ts` completely
- [ ] Identify where `context` object is constructed
- [ ] Locate `client_meta` construction
- [ ] Document current data flow

### T1.2: Review Editor API
- [ ] Check Milkdown editor API for text extraction methods
- [ ] Find cursor/selection position APIs
- [ ] Determine document versioning approach

## Phase 2: Implementation (TDD)

### T2.1: Write Failing Tests First
- [ ] Create test file `client/src/services/api/interventionClient.test.ts`
- [ ] Test: `generateIntervention` sends `context` as string
- [ ] Test: `client_meta` includes required fields (`doc_version`, `selection_from`, `selection_to`)
- [ ] Test: Request matches backend schema exactly
- [ ] Run tests - verify they FAIL (RED)

### T2.2: Fix Context Extraction
- [ ] Modify `generateIntervention()` to extract plain text from editor
- [ ] Replace object `{context_window, cursor_position}` with string
- [ ] Ensure full document text is captured (not just selection)
- [ ] Run tests - verify context fix (PARTIAL GREEN)

### T2.3: Fix client_meta Fields
- [ ] Add `doc_version` field (start with simple counter or timestamp)
- [ ] Add `selection_from` field (cursor position or selection start)
- [ ] Add `selection_to` field (cursor position or selection end)
- [ ] Run tests - verify all fields present (GREEN)

### T2.4: Refactor
- [ ] Extract helper function for editor state extraction
- [ ] Add JSDoc comments explaining contract requirements
- [ ] Ensure type safety with TypeScript
- [ ] Run tests - still GREEN

## Phase 3: Integration Testing (MCP)

### T3.1: Backend Health Check
- [ ] Use MCP to verify backend is running
- [ ] Check `/health` endpoint returns 200 OK
- [ ] Verify database connection if needed

### T3.2: Muse Mode Testing
- [ ] Open http://localhost:5173 in Chrome DevTools MCP
- [ ] Type test content: "This is a test document for Muse mode."
- [ ] Select "Muse" mode from dropdown
- [ ] Click manual trigger button
- [ ] Inspect network request:
  - [ ] Verify HTTP 200 OK (not 422)
  - [ ] Check request body has `context` as string
  - [ ] Check `client_meta` has all 3 required fields
- [ ] Verify AI response appears in editor
- [ ] Check console for errors (should be none)

### T3.3: Loki Mode Testing
- [ ] Clear editor content
- [ ] Type test content: "Testing Loki mode randomness."
- [ ] Select "Loki" mode from dropdown
- [ ] Click manual trigger button
- [ ] Verify same validations as T3.2 (200 OK, correct schema, no errors)

### T3.4: Error Handling Testing
- [ ] Stop backend server
- [ ] Click trigger button
- [ ] Verify frontend shows appropriate error (red flash + buzz)
- [ ] Restart backend
- [ ] Verify recovery works

## Phase 4: Documentation & Cleanup

### T4.1: Update Code Comments
- [ ] Add JSDoc to `generateIntervention()` explaining contract
- [ ] Document `client_meta` field purposes
- [ ] Add inline comments for non-obvious logic

### T4.2: Update Types
- [ ] Ensure TypeScript interfaces match backend Pydantic models
- [ ] Add `GenerateInterventionRequest` interface if missing
- [ ] Verify no `any` types used

### T4.3: Spec Delta
- [ ] Create `spec-delta.md` documenting API contract
- [ ] Add scenarios for successful intervention
- [ ] Add scenarios for validation errors
- [ ] Document `client_meta` requirements

## Phase 5: Validation

### T5.1: Run All Tests
- [ ] Frontend unit tests: `cd client && npm run test`
- [ ] Frontend lint: `npm run lint`
- [ ] Frontend type-check: `npm run type-check`
- [ ] All should pass

### T5.2: OpenSpec Validation
- [ ] Run `openspec validate fix-intervention-api-contract --strict`
- [ ] Fix any issues reported
- [ ] Verify clean validation

### T5.3: Manual Smoke Test
- [ ] Fresh browser session
- [ ] Test Muse mode (3 different inputs)
- [ ] Test Loki mode (3 different inputs)
- [ ] Verify AI responses make sense
- [ ] Check network tab for any errors

## Completion Criteria

**All tasks checked** AND:
- ✅ Unit tests passing
- ✅ MCP testing shows 200 OK responses
- ✅ AI-generated text appears correctly
- ✅ No console errors
- ✅ TypeScript compilation clean
- ✅ ESLint/Prettier passing
- ✅ OpenSpec validation passing

## Notes

**Key Files to Modify**:
- `client/src/services/api/interventionClient.ts` (PRIMARY)
- `client/src/services/api/interventionClient.test.ts` (NEW)
- `openspec/changes/fix-intervention-api-contract/spec-delta.md` (NEW)

**Backend Files** (NO CHANGES - backend is correct):
- `server/server/api/routes/intervention.py`
- `server/server/models/intervention.py`

**Testing Strategy**:
- Unit tests for contract compliance
- MCP for real user interaction testing
- Manual smoke test for confidence

**Estimated Time**:
- Phase 1: 30 minutes
- Phase 2: 1 hour (TDD cycle)
- Phase 3: 1 hour (MCP testing)
- Phase 4: 30 minutes
- Phase 5: 30 minutes
- **Total**: ~3.5 hours
