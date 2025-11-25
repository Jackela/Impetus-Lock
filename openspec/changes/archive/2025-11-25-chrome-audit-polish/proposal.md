# Proposal: Chrome Audit Polish

## Summary
Polish the UI/UX based on comprehensive new user audit findings to achieve production-ready quality and improve user confidence.

## Problem Statement
A comprehensive new user audit (via `client/e2e/new-user-audit.spec.ts` and browser automation) revealed the application has an excellent foundation (8.5/10 rating) but requires targeted polish to reach production quality:

**Current Issues**:
- ❌ Generic page title ("client") reduces brand visibility and tab discoverability
- ❌ No visual indication of Muse mode timer progress (creates user anxiety: "Is it watching? How much time left?")
- ❌ Locked content visually indistinguishable from user content (confusion about what can be deleted)
- ❌ Lock rejection feedback implemented but lacks E2E test coverage
- ❌ Welcome modal gives equal weight to all modes (Muse mode, the primary use case, not emphasized)
- ❌ Keyboard shortcut "?" for help works but not advertised upfront (users may never discover it)

**Impact**: Users feel uncertain about application state, reducing confidence and perceived polish.

## Proposed Solution
Implement 6 targeted UI/UX improvements organized by priority (P0-P3):

### P0 (Production Blocker) - 1 issue
1. **Page Title Branding** (`production-readiness` spec) - Fix browser tab title to improve discoverability

### P2 (High Priority) - 3 issues
2. **Muse Timer Visibility** (`timer-visibility` spec) - Add subtle progress indicator for 60s STUCK timer
3. **Locked Content Styling** (`locked-content-styling` spec) - Visual distinction for un-deletable content
4. **Lock Rejection Feedback Validation** (`lock-rejection-feedback` spec) - E2E test for existing shake animation

### P3 (Quality of Life) - 2 issues
5. **Welcome Modal Hierarchy** (`welcome-modal-hierarchy` spec) - Emphasize Muse mode as recommended option
6. **Keyboard Hint Discoverability** (`keyboard-hint-discoverability` spec) - Subtle footer advertising "?" shortcut

**Target**: Improve new user rating from 8.5/10 → 9.5/10

## Scope
**In Scope**:
- ✅ 6 UI/UX polish improvements (see capabilities above)
- ✅ E2E tests for all user-facing changes
- ✅ Visual regression validation (screenshots)
- ✅ Accessibility compliance (WCAG 2.1 AA)

**Out of Scope** (Deferred to future work):
- ❌ Mobile modal scrolling (<375px screens) - Current 375x667 support sufficient for MVP
- ❌ Dark mode / theme system - Requires full design system (post-MVP)
- ❌ Changes to core lock enforcement logic - This is presentation-layer polish only

## Success Criteria
- [ ] All 6 capabilities implemented per spec requirements
- [ ] New user audit re-run achieves ≥9.0/10 rating
- [ ] E2E tests pass (100% coverage for new UI features)
- [ ] Production build verification (dev buttons hidden, page title correct)
- [ ] Accessibility validation (no new violations)
- [ ] Visual regression tests pass (screenshots match expected)

## Dependencies
- **Internal**: Existing P3 sensory feedback system (specs/003-vibe-completion) for lock rejection
- **External**: None (all changes use existing framework features)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| ProseMirror decoration complexity | 4-6h implementation | Use existing `prosemirror-helpers.ts` utilities, test incrementally |
| Timer indicator distracts from Zen writing | Medium | Design as non-intrusive (2px bar, opacity 0.6, subtle animation) |
| Lock rejection feedback already broken | Low | E2E test will catch issues, implementation already exists in EditorCore |

## Implementation Estimate
**Total Effort**: 12-15 hours across 3 weeks

**Breakdown by Phase**:
1. **Week 1 (P0)**: 30 minutes - Page title fix
2. **Week 2 (P2)**: 8-10 hours - Timer indicator, locked content styling, lock feedback test
3. **Week 3 (P3)**: 2-3 hours - Welcome modal hierarchy, keyboard hint footer

## Related Work
- **Audit Evidence**: `specs/007-chrome-devtools-audit/UX_IMPROVEMENT_PLAN.md`
- **Test Suite**: `client/e2e/new-user-audit.spec.ts`
- **Screenshots**: `client/audit-screenshots/{01-first-load,02-welcome-modal,03-main-ui}.png`
- **Related Specs**: P3 Sensory Feedback (specs/003-vibe-completion)

## Notes
- ✅ **Test Delete button already production-ready** - Gated with `import.meta.env.DEV` in ManualTriggerButton.tsx:99
- 🎯 **Constitutional Compliance**:
  - Article I (Simplicity): Uses framework-native features (CSS, ProseMirror decorations, env variables)
  - Article II (Vibe-First): No P1 items (UI polish is secondary to core un-deletable logic)
  - Article III (Test-First): E2E tests specified for each user-facing change
  - Article IV (SOLID): Visual indicators as presentation layer, no business logic changes
  - Article V (Documentation): JSDoc comments required for new components
