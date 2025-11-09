# Quickstart Guide: Markdown Toolbar Implementation

**Feature**: 005-markdown-toolbar  
**Audience**: Developers implementing the floating toolbar  
**Prerequisites**: Familiarity with React 19, TypeScript, Milkdown v7, ProseMirror basics

---

## Glossary

**Key Terms**:
- **Transaction Interception**: Pattern for intercepting ProseMirror transactions by overriding `view.dispatch()`. Also referred to as "dispatch override" or "transaction filtering". Used for selection tracking and lock enforcement.
- **Zen mode**: Minimalist aesthetic established in P1-P3 features. Characterized by simple icons, consistent spacing, no decorative elements, and context-sensitive visibility.
- **Context-Sensitive Visibility**: Toolbar appears only when text is selected, hidden otherwise (maximizes minimalism and content focus).

---

## Prerequisites

### Knowledge Requirements

1. **React 19**: Component lifecycle, hooks (useState, useEffect, useRef, useCallback)
2. **TypeScript 5.7**: Strict mode, interfaces, type guards, optional chaining
3. **Milkdown v7**: Editor instance, command execution (`callCommand`), plugin system
4. **ProseMirror**: EditorState, EditorView, transactions, marks, nodes
5. **Floating UI**: Virtual elements, positioning middleware (flip, offset, shift)

### Environment Setup

**Required Tools**:
- Node.js 20+ (verify: `node --version`)
- npm 10+ (verify: `npm --version`)
- Git (verify: `git --version`)

**Clone and Setup**:
```bash
# Navigate to project root
cd D:\Code\Impetus-Lock

# Ensure on correct branch
git checkout 005-markdown-toolbar

# Install frontend dependencies (client directory only)
cd client
npm ci

# Verify dependencies
npm list @milkdown/core @milkdown/preset-commonmark @floating-ui/dom
```

**Expected Output**:
```
@milkdown/core@7.17.1
@milkdown/preset-commonmark@7.17.1
@floating-ui/dom@1.x.x (bundled with Milkdown)
```

---

## Development Workflow (TDD - NON-NEGOTIABLE)

**Article III: Test-First Imperative** - Write failing tests BEFORE implementation.

### Phase 1: Test Setup (Red)

**Step 1.1**: Create test file first
```bash
cd client
touch src/components/Editor/FloatingToolbar.test.tsx
```

**Step 1.2**: Write first failing test
```typescript
// FloatingToolbar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FloatingToolbar } from './FloatingToolbar';

describe('FloatingToolbar', () => {
  it('should be hidden when editor is null', () => {
    render(<FloatingToolbar editor={null} />);
    const toolbar = screen.queryByRole('toolbar');
    expect(toolbar).not.toBeInTheDocument(); // WILL FAIL - component doesn't exist yet
  });
});
```

**Step 1.3**: Run test (verify failure)
```bash
npm run test -- FloatingToolbar.test.tsx
```

**Expected**: ❌ Test fails (module not found)

---

### Phase 2: Minimal Implementation (Green)

**Step 2.1**: Create component file
```bash
touch src/components/Editor/FloatingToolbar.tsx
```

**Step 2.2**: Write minimal implementation
```typescript
// FloatingToolbar.tsx
import type { FC } from 'react';
import type { Editor } from '@milkdown/core';

export interface FloatingToolbarProps {
  editor: Editor | null;
}

export const FloatingToolbar: FC<FloatingToolbarProps> = ({ editor }) => {
  if (!editor) return null; // Hidden when editor is null
  
  return <div role="toolbar">Toolbar</div>;
};
```

**Step 2.3**: Run test (verify pass)
```bash
npm run test -- FloatingToolbar.test.tsx
```

**Expected**: ✅ Test passes

---

### Phase 3: Refactor (Keep Green)

**Step 3.1**: Add more tests (visibility logic)
```typescript
it('should be hidden when no text is selected', () => {
  // Test selection.empty = true → toolbar hidden
});

it('should be visible when text is selected', () => {
  // Test selection.empty = false → toolbar visible
});
```

**Step 3.2**: Implement selection tracking
```typescript
const [isVisible, setIsVisible] = useState(false);

useEffect(() => {
  if (!editor) return;
  
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const originalDispatch = view.dispatch.bind(view);
    
    view.dispatch = (tr) => {
      if (tr.selectionSet || tr.docChanged) {
        setIsVisible(!tr.selection.empty);
      }
      originalDispatch(tr);
    };
  });
}, [editor]);

if (!isVisible) return null;
```

**Step 3.3**: Run tests after each refactor
```bash
npm run test -- FloatingToolbar.test.tsx
```

---

