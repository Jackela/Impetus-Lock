# Research Document: Markdown Toolbar Integration

**Feature**: 005-markdown-toolbar  
**Created**: 2025-11-08  
**Status**: Complete

## Executive Summary

**Current Milkdown Version**: 7.17.1  
**Approach**: React component-based floating toolbar (no custom Milkdown plugin required)  
**Complexity**: P2 (moderate) - simpler than lock enforcement system  
**Estimated Time**: 2-4 hours core implementation, 1-2 hours polish

---

## Decision 1: Toolbar Implementation Pattern

**Decision**: Use React component with direct Milkdown command execution (no custom plugin)

**Rationale**:
- Aligns with Article I (Simplicity): Leverages framework-native features
- Existing `EditorCore.tsx` already provides ProseMirror access patterns
- No need for `@milkdown/utils` plugin abstraction layer
- Faster development for 5-day MVP sprint

**Alternatives Considered**:
- **Custom Milkdown Plugin**: More reusable but adds complexity; rejected for MVP sprint
- **Third-party Menu Plugin**: None exist for Milkdown v7 (removed in v7 migration)

**Implementation Pattern**:
```typescript
// FloatingToolbar.tsx - React component
export const FloatingToolbar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  // 1. Track selection changes via ProseMirror transaction interception
  // 2. Show/hide based on selection.empty
  // 3. Execute commands via callCommand utility
  // 4. Track active states via hasMark helper
};

// Integration in EditorCore.tsx
<Milkdown />
<FloatingToolbar editor={editorInstance} />
```

---

## Decision 2: Selection Detection Strategy

**Decision**: Intercept ProseMirror dispatch to track selection changes

**Rationale**:
- Pattern already exists in `EditorCore.tsx` (lines 219-233) for transaction filtering
- Provides real-time updates without polling
- Efficient (only triggers on actual selection changes)

**Implementation Pattern** (from existing codebase):
```typescript
editor.action((ctx) => {
  const view = ctx.get(editorViewCtx);
  const originalDispatch = view.dispatch.bind(view);

  view.dispatch = (tr) => {
    if (tr.selectionSet || tr.docChanged) {
      const { from, to, empty } = tr.selection;
      setIsVisible(!empty); // Show toolbar only when text selected
      updatePosition(from, to); // Update floating position
      updateActiveStates(tr.selection); // Update button states
    }
    originalDispatch(tr);
  };
});
```

**Alternatives Considered**:
- **DOM Selection API**: Less reliable for ProseMirror; rejected
- **Polling**: Inefficient; rejected

---

## Decision 3: Command Execution

**Decision**: Use `callCommand` utility from `@milkdown/utils` with preset-commonmark commands

**Available Commands** (from `@milkdown/preset-commonmark@7.17.1`):
- `toggleStrongCommand` → Bold
- `toggleEmphasisCommand` → Italic
- `wrapInHeadingCommand` → Heading (accepts level 1-6)
- `wrapInBulletListCommand` → Bullet list

**Execution Pattern**:
```typescript
import { callCommand } from '@milkdown/utils';
import { toggleStrongCommand } from '@milkdown/preset-commonmark';

const handleBold = () => {
  editor?.action(callCommand(toggleStrongCommand.key));
};

// For commands with parameters (e.g., heading level):
const handleH2 = () => {
  editor?.action(callCommand(wrapInHeadingCommand.key, 2));
};
```

**Critical Detail**: Use `onMouseDown` with `preventDefault()` to avoid losing selection:
```typescript
<button
  onMouseDown={(e) => {
    e.preventDefault();      // Prevent default browser behavior
    e.stopPropagation();     // Stop event bubbling
    handleBold();            // Execute command
  }}
>
  Bold
</button>
```

**Rationale**:
- `onClick` fires after `mouseup`, which clears the text selection
- `onMouseDown` + `preventDefault()` preserves selection while executing command

---

## Decision 4: Active State Tracking

**Decision**: Use `hasMark` helper function to check mark/node types in ProseMirror state

**Implementation**:
```typescript
/**
 * Check if a mark type is active in current selection.
 * Handles both cursor (empty) and text selection cases.
 */
function hasMark(state: EditorState, markType: MarkType): boolean {
  if (!markType) return false;
  const { from, $from, to, empty } = state.selection;
  
  if (empty) {
    // Cursor position: check stored marks or marks at cursor
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }
  
  // Text selection: check range
  return state.doc.rangeHasMark(from, to, markType);
}

// Usage in selection handler:
const strongType = state.schema.marks.strong;
const emphasisType = state.schema.marks.emphasis;

setActiveStates({
  bold: hasMark(state, strongType),
  italic: hasMark(state, emphasisType),
  heading: state.selection.$from.parent.type.name === 'heading',
  bulletList: state.selection.$from.parent.type.name === 'bullet_list',
});
```

**Rationale**:
- **Marks** (bold, italic): Use `hasMark` helper
- **Nodes** (heading, list): Check parent node type name
- Handles both empty selection (cursor) and non-empty selection (text)

**Alternatives Considered**:
- **Track via transaction**: More complex; rejected for simplicity

---

## Decision 5: Floating Positioning Strategy

**Decision**: Use Floating UI library (already available via Milkdown dependencies)

**Rationale**:
- `@floating-ui/dom` already included with Milkdown v7.17.1
- Handles viewport overflow automatically (flip, shift middleware)
- Industry standard (used by Tiptap, Headless UI, etc.)

