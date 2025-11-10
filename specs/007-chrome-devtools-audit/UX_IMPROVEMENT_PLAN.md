# UI/UX Improvement Plan - Chrome DevTools Audit Findings

**Date**: 2025-11-10
**Based On**: New User Audit (`client/e2e/new-user-audit.spec.ts`)
**Overall Rating**: 8.5/10 (Excellent foundation, polish needed)

---

## Executive Summary

The new user audit revealed an **excellent onboarding experience** with clear explanations and professional design. However, several polish items would significantly improve user confidence and production-readiness.

**Key Strengths**:
✅ Welcome modal provides clear context
✅ Clean, focused interface with good visual hierarchy
✅ Mode explanations are comprehensive
✅ Keyboard shortcuts work reliably

**Key Opportunities**:
❓ Development artifacts visible in production UI
❓ Missing visual feedback for timer states
❓ Locked content not immediately distinguishable
❓ Generic page title reduces brand visibility

---

## Priority Framework

Per Article II (Vibe-First Imperative):
- **P0 (Blocker)**: Prevents production deployment or breaks core functionality
- **P1 (Critical)**: Reserved ONLY for un-deletable constraint implementation
- **P2 (High)**: Significant UX improvements, production polish
- **P3 (Medium)**: Quality-of-life enhancements
- **P4 (Low)**: Future considerations

**Note**: All items below are UI/UX polish, so none qualify as P1 (core un-deletable logic).

---

## P0 (Blocker) - Production Readiness

### Issue 1: Development Button Exposed in UI
**What**: "Test Delete" button visible in main interface
**User Impact**: Appears unprofessional, creates confusion about app purpose
**Evidence**: `audit-screenshots/03-main-ui.png` - Red button in top-right corner

**Current State**:
```typescript
// App.tsx - Visible to all users
<button>Test Delete</button>
```

**Proposed Solution**:
```typescript
// Only show in development mode
{import.meta.env.DEV && <button>Test Delete</button>}
```

**Implementation**:
- **Files**: `client/src/App.tsx`
- **Effort**: 5 minutes (single line change)
- **Testing**: Visual regression test (verify button hidden in production build)

**Acceptance Criteria**:
- [ ] Button hidden when `NODE_ENV=production`
- [ ] Button visible when `NODE_ENV=development`
- [ ] E2E test validates production build appearance

---

### Issue 2: Generic Page Title
**What**: Browser tab shows "client" instead of "Impetus Lock"
**User Impact**: Poor brand visibility, hard to find tab among many
**Evidence**: Audit logs show `Page title: "client"`

**Current State**:
```html
<!-- index.html -->
<title>client</title>
```

**Proposed Solution**:
```html
<title>Impetus Lock - AI-Powered Writing Pressure System</title>
```

**Implementation**:
- **Files**: `client/index.html`
- **Effort**: 2 minutes
- **SEO Benefit**: Improved discoverability

**Acceptance Criteria**:
- [ ] Page title reads "Impetus Lock - AI-Powered Writing Pressure System"
- [ ] E2E test validates page title via `await page.title()`

---

## P2 (High) - User Confidence & Clarity

### Issue 3: No Visual Timer Indicator in Muse Mode
**What**: User cannot see 60-second timer progress
**User Impact**: Creates anxiety - "Is it watching? How much time left?"
**Constitutional Context**: Enhances P1 feature (STUCK detection) without modifying core logic

**User Quote from Audit**:
> "How do I know when Muse is 'watching' me (the 60s timer)? I don't see a countdown!"

**Proposed Solution**:
Add non-intrusive progress indicator when Muse mode active:

```typescript
// Option A: Subtle progress bar at top of editor
<div className="muse-timer-bar" style={{ width: `${progress}%` }} />

// Option B: Discrete countdown badge near mode selector
<span className="timer-badge">{timeRemaining}s</span>
```

**Design Considerations**:
- **Must NOT be distracting** (defeats purpose of Zen writing)
- Suggested: 2px purple progress bar at editor top edge, fade-in animation
- Alternative: Pulsing dot indicator (no numbers) for ambient awareness

