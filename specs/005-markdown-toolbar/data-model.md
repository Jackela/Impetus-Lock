# Data Model: Markdown Toolbar

**Feature**: 005-markdown-toolbar  
**Created**: 2025-11-08  
**Status**: Phase 1 Design

## Overview

This feature is **UI-only** with no persistent data. All state is ephemeral (React component state) and managed in-memory during the editor session.

**Storage**: None (no database, no localStorage, no sessionStorage)  
**State Management**: React component state only

---

## Type Definitions

### 1. ToolbarState

**Purpose**: Track active/inactive state for each formatting button.

**Type**: TypeScript interface

```typescript
/**
 * Active state tracking for toolbar buttons.
 * Maps each formatting action to its active status in current selection.
 */
interface ToolbarState {
  /** Bold formatting active (Ctrl+B, strong mark) */
  bold: boolean;
  
  /** Italic formatting active (Ctrl+I, emphasis mark) */
  italic: boolean;
  
  /** Heading 1 active (parent node is heading level 1) */
  h1: boolean;
  
  /** Heading 2 active (parent node is heading level 2) */
  h2: boolean;
  
  /** Bullet list active (parent node is bullet_list) */
  bulletList: boolean;
}
```

**State Source**: Derived from ProseMirror `EditorState` via `hasMark()` helper and parent node type checking.

**Update Frequency**: On every selection change (via transaction interception).

**Initial Value**:
```typescript
const initialToolbarState: ToolbarState = {
  bold: false,
  italic: false,
  h1: false,
  h2: false,
  bulletList: false,
};
```

---

### 2. FloatingToolbarProps

**Purpose**: Component props interface for FloatingToolbar React component.

**Type**: TypeScript interface

```typescript
import type { Editor } from '@milkdown/core';

/**
 * Props for FloatingToolbar component.
 */
interface FloatingToolbarProps {
  /** Milkdown editor instance (null during initialization) */
  editor: Editor | null;
  
  /** Optional: Custom className for styling override */
  className?: string;
  
  /** Optional: Custom z-index for stacking context (default: 1000) */
  zIndex?: number;
}
```

**Usage**:
```typescript
<FloatingToolbar 
  editor={editorInstance} 
  className="custom-toolbar"
  zIndex={1500}
/>
```

---

### 3. FormattingCommand

**Purpose**: Type definition for command handler functions.

**Type**: TypeScript type alias

```typescript
/**
 * Handler function for formatting commands.
 * No parameters, no return value (commands executed via Milkdown action).
 */
type FormattingCommand = () => void;
```

**Examples**:
```typescript
const handleBold: FormattingCommand = () => {
  editor?.action(callCommand(toggleStrongCommand.key));
};

const handleH2: FormattingCommand = () => {
  editor?.action(callCommand(wrapInHeadingCommand.key, 2));
};
```

---

### 4. ToolbarPosition

**Purpose**: Track floating toolbar position (managed by Floating UI).

**Type**: TypeScript interface

```typescript
/**
 * Toolbar position coordinates (absolute positioning).
 * Managed by Floating UI library.
 */
interface ToolbarPosition {
  /** X coordinate (left edge) in pixels */
  x: number;
  
  /** Y coordinate (top edge) in pixels */
  y: number;
}
```

**State Source**: Calculated by Floating UI `computePosition()` based on text selection coordinates.

**Update Frequency**: On every selection position change (debounced to 100ms).

**Initial Value**:
```typescript
const initialPosition: ToolbarPosition = { x: 0, y: 0 };
```

---

### 5. ToolbarVisibility

**Purpose**: Track toolbar show/hide state.

**Type**: TypeScript primitive (boolean)

```typescript
/**
 * Toolbar visibility state.
 * - `true`: Toolbar is visible (text selected)
 * - `false`: Toolbar is hidden (no text selected)
 */
type ToolbarVisibility = boolean;
```

**State Source**: Derived from ProseMirror transaction `selection.empty` property.

**Update Frequency**: On every transaction with `selectionSet` or `docChanged` flag.

**Initial Value**: `false` (toolbar hidden on mount)

---

## ProseMirror Helper Types

### 6. HasMarkFunction

**Purpose**: Type signature for `hasMark()` helper function.

**Type**: TypeScript function type

```typescript
import type { EditorState, MarkType } from '@milkdown/prose';

/**
 * Check if a mark type is active in current selection.
 * Handles both cursor position (empty selection) and text range selection.
 * 
 * @param state - ProseMirror editor state
 * @param markType - Mark type to check (e.g., strongType, emphasisType)
 * @returns `true` if mark is active, `false` otherwise
 */
type HasMarkFunction = (state: EditorState, markType: MarkType) => boolean;
```

**Implementation Location**: `client/src/utils/prosemirror-helpers.ts`

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     ProseMirror Transaction                  │
│                  (selection change detected)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├──► selection.empty → ToolbarVisibility (boolean)
                      │
                      ├──► selection.from/to → coordsAtPos() → ToolbarPosition {x, y}
                      │
                      └──► hasMark() + node.type.name → ToolbarState {bold, italic, ...}
                      
                      ↓
                      
┌─────────────────────────────────────────────────────────────┐
│              FloatingToolbar Component State                 │
│  - isVisible: boolean                                        │
│  - position: { x: number, y: number }                       │
│  - activeStates: ToolbarState                               │
└─────────────────────────────────────────────────────────────┘
                      
                      ↓
                      
         User clicks button → FormattingCommand executed
                      
                      ↓
                      
        editor.action(callCommand(...)) → ProseMirror transaction
```

---

## No Persistent Data

**Confirmation**: This feature has zero persistent data requirements.

- ❌ No database tables or collections
- ❌ No API endpoints for data storage/retrieval
- ❌ No localStorage or sessionStorage
- ❌ No cookies or IndexedDB
- ❌ No file system writes

**State Lifetime**: Component mount to unmount (destroyed on editor close/refresh)

---

## Type Safety Guarantees

**TypeScript Strict Mode**: All interfaces enforce strict type checking.

**Runtime Type Guards**: Not required (no external data sources to validate).

**Null Safety**:
- `editor` prop is nullable (`Editor | null`) during initialization
- All editor interactions use optional chaining (`editor?.action(...)`)
- MarkType/NodeType checked for existence before usage

**Example Null-Safe Usage**:
```typescript
const handleBold: FormattingCommand = () => {
  if (!editor) {
    console.warn('Editor not initialized');
    return;
  }
  editor.action(callCommand(toggleStrongCommand.key));
};
```

---

## Dependencies

**Type Imports**:
```typescript
// Milkdown core types
import type { Editor } from '@milkdown/core';

// ProseMirror types (via @milkdown/prose)
import type { EditorState, MarkType, NodeType } from '@milkdown/prose/model';
import type { EditorView } from '@milkdown/prose/view';

// Floating UI types
import type { Placement, Middleware } from '@floating-ui/dom';

// React types
import type { FC, CSSProperties } from 'react';
```

**No Additional Type Dependencies**: All types available in existing package.json.

---

## Next Steps

1. ✅ **Phase 1: Data Model** - COMPLETE (this document)
2. 🔄 **Phase 1: Contracts** - Create `contracts/` directory with TypeScript interface files
3. 🔄 **Phase 1: Quickstart** - Create `quickstart.md` developer guide
4. 🔄 **Phase 1: Agent Context** - Run `update-agent-context.ps1`

**Current Phase**: Phase 1 (Design & Contracts) - contracts/ directory creation
