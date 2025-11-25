# Design: Chrome Audit Polish

## Overview
This document captures architectural decisions for 6 UI/UX polish improvements based on comprehensive new user audit findings.

## Architectural Decisions

### 1. Production Readiness (Page Title)
**Decision**: Modify `client/index.html` directly rather than using React Helmet or dynamic title updates.

**Rationale**:
- Simplicity: Static HTML title is fastest and most reliable
- SEO: Search engines prefer static `<title>` elements
- No dependencies: Avoids adding React Helmet library for single use case
- Framework-native: Uses standard HTML features (Article I: Simplicity)

**Implementation**:
```html
<!-- client/index.html line 10 -->
<title>Impetus Lock - AI-Powered Writing Pressure System</title>
```

**Tradeoffs**:
- ✅ Pro: Zero runtime cost, immediate SEO benefit
- ❌ Con: Cannot dynamically change title based on app state (not needed for MVP)

---

### 2. Timer Visibility (Muse Mode Progress Indicator)
**Decision**: Create new `<TimerIndicator>` component with state lifted from EditorCore.

**Rationale**:
- Separation of concerns: Timer visualization separate from editor logic
- Reusability: Component can be reused if timer appears elsewhere
- Testability: Unit test timer rendering independently of editor
- State management: Timer state already exists in EditorCore (STUCK detection), expose via prop

**Component Hierarchy**:
```
App
├── EditorCore
│   ├── timerProgress (internal state)
│   └── exposes: remainingTime, isMuseMode via props to parent
└── TimerIndicator (new)
    └── receives: progress, visible props from App
```

**Alternative Considered**: Embed timer directly in EditorCore
- ❌ Rejected: Violates SRP (EditorCore already complex with lock enforcement + AI triggers)

**Styling Approach**:
```css
.timer-indicator {
  position: fixed; /* or absolute relative to editor */
  top: var(--header-height); /* Below header */
  left: 0;
  width: calc(100% * var(--progress)); /* 0-100% */
  height: 2px;
  background: rgba(124, 58, 237, 0.6); /* Purple, semi-transparent */
  transition: width 1s linear; /* Smooth progress animation */
  pointer-events: none; /* Don't block editor interaction */
}
```

**Tradeoffs**:
- ✅ Pro: Non-intrusive, subtle design matches Zen aesthetic
- ✅ Pro: Accessible (ARIA labels for screen readers)
- ❌ Con: Requires state lifting from EditorCore (minor complexity increase)

---

### 3. Locked Content Styling (Visual Distinction)
**Decision**: Use ProseMirror decorations (presentation layer) rather than modifying editor schema or node types.

**Rationale**:
- Non-invasive: Decorations don't modify document data structure
- Dynamic: Decorations can be toggled on/off without changing content
- Performance: ProseMirror optimizes decoration rendering
- Existing pattern: P3 Sensory Feedback already uses transaction filters

**Decoration Strategy**:
```typescript
// client/src/utils/prosemirror-helpers.ts
export function createLockDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Extract lock IDs from Markdown comments: <!-- lock:abc123 -->
    const lockId = extractLockId(node);
    if (lockId) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'locked-content',
          'data-lock-id': lockId,
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
```

**CSS Styling**:
```css
.locked-content {
  border-left: 3px solid #7c3aed; /* Purple border */
  background: rgba(124, 58, 237, 0.05); /* Subtle tint */
  padding-left: 8px; /* Offset text from border */
  position: relative; /* For icon positioning */
}

.locked-content:hover::after {
  content: '🔒'; /* Lock icon */
  position: absolute;
  right: 4px;
  opacity: 0.6;
}
```

**Alternative Considered**: Custom ProseMirror node types for locked content
- ❌ Rejected: Requires schema changes, more complex, violates Article I (Simplicity)

**Tradeoffs**:
- ✅ Pro: Presentation-only (no schema changes)
- ✅ Pro: Can be disabled without data migration
- ❌ Con: Requires parsing lock IDs from document (moderate complexity)

---

### 4. Lock Rejection Feedback Validation (E2E Tests)
**Decision**: Add Playwright E2E test to validate existing shake animation + bonk sound implementation.

**Rationale**:
- Feature already implemented in P3 Sensory Feedback (specs/003-vibe-completion)
- Missing E2E test coverage (only unit tests exist)
- E2E test validates full user experience (visual + audio)

**Test Strategy**:
```typescript
// client/e2e/lock-rejection-feedback.spec.ts
test('Lock rejection triggers shake animation and bonk sound', async ({ page }) => {
  // Setup: Insert locked content
  await insertLockedContent(page, 'AI-added text');

  // Action: Attempt to delete
  await page.keyboard.press('Backspace');

  // Assert: Shake animation applied
  await expect(page.locator('.milkdown')).toHaveClass(/lock-rejection-shake/);

  // Assert: Audio element created
  const audioPlayed = await page.evaluate(() => {
    return document.querySelectorAll('audio[src*="lock-bonk"]').length > 0;
  });
  expect(audioPlayed).toBe(true);

  // Assert: Content unchanged
  await expect(page.locator('.milkdown')).toContainText('AI-added text');
});
```