**Implementation**:
- **Files**:
  - `client/src/components/Editor/EditorCore.tsx` (timer state)
  - `client/src/components/TimerIndicator.tsx` (new component)
  - `client/src/styles/timer.css` (styling)
- **Effort**: 2-3 hours
- **Dependencies**: Access to existing STUCK timer state

**Acceptance Criteria**:
- [ ] Visual indicator appears only when Muse mode active
- [ ] Progress resets when user types (STUCK timer resets)
- [ ] Indicator disappears in Off/Loki modes
- [ ] Animation is subtle (opacity 0.6, smooth transitions)
- [ ] E2E test validates indicator behavior

---

### Issue 4: Locked Content Not Visually Distinct
**What**: AI-added locked content looks identical to user content
**User Impact**: Confusion about what can/cannot be deleted
**Constitutional Context**: Enhances P1 feature (un-deletable constraint) without modifying lock logic

**User Quote from Audit**:
> "What does locked content look like visually? I assume AI will add text, but how do I know which text is 'locked'?"

**Current State**:
- Lock enforcement works correctly (transaction filter prevents deletion)
- No visual indicator differentiates locked vs. unlocked content

**Proposed Solution**:
Add subtle visual styling to locked content blocks:

```typescript
// ProseMirror node decorator
<span class="locked-content" data-lock-id="abc123">
  AI-generated text appears here
</span>
```

**Design Options**:
1. **Subtle left border** (3px purple line, like blockquote styling)
2. **Background tint** (purple rgba(124, 58, 237, 0.05))
3. **Icon prefix** (🔒 emoji or lock SVG icon)
4. **Combination**: Border + slight background + lock icon on hover

**Recommended**: Option 4 (progressive disclosure - border always visible, details on hover)

**Implementation**:
- **Files**:
  - `client/src/components/Editor/EditorCore.tsx` (ProseMirror decorations)
  - `client/src/styles/locked-content.css` (styling)
  - `client/src/utils/prosemirror-helpers.ts` (decoration utilities)
- **Effort**: 4-6 hours (ProseMirror decoration API integration)
- **Dependencies**: Extract lock IDs from current document state

