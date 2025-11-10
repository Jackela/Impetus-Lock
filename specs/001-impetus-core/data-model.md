# Data Model: Impetus Lock Core - Agent Intervention System

**Feature**: Impetus Lock Core  
**Date**: 2025-11-06  
**Status**: Phase 1 - Design & Contracts

---

## Overview

This document defines the core entities, types, and state machines for the Impetus Lock Agent Intervention System. All entities are derived from functional requirements in [spec.md](spec.md).

---

## Core Entities

### 1. LockBlock (锁定块)

A text block marked as un-deletable by the AI Agent.

**Entity Definition**:
```typescript
interface LockBlock {
  lock_id: string;        // UUID v4, unique identifier
  content: string;        // Markdown blockquote content (e.g., "> Muse 注入：门后是一堵砖墙。")
  source: AgentMode;      // Origin mode: "muse" | "loki"
  created_at: number;     // Unix timestamp (milliseconds)
  is_deletable: false;    // Constant - always false
}
```

**Persistence Strategy**:
- Primary: Embedded in Markdown as HTML comment: `<!-- lock:550e8400-e29b-41d4-a716-446655440000 -->`
- Backup: `localStorage` key `impetus-locks` (JSON array of lock_ids)

**Lifecycle**:
1. **Creation**: AI Provoke action → Backend returns lock_id → Frontend injects content with lock marker
2. **Enforcement**: ProseMirror `filterTransaction` checks lock_id → blocks delete/modify operations
3. **Persistence**: On document save → lock_id written to Markdown comment → restored on page load

**Validation Rules** (from FR-001, FR-002, FR-005):
- `lock_id` MUST be UUID v4 format
- `content` MUST be valid Markdown blockquote starting with `> `
- `is_deletable` MUST always be `false`
- `created_at` MUST be set on creation, immutable thereafter

---

### 2. WritingState (写作状态)

User's current writing activity state, tracked by frontend state machine.

**Enum Definition**:
```typescript
enum WritingState {
  WRITING = "WRITING",  // User typed within last 5 seconds
  IDLE = "IDLE",        // User stopped typing 5-60 seconds ago
  STUCK = "STUCK"       // User stopped typing >60 seconds ago (triggers Muse intervention)
}
```

**State Machine Diagram**:
```
┌─────────┐
│ WRITING │ ◄──────────────────┐
└────┬────┘                    │
     │ (5s no input)           │ (any input)
     ▼                         │
┌─────────┐                    │
│  IDLE   │ ───────────────────┘
└────┬────┘
     │ (60s no input)
     ▼
┌─────────┐
│ STUCK   │ ──► Trigger Muse Intervention
└─────────┘
```

**Transition Rules** (from FR-006, FR-007):
- `WRITING → IDLE`: After 5 seconds with no input
- `IDLE → STUCK`: After 60 seconds total with no input
- `IDLE → WRITING`: User resumes typing
- `STUCK → WRITING`: User types after intervention (or manually)

**Implementation Notes**:
- State checked via `setInterval` every 1 second
- Last input timestamp tracked via `Date.now()` on every keystroke
- State transitions trigger side effects (STUCK → API call)

---

### 3. InterventionAction (介入行动)

AI Agent's decision on how to intervene, returned by backend API.

**Entity Definition**:
```typescript
interface InterventionAction {
  action: "provoke" | "delete";  // Action type
  content?: string;               // Markdown blockquote (only for "provoke")
  lock_id?: string;               // UUID v4 (only for "provoke")
  anchor?: Anchor;                // Target location (only for "delete")
  action_id: string;              // UUID v4, unique action identifier
  issued_at: number;              // Unix timestamp (milliseconds)
}
```

**Action Types**:

1. **"provoke"** (施压注入):
   - Injects `content` at cursor position
   - Applies `lock_id` to make content un-deletable
   - Triggers "Glitch" animation + "Clank" sound
   
2. **"delete"** (强制删除):
   - Removes text at position/range specified by `anchor`
   - Bypasses Undo stack (cannot be reversed with Ctrl+Z)
   - Triggers fade-out animation + "Whoosh" sound