## TDD Iteration Cycle

**Red → Green → Refactor** (repeat for each feature):

1. **Command Execution** (Bold, Italic, Heading, List)
   - RED: Write test for button click → verify command execution
   - GREEN: Implement button with `callCommand`
   - REFACTOR: Extract command handlers

2. **Active State Tracking**
   - RED: Write test for active button styling (e.g., bold text selected → bold button active)
   - GREEN: Implement `hasMark` helper and state tracking
   - REFACTOR: Optimize state calculations

3. **Floating Position**
   - RED: Write test for toolbar positioning (above/below selection)
   - GREEN: Integrate Floating UI with basic positioning
   - REFACTOR: Add flip/shift middleware for viewport overflow

4. **Lock Enforcement**
   - RED: Write test for locked content → formatting command rejected
   - GREEN: Verify existing lock enforcement works with toolbar
   - REFACTOR: Add disabled state for buttons when locked content selected

---

## Implementation Steps

### Step 1: ProseMirror Helpers

**File**: `client/src/utils/prosemirror-helpers.ts`

**Test First**:
```typescript
// prosemirror-helpers.test.ts
import { describe, it, expect } from 'vitest';
import { hasMark } from './prosemirror-helpers';

describe('hasMark', () => {
  it('should return true when mark is active', () => {
    // Create mock EditorState with strong mark
    // Verify hasMark(state, strongType) === true
  });
});
```

**Implementation**:
```typescript
import type { EditorState, MarkType } from '@milkdown/prose/model';

/**
 * Check if a mark type is active in current selection.
 * 
 * @param state - ProseMirror editor state
 * @param markType - Mark type to check
 * @returns `true` if mark is active
 */
export function hasMark(state: EditorState, markType: MarkType): boolean {
  if (!markType) return false;
  const { from, $from, to, empty } = state.selection;

  if (empty) {
    // Cursor position: check stored marks or marks at cursor
    return !!markType.isInSet(state.storedMarks || $from.marks());
  }

  // Text selection: check range
  return state.doc.rangeHasMark(from, to, markType);
}
```

---

### Step 2: FloatingToolbar Component

**File**: `client/src/components/Editor/FloatingToolbar.tsx`

**Test First** (complete test suite):
```typescript
describe('FloatingToolbar', () => {
  it('should execute bold command on button click', () => {
    // Mock editor.action
    // Click bold button
    // Verify callCommand(toggleStrongCommand.key) was called
  });
  
  it('should show active state for bold button when bold text selected', () => {
    // Mock selection with strong mark
    // Verify bold button has active styling (aria-pressed="true")
  });
});
```

**Implementation** (incremental):
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import type { Editor } from '@milkdown/core';
import { editorViewCtx } from '@milkdown/core';
import { callCommand } from '@milkdown/utils';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
} from '@milkdown/preset-commonmark';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { hasMark } from '../../utils/prosemirror-helpers';

export interface FloatingToolbarProps {
  editor: Editor | null;
  className?: string;
  zIndex?: number;
}