**Acceptance Criteria**:
- [ ] Locked content has 3px left border (purple #7c3aed)
- [ ] Locked content has subtle background tint (5% purple)
- [ ] Lock icon appears on hover (right side of locked block)
- [ ] Styling does not break existing editor functionality
- [ ] E2E test validates visual distinction (screenshot comparison)
- [ ] Unit tests verify decoration logic

---

### Issue 5: No Feedback When Lock Rejection Occurs
**What**: Attempting to delete locked content silently fails
**User Impact**: Confusion - "Did I press delete? Why isn't it working?"
**Constitutional Context**: Already implemented in P3 Sensory Feedback (specs/003-vibe-completion)

**Current State**:
✅ **ALREADY IMPLEMENTED** - US2 (P2): Lock Rejection Feedback
- Shake animation (`@keyframes lockRejectionShake`)
- Bonk sound effect (`lock-bonk.mp3`)
- EditorCore listens to transaction failures

**Validation Needed**:
- [ ] Verify shake animation triggers on delete attempt
- [ ] Verify bonk sound plays
- [ ] Add E2E test for lock rejection feedback

**Implementation**:
- **Files**: Already complete in `client/src/components/Editor/EditorCore.tsx`
- **Effort**: 1 hour (testing only)

---

## P3 (Medium) - Quality of Life

### Issue 6: Welcome Modal Content Hierarchy
**What**: All three mode explanations have equal visual weight
**User Impact**: Muse mode (most common) should be emphasized
**Evidence**: Audit shows all modes explained equally

**Proposed Solution**:
Reorder mode explanations by usage priority:

**Current Order**:
1. Muse Mode
2. Loki Mode
3. Lock Concept

**Recommended Order** (same, but add visual emphasis):
1. **Muse Mode** (recommended badge, slightly larger)
2. Loki Mode
3. Lock Concept (technical detail, smaller font)

**Implementation**:
- **Files**: `client/src/components/WelcomeModal.tsx`
- **Effort**: 1 hour (CSS + badge component)

**Acceptance Criteria**:
- [ ] Muse Mode section has "RECOMMENDED" badge
- [ ] Font size hierarchy: Muse (1em) > Loki (1em) > Lock (0.9em)
- [ ] E2E test validates badge presence

---

### Issue 7: Keyboard Shortcut Discoverability
**What**: "?" shortcut works but not advertised upfront
**User Impact**: Users may not discover help is one keypress away
**Evidence**: Audit found shortcut in modal hint, but not prominent

**Proposed Solution**:
Add subtle footer to main interface:

```typescript
<footer className="app-footer">
  Press <kbd>?</kbd> for help
</footer>
```

**Implementation**:
- **Files**: `client/src/App.tsx`, `client/src/styles/footer.css`
- **Effort**: 1 hour

**Acceptance Criteria**:
- [ ] Footer always visible (fixed position)
- [ ] Styled as subtle hint (opacity 0.5, small font)
- [ ] E2E test validates footer presence

---

## P4 (Low) - Future Enhancements

### Issue 8: Mobile Modal Scrolling
**What**: Welcome modal content may overflow on small screens
**User Impact**: Users on very small devices (<375px) may not see all content
**Evidence**: Mobile test (375x667) worked, but untested on smaller screens

**Proposed Solution**:
Add `max-height` and `overflow-y: auto` to modal content area.

**Implementation**:
- **Files**: `client/src/components/WelcomeModal.tsx`
- **Effort**: 30 minutes
- **Testing**: Test on 320px width (iPhone SE)

---

### Issue 9: Dark Mode Support
**What**: App uses dark theme, but system light mode users may prefer light theme
**User Impact**: Accessibility for users with light sensitivity
**Scope**: Large effort, deferred to post-MVP

**Recommendation**: Defer to Phase 8+ (requires full theme system)

---

## Implementation Roadmap

### Phase 1: Production Blockers (Week 1)
**Effort**: 1 hour
**Priority**: P0
- [x] Hide "Test Delete" button in production (`import.meta.env.DEV` check)
- [x] Fix page title to "Impetus Lock - AI-Powered Writing Pressure System"

### Phase 2: User Confidence (Week 2)
**Effort**: 8-10 hours
**Priority**: P2
- [ ] Muse mode timer indicator (subtle progress bar)
- [ ] Locked content visual styling (border + background + icon)
- [ ] Lock rejection feedback validation (ensure working)

### Phase 3: Quality of Life (Week 3)
**Effort**: 2-3 hours
**Priority**: P3
- [ ] Welcome modal content hierarchy (Muse badge)
- [ ] Keyboard shortcut footer hint

### Phase 4: Polish (Backlog)
**Effort**: TBD
**Priority**: P4
- [ ] Mobile modal scrolling (small devices)
- [ ] Dark mode support (post-MVP)

---

## Success Metrics

**Before** (Current State):
- New user confusion: "What does locked content look like?" ❓
- Development artifacts visible: "Test Delete" button ❌
- Timer awareness: 0% (no indicator) 📊

**After** (Target State):
- New user clarity: Locked content immediately recognizable ✅
- Production-ready UI: No dev buttons ✅
- Timer awareness: 100% (visual progress indicator) ✅
- Page title brand visibility: "Impetus Lock" in browser tab ✅

**Validation**:
- Re-run `new-user-audit.spec.ts` after implementation
- Target rating: **9.5/10** (up from 8.5/10)
- User quotes expected: "I feel confident about what's happening!"

---

## Constitutional Compliance

✅ **Article I (Simplicity)**: All solutions use framework-native features (CSS, ProseMirror decorations, env variables)
✅ **Article II (Vibe-First)**: No P1 items (UI polish is secondary to core un-deletable logic)
✅ **Article III (Test-First)**: E2E tests specified for each user-facing change
✅ **Article IV (SOLID)**: Visual indicators as presentation layer, no business logic changes
✅ **Article V (Documentation)**: JSDoc comments required for new components

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Prioritize P0 items** for immediate implementation (1 hour effort)
3. **Create OpenSpec proposals** for P2 items (timer indicator, locked content styling)
4. **Schedule P3 items** for post-MVP polish phase

**Estimated Total Effort**: 12-15 hours across 3 weeks