**Validation Rules** (from FR-013, FR-017):
- `action` MUST be exactly "provoke" or "delete"
- If `action === "provoke"`: `content` and `lock_id` MUST be present, `anchor` MUST be absent
- If `action === "delete"`: `anchor` MUST be present, `content` and `lock_id` MUST be absent
- `action_id` MUST be unique per intervention (used for idempotency)

---

### 4. Anchor (锚点)

Specifies a target location in the document for AI actions.

**Union Type Definition**:
```typescript
type Anchor = AnchorPos | AnchorRange | AnchorLockId;

interface AnchorPos {
  type: "pos";
  from: number;  // ProseMirror absolute position (0-indexed)
}

interface AnchorRange {
  type: "range";
  from: number;  // Start position (inclusive)
  to: number;    // End position (exclusive)
}

interface AnchorLockId {
  type: "lock_id";
  ref_lock_id: string;  // Reference to existing lock_id to delete
}
```

**Use Cases**:

1. **AnchorPos**: Inject content at cursor position
   ```json
   { "type": "pos", "from": 1234 }
   ```

2. **AnchorRange**: Delete text range (e.g., last sentence)
   ```json
   { "type": "range", "from": 1289, "to": 1310 }
   ```

3. **AnchorLockId**: Remove previously injected lock (Loki chaos)
   ```json
   { "type": "lock_id", "ref_lock_id": "lock_550e8400-e29b-41d4-a716-446655440000" }
   ```

**Validation Rules** (from Edge Cases section):
- `from` and `to` MUST be non-negative integers
- `from` MUST be < document length
- For `range`: `from` MUST be < `to`
- For `lock_id`: `ref_lock_id` MUST reference an existing lock

**Error Handling**:
- If anchor position is out of bounds → Log error, show user-friendly toast, abort action
- If referenced lock_id doesn't exist → Treat as no-op (lock may have been manually removed)

---

### 5. AgentMode (Agent 模式)

User's selected Agent working mode.

**Enum Definition**:
```typescript
enum AgentMode {
  MUSE = "muse",    // Strict mentor mode (STUCK-triggered interventions)
  LOKI = "loki",    // Chaos mode (random-triggered interventions)
  OFF = "off"       // Agent disabled (normal editor)
}
```

**Mode Behaviors**:

| Mode | Trigger | Action Types | Can be Undo'd? |
|------|---------|--------------|----------------|
| **muse** | STUCK detection (60s idle) | "provoke" only | No |
| **loki** | Random timer (30-120s) | "provoke" or "delete" | No |
| **off** | N/A | N/A | N/A |