**Implementation Pattern**:
```typescript
import { computePosition, flip, offset, shift } from '@floating-ui/dom';

const updatePosition = () => {
  const { from, to } = selection;
  const start = editorView.coordsAtPos(from);
  const end = editorView.coordsAtPos(to);

  // Create virtual element for Floating UI
  const virtualElement = {
    getBoundingClientRect: () => ({
      width: end.left - start.left,
      height: end.bottom - start.top,
      x: start.left,
      y: start.top,
      top: start.top,
      left: start.left,
      right: end.left,
      bottom: end.bottom,
    }),
  };

  // Position toolbar above selection
  computePosition(virtualElement, toolbarRef.current!, {
    placement: 'top',
    middleware: [
      offset(8),       // 8px gap from selection
      flip(),          // Flip to bottom if overflows top
      shift({ padding: 8 }), // Keep within viewport horizontally
    ],
  }).then(({ x, y }) => {
    Object.assign(toolbarRef.current!.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  });
};
```

**Alternatives Considered**:
- **Manual DOM Rect Calculation**: Simpler but doesn't handle viewport overflow; rejected for production quality
- **CSS Position Sticky**: Doesn't follow selection; rejected

---

## Decision 6: Lock Enforcement Integration

**Decision**: Toolbar must respect existing lock enforcement system from P1-P3 features

**Approach**: Commands execute through Milkdown's built-in transaction filtering, which already hooks into lock enforcement (EditorCore.tsx lines 219-233)

**Verification Needed**:
- Test that formatting locked content triggers rejection behavior
- Ensure toolbar buttons are disabled/inactive when selection contains locked content

**Implementation Note**: No additional code required if lock enforcement properly filters formatting transactions (to be verified in testing)

---

## Technical Dependencies

### Current Dependencies (from client/package.json)
```json
{
  "@milkdown/core": "^7.17.1",
  "@milkdown/preset-commonmark": "^7.17.1",
  "@milkdown/prose": "^7.17.1",
  "@milkdown/react": "^7.17.1",
  "@milkdown/utils": "^7.17.1",
  "@milkdown/plugin-listener": "^7.17.1"
}
```

**No additional dependencies required** - all necessary APIs are available.

### Key APIs Used
- **ProseMirror**: `EditorState`, `EditorView`, `MarkType`, `NodeType`
- **Milkdown**: `callCommand`, `editorViewCtx`, `Editor`
- **Floating UI**: `computePosition`, `flip`, `offset`, `shift`
- **React**: `useState`, `useEffect`, `useRef`, `useCallback`

---

## Existing Codebase Patterns

### EditorCore.tsx Integration Points

**File**: `client/src/components/Editor/EditorCore.tsx`

**Relevant Patterns**:
1. **Editor Instance Access** (line 236):
   ```typescript
   const editor = editorRef.current?.get();
   ```

2. **Transaction Interception** (lines 219-233):
   ```typescript
   const view = ctx.get(editorViewCtx);
   const originalDispatchTransaction = view.dispatch.bind(view);
   view.dispatch = (tr) => { /* custom logic */ };
   ```

3. **Lock Enforcement Filter** (lines 241-298):
   - Filters `delete` transactions
   - Triggers sensory feedback on rejection
   - **Pattern to reuse**: Toolbar formatting should respect same lock enforcement

**Modification Required**: Store editor instance in state to pass to FloatingToolbar component

---

## Constitutional Compliance

### Article I: Simplicity & Anti-Abstraction ✅
- Uses framework-native Milkdown/ProseMirror APIs
- No custom plugin abstraction layer
- Reuses existing transaction interception pattern

### Article III: Test-First Imperative ✅
- Test scenarios defined:
  1. Toolbar visibility on selection
  2. Command execution (bold, italic, heading, list)
  3. Active state tracking
  4. Lock enforcement integration
  5. Positioning (basic validation)

### Article IV: SOLID Principles ✅
- **SRP**: FloatingToolbar component handles only toolbar UI/logic
- **DIP**: Depends on Editor abstraction, not concrete implementation

### Article V: Clear Comments & Documentation ✅
- JSDoc comments required for exported functions
- Implementation includes inline documentation

---

## Performance Considerations

**Selection Tracking**: Debounce position updates to avoid excessive re-renders:
```typescript
let timeoutId: number;
const debouncedUpdate = () => {
  clearTimeout(timeoutId);
  timeoutId = window.setTimeout(updatePosition, 100); // 100ms debounce
};
```

**React Optimization**:
- Use `useCallback` for command handlers
- Memoize active state calculations if performance issues arise
- Consider `React.memo` for toolbar component if re-renders are excessive

**Estimated Impact**: Minimal - toolbar only active during text selection (uncommon during writing flow)

---

## External Documentation References

### Milkdown Official Docs
- Commands Guide: https://milkdown.dev/docs/guide/commands
- Preset Commonmark API: https://milkdown.dev/docs/api/preset-commonmark
- Using Plugins: https://milkdown.dev/docs/plugin/using-plugins

### ProseMirror Community
- Selection Tracking: https://discuss.prosemirror.net/t/the-proper-way-of-checking-mark-activity/3410
- Bubble Menu Pattern: https://discuss.prosemirror.net/t/floating-menu-bubble-menu/2313

### Floating UI
- Documentation: https://floating-ui.com/
- Middleware: https://floating-ui.com/docs/middleware

### Reference Implementations
- Tiptap BubbleMenu: https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu
- ProseMirror Menu Example: https://prosemirror.net/examples/menu/

---

## Next Steps (Phase 1: Design & Contracts)

1. **Data Model**: Define toolbar state interface (minimal - just button states)
2. **API Contracts**: N/A (no backend API required for toolbar)
3. **Component Contracts**: Define FloatingToolbar props interface
4. **Integration Plan**: Update EditorCore.tsx to expose editor instance

**Estimated Effort**: 1-2 hours (simple UI state, no persistence)
