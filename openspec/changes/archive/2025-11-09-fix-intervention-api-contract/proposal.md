# Change Proposal: fix-intervention-api-contract

## Metadata
- **Change ID**: `fix-intervention-api-contract`
- **Type**: Bug Fix
- **Priority**: P0 (Blocking)
- **Affects Specs**: `ai-intervention-client`
- **Created**: 2025-11-09
- **Status**: Proposed

## Problem Statement

The AI intervention feature is currently broken due to an API contract mismatch between frontend and backend:

**Frontend sends** (`client/src/services/api/interventionClient.ts`):
```json
{
  "context": {
    "context_window": "Welcome to Impetus Lock\n\nStart writing...",
    "cursor_position": 0
  },
  "mode": "muse",
  "client_meta": {}
}
```

**Backend expects** (Pydantic validation):
```json
{
  "context": "string",
  "mode": "muse",
  "client_meta": {
    "doc_version": 0,
    "selection_from": 0,
    "selection_to": 0
  }
}
```

**Result**: All intervention requests fail with HTTP 422 Unprocessable Entity.

### Discovery Method

Issue discovered through **Chrome DevTools MCP real user testing**:
1. Opened browser at http://localhost:5175
2. Selected "Muse" mode
3. Clicked manual trigger button
4. Inspected network request (reqid=238) showing validation errors

**Error Details**:
```json
{
  "detail": [
    {
      "type": "string_type",
      "loc": ["body", "context"],
      "msg": "Input should be a valid string",
      "input": {"context_window": "...", "cursor_position": 0}
    },
    {
      "type": "missing",
      "loc": ["body", "client_meta", "doc_version"],
      "msg": "Field required"
    }
  ]
}
```

## Proposed Solution

Fix `interventionClient.ts` to match backend contract:

1. **Extract context string** from editor instead of sending object
2. **Add required client_meta fields**:
   - `doc_version`: Document version for optimistic concurrency
   - `selection_from`: Selection start position
   - `selection_to`: Selection end position

### Technical Approach

Modify `generateIntervention()` function to:
```typescript
// Extract plain text context from editor
const editorText = editor.getText();
const cursorPos = editor.getCursorPosition();

// Build proper request
const request = {
  context: editorText,  // String, not object
  mode: mode,
  client_meta: {
    doc_version: getDocVersion(),
    selection_from: cursorPos,
    selection_to: cursorPos
  }
};
```

## Validation Plan

**Must validate with Chrome DevTools MCP** (treating assistant as real user):

1. ✅ Start frontend (Vite) and backend (FastAPI/WSL)
2. ✅ Open http://localhost:5175 in browser
3. ✅ Type test content in editor
4. ✅ Click "Muse" mode manual trigger button
5. ✅ Inspect network request (should be 200 OK, not 422)
6. ✅ Verify AI response appears in editor
7. ✅ Test "Loki" mode as well
8. ✅ Check console for errors

**Success Criteria**:
- Network request shows HTTP 200 OK
- Request body matches backend schema
- AI-generated text appears in editor
- No console errors

## Impact Analysis

**User Impact**: HIGH
- Current state: AI intervention completely broken (P1 feature)
- After fix: Users can trigger AI assistance (Muse/Loki modes)

**Code Impact**: LOW
- Only affects `client/src/services/api/interventionClient.ts`
- No backend changes needed (backend is correct)
- No breaking changes to other features

**Testing Impact**: MEDIUM
- Must add MCP-based E2E test for intervention flow
- Update unit tests for `interventionClient.ts`

## Risks and Mitigation

**Risk**: Editor API might not provide required data
- **Mitigation**: Review Milkdown editor API docs for text/selection extraction

**Risk**: Document versioning logic might be complex
- **Mitigation**: Start with simple incrementing counter, refine later

## Dependencies

- ✅ Backend running on WSL (completed in previous session)
- ✅ Frontend dev server running
- ✅ Chrome DevTools MCP tools available

## Timeline

- **Implementation**: 1-2 hours
- **Testing**: 1 hour (manual + automated)
- **Review**: 30 minutes

## Approval Checklist

- [ ] Problem statement clear and validated
- [ ] Solution technically sound
- [ ] Validation plan includes MCP testing
- [ ] Impact assessed
- [ ] Timeline reasonable

---

**Next Steps After Approval**:
1. Read `tasks.md` for implementation checklist
2. Implement changes
3. Validate with MCP testing
4. Update specs with delta