**Mode Switching Rules** (from Edge Cases section):
- On mode change → Cancel all pending timers and API requests (via `AbortController`)
- Reset state machine to IDLE
- Existing locks remain enforced (mode change doesn't unlock content)

---

## State Machine: Muse Mode STUCK Detection

**Purpose**: Track user writing activity to detect "stuck" moments.

**State Diagram**:
```
                    ┌──────────────────┐
                    │   Mode: muse     │
                    │   Timer: 0s      │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
           ┌────────┤     WRITING     │◄────────┐
           │        │  (typing active) │         │
           │        └────────┬─────────┘         │
           │                 │                   │
           │                 │ 5s no input       │ User types
           │                 ▼                   │
           │        ┌─────────────────┐          │
           │        │      IDLE       │──────────┘
           │        │  (paused 5-60s) │
           │        └────────┬─────────┘
           │                 │
           │                 │ 60s total idle
           │                 ▼
           │        ┌─────────────────┐
           │        │     STUCK       │──► Trigger API call
           │        │  (>60s idle)    │    POST /api/v1/impetus/generate-intervention
           │        └────────┬─────────┘    { mode: "muse", context: "..." }
           │                 │
           │                 │ API responds
           │                 ▼
           │        ┌─────────────────┐
           └────────┤  Inject Block   │
                    │  + Apply lock_id │
                    └──────────────────┘
```

**Implementation Details**:
- Timer checked every 1000ms via `setInterval`
- Last input time tracked via `lastInputTime` state variable
- On STUCK transition → Call intervention API with context (last 3 sentences before cursor)
- On API success → Inject returned content at cursor position
- On API failure → Show error toast, reset to IDLE (don't spam API)

---

## State Machine: Loki Mode Random Interventions

**Purpose**: Trigger chaotic interventions at unpredictable intervals.

**State Diagram**:
```
                    ┌──────────────────┐
                    │   Mode: loki     │
                    │ Schedule random  │
                    │ timer (30-120s)  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   WAITING       │
                    │ (countdown...)  │
                    └────────┬─────────┘
                             │
                             │ Timer fires
                             ▼
                    ┌─────────────────┐
                    │ Trigger API     │──► POST /api/v1/impetus/generate-intervention
                    │ call            │    { mode: "loki", context: "..." }
                    └────────┬─────────┘
                             │
                             │ API responds
                             ▼
                    ┌─────────────────┐
             ┌──────┤ Execute Action  │
             │      └────────┬─────────┘
             │               │
             ▼               ▼
    ┌─────────────┐  ┌─────────────┐
    │  "provoke"  │  │  "delete"   │
    │ Inject +    │  │ Remove text │
    │ lock_id     │  │ (bypass Undo)│
    └──────┬──────┘  └──────┬──────┘
           │                │
           └────────┬───────┘
                    │
                    ▼
           ┌─────────────────┐
           │ Schedule next   │
           │ random timer    │──► Loop back to WAITING
           │ (30-120s)       │
           └──────────────────┘
```

**Implementation Details**:
- Random interval generated using `crypto.getRandomValues()` for uniform distribution
- Timer scheduled via `setTimeout(() => { triggerLoki(); scheduleNext(); }, delay)`
- Loki triggers **regardless** of user typing state (unlike Muse)
- On API success → Execute action based on response type
- On API failure → Skip this intervention, schedule next timer anyway

**Safety Guard** (from FR-014):
- Before executing "delete" action → Check document length
- If remaining characters <50 → Backend MUST reject "delete", return "provoke" instead
- Frontend validates anchor bounds to prevent out-of-range errors

---

## API Request/Response Schemas

### Request: InterventionRequest

```typescript
interface InterventionRequest {
  context: string;           // Last N sentences before cursor (N=3 for Muse, full context for Loki)
  mode: AgentMode;           // "muse" | "loki"
  client_meta: {
    doc_version: number;     // Document version counter (for debugging)
    selection_from: number;  // Cursor position (ProseMirror pos)
    selection_to: number;    // Selection end (same as from if no selection)
  };
}
```

**Headers**:
- `Idempotency-Key`: UUID v4 (prevents duplicate interventions on retry)
- `X-Contract-Version`: "1.0.1" (API contract version)

### Response: InterventionResponse

```typescript
interface InterventionResponse {
  action: "provoke" | "delete";
  content?: string;               // Markdown blockquote (only for "provoke")
  lock_id?: string;               // UUID v4 (only for "provoke")
  anchor?: Anchor;                // Target location (only for "delete")
  action_id: string;              // UUID v4
}
```

**HTTP Status Codes** (from FR-017):
- `200 OK`: Success, response body contains InterventionResponse
- `400 Bad Request`: Invalid anchor (out of bounds)
- `422 Unprocessable Entity`: Request body validation failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Backend/LLM failure

---

## Entity Relationships

```
┌──────────────┐
│   AgentMode  │ (User selects mode)
└──────┬───────┘
       │
       ├─── "muse" ──► WritingState state machine ──► STUCK ──► InterventionAction ("provoke")
       │
       └─── "loki" ──► Random timer ──────────────────────────► InterventionAction ("provoke" | "delete")
                                                                           │
                                                                           ▼
                                                                    ┌──────────────┐
                                                                    │  LockBlock   │
                                                                    │ (if provoke) │
                                                                    └──────────────┘
```

**Relationships**:
1. `AgentMode` determines which state machine is active
2. `WritingState` (Muse only) triggers `InterventionAction` on STUCK
3. `InterventionAction` creates `LockBlock` if action is "provoke"
4. `LockBlock` references its origin `AgentMode` via `source` field
5. `Anchor` (in "delete" actions) may reference existing `LockBlock` via `lock_id`

---

## Validation Summary

All entities and state machines are derived from and validated against:
- FR-001 to FR-027 (Functional Requirements)
- SC-001 to SC-010 (Success Criteria)
- Edge Cases section
- Assumptions section

**Next Steps**: Generate OpenAPI contract from these schemas in `contracts/intervention.yaml`.