**Tradeoffs**:
- ✅ Pro: No implementation work (feature already exists)
- ✅ Pro: Validates end-to-end user experience
- ❌ Con: Audio testing in Playwright can be flaky (use audio element inspection, not playback verification)

---

### 5. Welcome Modal Hierarchy (Muse Mode Emphasis)
**Decision**: Add CSS-based visual hierarchy (badge + font size) without changing modal structure.

**Rationale**:
- Minimal changes: Only CSS + one `<span>` element for badge
- No JS logic: Pure presentation layer
- Backward compatible: Modal content/order unchanged

**Implementation**:
```tsx
// client/src/components/WelcomeModal.tsx
<div className="welcome-mode muse-mode">
  <h3>
    Muse Mode <span className="recommended-badge">RECOMMENDED</span>
  </h3>
  <p>When you stop writing for 60 seconds...</p>
</div>
```

**CSS**:
```css
.recommended-badge {
  display: inline-block;
  background: #7c3aed;
  color: #ffffff;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: 600;
}

.welcome-mode.muse-mode h3 {
  font-size: 1.0em; /* Base size */
}

.welcome-mode.loki-mode h3 {
  font-size: 1.0em; /* Equal to Muse */
}

.lock-concept h3 {
  font-size: 0.9em; /* Slightly smaller (technical detail) */
}
```

**Alternative Considered**: Reorder modal sections (Muse first, then Loki, then Lock)
- ✅ Current order already logical - only visual emphasis needed

**Tradeoffs**:
- ✅ Pro: Minimal change (one badge + CSS tweaks)
- ✅ Pro: Guides new users without forcing choice
- ❌ Con: Badge adds slight visual clutter (mitigated by small size)

---

### 6. Keyboard Hint Discoverability (Footer)
**Decision**: Add fixed-position footer to App.tsx with subtle styling.

**Rationale**:
- Always visible: Fixed position ensures hint is always accessible
- Non-intrusive: Opacity 0.5, small font, gray color
- Simple implementation: One `<footer>` element in App.tsx

**Component Placement**:
```tsx
// client/src/App.tsx
function App() {
  return (
    <div className="app">
      <WelcomeModal ... />
      <header className="app-header">...</header>
      <main className="app-main">...</main>
      <footer className="app-footer">
        Press <kbd>?</kbd> for help
      </footer>
    </div>
  );
}
```

**CSS**:
```css
.app-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 8px;
  font-size: 0.875rem; /* 14px */
  color: #9ca3af; /* gray-400 */
  opacity: 0.5;
  background: transparent;
  pointer-events: none; /* Allow clicks through */
}

.app-footer kbd {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}
```

**Tradeoffs**:
- ✅ Pro: Improves shortcut discoverability without modal redesign
- ✅ Pro: Semantic HTML (`<kbd>` for keyboard keys)
- ❌ Con: Adds permanent UI element (mitigated by subtle styling)

---

## Cross-Cutting Concerns

### Accessibility (WCAG 2.1 AA)
All changes comply with WCAG 2.1 AA:
- **Timer indicator**: ARIA label "STUCK timer: X seconds remaining"
- **Locked content icon**: Tooltip "AI-added content (locked)"
- **Welcome modal badge**: Text-based (no color-only information)
- **Footer kbd element**: Semantic markup for screen readers

### Performance
- **Timer indicator**: CSS-only animation (hardware accelerated)
- **Lock decorations**: ProseMirror's efficient decoration rendering
- **Modal badge**: Static HTML (no JS computation)
- **Footer**: Fixed position (no layout reflow)

### Testing Strategy
- **Unit tests**: Timer logic, lock ID extraction, decoration creation
- **E2E tests**: User-facing behavior (timer visibility, lock rejection, modal badge, footer)
- **Visual regression**: Screenshot comparison for locked content styling

### Responsive Design
- **Timer indicator**: Full-width progress bar (scales to viewport)
- **Footer**: Center-aligned, bottom-fixed (works on mobile)
- **Modal badge**: Inline with heading (wraps on small screens)
- **Locked content border**: 3px border scales well on all screen sizes

---

## Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ProseMirror decoration complexity | Medium | Medium | Use existing `prosemirror-helpers.ts` utilities |
| Timer state lifting adds complexity | Low | Low | EditorCore already exposes mode state |
| Audio testing flakiness in Playwright | Medium | Low | Test audio element presence, not playback |
| Footer overlaps editor on small screens | Low | Low | Fixed position with transparent background |

---

## Future Enhancements (Out of Scope)

1. **Dark mode toggle**: Requires full theme system (post-MVP)
2. **Timer customization**: Allow users to adjust 60s timeout (post-MVP)
3. **Lock content export**: Export with/without locked content (future)
4. **Mobile modal scrolling**: Support <375px screens (low priority, current 375x667 sufficient)

---

## Summary

All 6 improvements use framework-native features (CSS, ProseMirror decorations, static HTML) with no external dependencies. Changes are presentation-layer only (no business logic modifications), maintaining separation of concerns and simplicity per Article I.

**Total Technical Debt**: Minimal (timer state lifting is the only architectural change, well-scoped)

**Rollback Plan**: All features can be disabled via feature flags or CSS if needed (decorations, timer, badge, footer are all opt-in)
