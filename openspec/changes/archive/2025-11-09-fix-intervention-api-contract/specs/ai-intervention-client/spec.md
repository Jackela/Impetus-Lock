# ai-intervention-client Specification Delta

## Purpose
Frontend client for AI intervention API communication, providing contract-compliant request/response handling for Muse and Loki modes.

## ADDED Requirements

### Requirement: API Contract Compliance

The intervention client SHALL construct API requests that exactly match the backend Pydantic schema for `/impetus/generate-intervention`.

**Rationale**: Prevents validation errors (HTTP 422) and ensures reliable AI intervention functionality.

#### Scenario: Send Context as Plain Text String

**Given** the user has typed content in the editor
**And** the user triggers AI intervention (Muse or Loki mode)
**When** the client constructs the API request
**Then** the system SHALL:
- Extract complete document text from the editor
- Send `context` field as a **string** (not an object)
- Exclude any cursor position metadata from the `context` field

**Acceptance Criteria**:
- Request JSON has `"context": "string"`
- NOT `"context": {"context_window": "...", "cursor_position": 0}`
- Context string contains full document text (all user-entered content)

---

#### Scenario: Include Required client_meta Fields

**Given** the user triggers AI intervention
**When** the client constructs the API request
**Then** the system SHALL include `client_meta` with all required fields:
- `doc_version` (number): Document version for optimistic concurrency control
- `selection_from` (number): Selection start position (cursor position if no selection)
- `selection_to` (number): Selection end position (cursor position if no selection)

**Acceptance Criteria**:
- All three fields present in request JSON
- Fields are non-negative integers
- Request validates against backend schema (no HTTP 422)

**Example Request**:
```json
{
  "context": "Welcome to Impetus Lock\n\nStart writing...",
  "mode": "muse",
  "client_meta": {
    "doc_version": 1,
    "selection_from": 42,
    "selection_to": 42
  }
}
```

---

### Requirement: Editor State Extraction

The intervention client SHALL extract necessary data from the Milkdown editor instance.

**Rationale**: Provides backend with context needed for AI-generated interventions.

#### Scenario: Extract Plain Text from Editor

**Given** the editor contains formatted Markdown content
**When** intervention is triggered
**Then** the system SHALL:
- Use Milkdown editor API to get plain text representation
- Preserve line breaks and basic structure
- Exclude editor metadata (formatting marks, internal state)

**Acceptance Criteria**:
- Extracted text matches user-visible content
- Markdown formatting (bold, italic, headers) preserved as plain text syntax
- No internal editor state leaked in context string

---

#### Scenario: Extract Cursor and Selection State

**Given** the user has positioned the cursor or made a selection
**When** intervention is triggered
**Then** the system SHALL:
- Determine current cursor position (character offset from document start)
- If selection exists, capture `selection_from` and `selection_to`
- If no selection, set both to cursor position

**Acceptance Criteria**:
- Cursor position is non-negative integer
- `selection_from <= selection_to` (always valid range)
- Position calculation handles multi-byte characters correctly (UTF-8)

---

### Requirement: Document Version Tracking

The intervention client SHALL maintain a document version counter for optimistic concurrency control.

**Rationale**: Allows backend to detect stale requests when multiple interventions are in flight.

#### Scenario: Increment Version on Edits

**Given** the document has `doc_version = N`
**When** the user makes any edit (insert, delete, format)
**Then** the system SHALL:
- Increment `doc_version` to `N+1`
- Store new version in editor state or React state

**Acceptance Criteria**:
- Version increments monotonically
- Version persists across component re-renders (if using React state)
- Each API request includes current version

---

#### Scenario: Initialize Version on Mount

**Given** the editor component is mounting
**When** initialization completes
**Then** the system SHALL:
- Set initial `doc_version = 0`
- Increment to `1` on first user edit

**Acceptance Criteria**:
- Initial version is `0`
- First API request after user edit has `doc_version >= 1`

---

### Requirement: Error Handling for API Validation Failures

The intervention client SHALL handle HTTP 422 validation errors gracefully.

**Rationale**: Provides user feedback when contract violations occur (e.g., during development).

#### Scenario: Display Validation Error to User

**Given** the API request fails validation (HTTP 422)
**When** the response is received
**Then** the system SHALL:
- Trigger sensory feedback (red flash + buzz sound)
- Log detailed error to console for debugging
- NOT crash or freeze the editor

**Acceptance Criteria**:
- User sees visual/audio error feedback
- Console shows Pydantic validation error details
- Editor remains interactive after error

---

## MODIFIED Requirements

_None - This is a new specification for existing functionality._

---

## REMOVED Requirements

_None_

---

## RENAMED Requirements

_None_

---

## Non-Functional Requirements

### NFR-001: Type Safety
- All API request/response types SHALL use TypeScript interfaces
- No `any` types in intervention client code
- Request/response types SHALL match backend Pydantic models exactly

### NFR-002: Performance
- API request construction SHALL complete in <50ms
- Editor state extraction SHALL not block UI thread
- Document version updates SHALL be synchronous (no async needed)

### NFR-003: Testability
- Client logic SHALL be unit-testable without live backend
- Mock editor API for tests (stub `getText()`, `getCursorPosition()`)
- Request construction SHALL be pure function (no side effects)

---

## Success Criteria Summary

**Definition of Done**:
- ✅ `generateIntervention()` sends `context` as string
- ✅ `client_meta` includes `doc_version`, `selection_from`, `selection_to`
- ✅ API requests return HTTP 200 OK (not 422)
- ✅ AI responses appear correctly in editor
- ✅ Unit tests cover contract compliance
- ✅ MCP E2E tests validate real browser interaction
- ✅ TypeScript compilation with no errors
- ✅ ESLint/Prettier passing