export const FloatingToolbar: FC<FloatingToolbarProps> = ({
  editor,
  className = '',
  zIndex = 1000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false,
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Command handlers (use onMouseDown to preserve selection)
  const handleBold = useCallback(() => {
    editor?.action(callCommand(toggleStrongCommand.key));
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.action(callCommand(toggleEmphasisCommand.key));
  }, [editor]);

  const handleH1 = useCallback(() => {
    editor?.action(callCommand(wrapInHeadingCommand.key, 1));
  }, [editor]);

  const handleH2 = useCallback(() => {
    editor?.action(callCommand(wrapInHeadingCommand.key, 2));
  }, [editor]);

  const handleBulletList = useCallback(() => {
    editor?.action(callCommand(wrapInBulletListCommand.key));
  }, [editor]);

  // Selection tracking + position update
  useEffect(() => {
    if (!editor) return;

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const originalDispatch = view.dispatch.bind(view);

      view.dispatch = (tr) => {
        if (tr.selectionSet || tr.docChanged) {
          const { from, to, empty } = tr.selection;

          // Update visibility
          setIsVisible(!empty);

          if (!empty) {
            // Update position
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);

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

            if (toolbarRef.current) {
              computePosition(virtualElement, toolbarRef.current, {
                placement: 'top',
                middleware: [offset(8), flip(), shift({ padding: 8 })],
              }).then(({ x, y }) => {
                setPosition({ x, y });
              });
            }

            // Update active states
            const state = tr.doc ? view.state : tr.before;
            const strongType = state.schema.marks.strong;
            const emphasisType = state.schema.marks.emphasis;

            setActiveStates({
              bold: hasMark(state, strongType),
              italic: hasMark(state, emphasisType),
              h1:
                state.selection.$from.parent.type.name === 'heading' &&
                state.selection.$from.parent.attrs.level === 1,
              h2:
                state.selection.$from.parent.type.name === 'heading' &&
                state.selection.$from.parent.attrs.level === 2,
              bulletList: state.selection.$from.parent.type.name === 'bullet_list',
            });
          }
        }
        originalDispatch(tr);
      };
    });
  }, [editor]);

  if (!isVisible || !editor) return null;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting toolbar"
      className={`floating-toolbar ${className}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex,
      }}
    >
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={activeStates.bold}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleBold();
        }}
      >
        <strong>B</strong>
      </button>

      <button
        type="button"
        aria-label="Italic"
        aria-pressed={activeStates.italic}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleItalic();
        }}
      >
        <em>I</em>
      </button>

      <button
        type="button"
        aria-label="Heading 1"
        aria-pressed={activeStates.h1}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleH1();
        }}
      >
        H1
      </button>

      <button
        type="button"
        aria-label="Heading 2"
        aria-pressed={activeStates.h2}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleH2();
        }}
      >
        H2
      </button>

      <button
        type="button"
        aria-label="Bullet list"
        aria-pressed={activeStates.bulletList}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleBulletList();
        }}
      >
        •
      </button>
    </div>
  );
};
```

---

### Step 3: EditorCore Integration

**File**: `client/src/components/Editor/EditorCore.tsx` (MODIFIED)

**Changes Required**:
1. Import FloatingToolbar component
2. Expose editor instance via state
3. Render FloatingToolbar below Milkdown component

**Test First**:
```typescript
// EditorCore.test.tsx
it('should render FloatingToolbar when editor is ready', () => {
  render(<EditorCore markdown="# Test" />);
  // Wait for editor initialization
  // Verify FloatingToolbar is rendered
});
```

**Implementation**:
```typescript
// Add near line 236 (after editorRef.current?.get())
const [editorInstance, setEditorInstance] = useState<Editor | null>(null);

useEffect(() => {
  if (editorRef.current) {
    const editor = editorRef.current.get();
    setEditorInstance(editor);
  }
}, [editorRef.current]);

// Add after </Milkdown> (near line 340)
import { FloatingToolbar } from './FloatingToolbar';

return (
  <div>
    <Milkdown />
    <FloatingToolbar editor={editorInstance} />
  </div>
);
```

---

### Step 4: E2E Testing

**File**: `client/e2e/markdown-toolbar.spec.ts`

**Test Scenarios**:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Markdown Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should show toolbar when text is selected', async ({ page }) => {
    // Insert text
    await page.locator('.milkdown').click();
    await page.keyboard.type('Hello World');

    // Select text
    await page.keyboard.press('Control+A');

    // Verify toolbar visible
    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeVisible();
  });

  test('should apply bold formatting', async ({ page }) => {
    await page.locator('.milkdown').click();
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+A');

    // Click bold button
    await page.locator('[aria-label="Bold"]').click();

    // Verify Markdown output contains **Bold text**
    // (check via editor state or Markdown serialization)
  });

  test('should hide toolbar when selection is cleared', async ({ page }) => {
    await page.locator('.milkdown').click();
    await page.keyboard.type('Text');
    await page.keyboard.press('Control+A');

    const toolbar = page.locator('[role="toolbar"]');
    await expect(toolbar).toBeVisible();

    // Clear selection
    await page.keyboard.press('ArrowRight');
    await expect(toolbar).not.toBeVisible();
  });
});
```

**Run E2E Tests**:
```bash
npm run test:e2e -- markdown-toolbar.spec.ts
```

---

## Testing Guide

### Unit Tests (Vitest)

**Run All Unit Tests**:
```bash
npm run test
```

**Run Specific Test File**:
```bash
npm run test -- FloatingToolbar.test.tsx
```

**Watch Mode** (TDD workflow):
```bash
npm run test:watch
```

**Coverage Report**:
```bash
npm run test -- --coverage
```

**Expected Coverage** (P2 feature - not critical path):
- FloatingToolbar.tsx: ≥70% (best effort, not blocking)
- prosemirror-helpers.ts: ≥80% (reusable utility)

---

### E2E Tests (Playwright)

**Run E2E Tests**:
```bash
npm run test:e2e
```

**Run Specific Spec**:
```bash
npx playwright test markdown-toolbar.spec.ts
```

**Debug Mode**:
```bash
npx playwright test markdown-toolbar.spec.ts --debug
```

**Headed Mode** (see browser):
```bash
npx playwright test markdown-toolbar.spec.ts --headed
```

---

## Integration Checklist

Before marking implementation complete, verify all items:

### Functionality
- [ ] Toolbar appears when text is selected
- [ ] Toolbar hides when no text is selected
- [ ] Bold button toggles strong mark (Ctrl+B equivalent)
- [ ] Italic button toggles emphasis mark (Ctrl+I equivalent)
- [ ] H1 button wraps selection in heading level 1
- [ ] H2 button wraps selection in heading level 2
- [ ] Bullet List button wraps selection in bullet_list
- [ ] Active states correctly reflect selection (aria-pressed="true")
- [ ] Toolbar positioned near selection (above or below based on viewport)
- [ ] Toolbar respects viewport boundaries (flip/shift middleware)

### Lock Enforcement Integration
- [ ] Formatting locked content triggers rejection (sensory feedback)
- [ ] Toolbar buttons disabled/inactive when locked content selected
- [ ] Lock IDs preserved after formatting unlocked content

### Accessibility
- [ ] Toolbar has role="toolbar" and aria-label
- [ ] Buttons have aria-label (e.g., "Bold", "Italic")
- [ ] Buttons have aria-pressed state (true/false)
- [ ] Touch targets ≥44x44px for mobile
- [ ] Keyboard navigation works (Tab to focus toolbar, Arrow keys between buttons)

### Quality Gates
- [ ] All unit tests pass (`npm run test`)
- [ ] All E2E tests pass (`npm run test:e2e`)
- [ ] ESLint passes (`npm run lint`)
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Prettier formatting applied (`npm run format`)

### Performance
- [ ] <100ms delay from button click to formatting applied (SC-005)
- [ ] <2 seconds from selection to formatting applied (SC-001)
- [ ] No editor performance degradation (check with large documents >1000 lines)

### Documentation
- [ ] JSDoc comments for FloatingToolbar component
- [ ] JSDoc comments for prosemirror-helpers functions
- [ ] Integration example in EditorCore.tsx (comment explaining usage)

---

## Troubleshooting

### Issue: Toolbar doesn't appear when text is selected

**Diagnosis**:
```typescript
// Add logging to transaction handler
view.dispatch = (tr) => {
  console.log('Selection empty:', tr.selection.empty);
  console.log('From:', tr.selection.from, 'To:', tr.selection.to);
  // ...
};
```

**Common Causes**:
- Editor instance not passed to FloatingToolbar
- Transaction interception not set up
- CSS display: none overriding visibility

---

### Issue: Formatting command doesn't execute

**Diagnosis**:
```typescript
const handleBold = () => {
  console.log('Bold clicked, editor:', !!editor);
  editor?.action((ctx) => {
    console.log('Action executed');
    callCommand(toggleStrongCommand.key)(ctx);
  });
};
```

**Common Causes**:
- onClick instead of onMouseDown (selection lost)
- Missing preventDefault() (selection cleared)
- Editor instance is null

---

### Issue: Active state incorrect (button shows active when it shouldn't)

**Diagnosis**:
```typescript
// Log mark checking
const strongType = state.schema.marks.strong;
console.log('Strong type:', strongType);
console.log('Has mark:', hasMark(state, strongType));
console.log('Selection marks:', state.selection.$from.marks());
```

**Common Causes**:
- hasMark helper logic incorrect (check cursor vs. range handling)
- Mark type name mismatch (use `state.schema.marks.strong` not `'strong'`)

---

## Next Steps

After completing implementation:

1. **Create PR**: Push branch and create pull request to `main`
2. **CI Validation**: Verify all GitHub Actions jobs pass (lint, type-check, tests)
3. **Manual Testing**: Test on Chrome, Firefox, Safari (desktop + mobile)
4. **Code Review**: Request review from team (focus on TDD compliance, lock enforcement)
5. **Merge**: Squash and merge after approval

**Post-Merge**:
- Update CLAUDE.md project status (mark P4 toolbar as complete)
- Optional: Add Phase 6 polish tasks (animations, advanced positioning)

---

## Reference Files

**Specification**: `specs/005-markdown-toolbar/spec.md`  
**Research**: `specs/005-markdown-toolbar/research.md`  
**Plan**: `specs/005-markdown-toolbar/plan.md`  
**Data Model**: `specs/005-markdown-toolbar/data-model.md`  
**Contracts**: `specs/005-markdown-toolbar/contracts/`

**Milkdown Docs**: https://milkdown.dev/docs  
**ProseMirror Docs**: https://prosemirror.net/docs  
**Floating UI Docs**: https://floating-ui.com

---

**Last Updated**: 2025-11-08  
**Status**: Phase 1 Complete - Ready for Implementation
