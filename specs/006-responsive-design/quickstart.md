# Responsive Design - Quick Start Testing Guide

**Feature**: 006-responsive-design
**Purpose**: Manual validation guide for responsive layout testing
**Audience**: Developers, QA testers
**Time Required**: ~15 minutes (manual testing), ~5 minutes (automated E2E)

---

## Prerequisites

1. **Development Environment Running**:
   ```bash
   cd client
   npm run dev
   # Server should start at http://localhost:5173
   ```

2. **Browser DevTools** (Chrome recommended):
   - Open Chrome DevTools: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Toggle Device Toolbar: `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows)

3. **Real Devices (Optional but Recommended)**:
   - iOS device (iPhone 8+ running iOS 12+)
   - Android device (Chrome 80+ or Samsung Internet 10+)
   - Tablet (iPad or Android tablet)

---

## Quick Test Matrix

| Viewport Size | Breakpoint | Expected Layout | Test Duration |
|---------------|------------|-----------------|---------------|
| 320px × 568px | Mobile (iPhone SE) | Bottom-docked toolbar, stacked layout, 18px font | 3 min |
| 375px × 667px | Mobile (iPhone 8) | Same as above | 2 min |
| 768px × 1024px | Tablet (iPad portrait) | Floating toolbar, intermediate typography | 3 min |
| 1024px × 768px | Desktop (iPad landscape) | Original desktop layout | 2 min |
| 1440px × 900px | Desktop | Original desktop layout | 2 min |

---

## Phase 1: Mobile Testing (< 768px)

### Setup: iPhone SE Viewport (375px × 667px)

1. **Open DevTools Responsive Mode**:
   - Click "Dimensions" dropdown → Select "iPhone SE" (375×667)
   - Ensure "Zoom" is set to 100%

2. **Load Application**:
   - Navigate to `http://localhost:5173`
   - Ensure page loads without errors (check Console tab)

### Test Cases

#### TC-M01: No Horizontal Scrolling ✓
**Priority**: P1 (Critical)
**User Story**: US1 (Adaptive Layout)

**Steps**:
1. Scroll page vertically to bottom
2. Observe if horizontal scrollbar appears in viewport

**Expected Result**:
- ✅ No horizontal scrollbar visible
- ✅ All content fits within 375px width
- ✅ No content overflow (check DevTools > Elements > Computed > Scroll Width should = 375)

**Failure Symptoms**:
- ❌ Horizontal scrollbar appears
- ❌ Content extends beyond viewport (DevTools Scroll Width > 375px)
- ❌ Fixed-width elements (e.g., Milkdown editor) don't shrink

**Pass/Fail**: [ ]

---

#### TC-M02: Editor Content Wraps Properly ✓
**Priority**: P1 (Critical)
**User Story**: US1 (Adaptive Layout)

**Steps**:
1. Click into editor area
2. Type a long sentence without spaces (e.g., "ThisIsAVeryLongWordThatShouldWrapToTheNextLine...")
3. Observe text behavior at viewport edge

**Expected Result**:
- ✅ Text wraps to next line (word-break or overflow-wrap applied)
- ✅ No horizontal scrolling triggered by long text
- ✅ Locked content blocks also wrap properly

**Failure Symptoms**:
- ❌ Text extends beyond viewport width
- ❌ Horizontal scrollbar appears when typing long words
- ❌ Locked content has fixed width and doesn't wrap

**Pass/Fail**: [ ]

---

#### TC-M03: Bottom-Docked Toolbar (< 768px) ✓
**Priority**: P2 (High)
**User Story**: US2 (Responsive Toolbar)

**Steps**:
1. Type some text in editor: "This is **bold** text"
2. Select the word "bold" (triple-click or drag)
3. Observe toolbar appearance and position

**Expected Result**:
- ✅ Toolbar appears **docked to bottom** of viewport (not floating above selection)
- ✅ Toolbar has `position: fixed; bottom: 0;` (verify in DevTools > Elements > Computed)
- ✅ All 5 buttons visible (Bold, Italic, H1, H2, Bullet List)
- ✅ Toolbar doesn't overlap with selected text

**Failure Symptoms**:
- ❌ Toolbar floats above selection (desktop behavior on mobile)
- ❌ Toolbar buttons overflow horizontally
- ❌ Toolbar obscures selected text or locked content

**Pass/Fail**: [ ]

---

#### TC-M04: Touch Target Sizes (44x44px Minimum) ✓
**Priority**: P1 (Critical - WCAG 2.1 AA)
**User Story**: US1 (Adaptive Layout)

**Steps**:
1. Open DevTools > Elements
2. Inspect each interactive element (buttons, toolbar items, mode selector)
3. Check Computed tab for `width` and `height` values

**Elements to Check**:
- FloatingToolbar buttons (Bold, Italic, H1, H2, Bullet List)
- "Provoke Muse" button
- AI Mode Selector dropdown trigger
- Editor area (should be tappable, but no size constraint)

**Expected Result**:
- ✅ All buttons: `min-width: 44px; min-height: 44px` (or larger)
- ✅ Visual size may be smaller (e.g., 40px), but **hit area** (including padding/pseudo-elements) is ≥44px
- ✅ No buttons < 44px in either dimension

**Testing Tool** (Optional):
```javascript
// Run in DevTools Console to audit all buttons
document.querySelectorAll('button').forEach(btn => {
  const rect = btn.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    console.error('WCAG FAIL:', btn, `Size: ${rect.width}x${rect.height}px`);
  }
});
```

**Failure Symptoms**:
- ❌ Buttons < 44px wide or tall
- ❌ Console error from audit script
- ❌ Difficult to tap buttons accurately on real mobile device

**Pass/Fail**: [ ]

---

#### TC-M05: Mobile Typography (18px Base Font) ✓
**Priority**: P3 (Medium)
**User Story**: US3 (Readable Typography)

**Steps**:
1. Inspect editor paragraph text in DevTools
2. Check Computed tab for `font-size` and `line-height`

**Expected Result**:
- ✅ Base font size: **18px** (vs. 16px on desktop)
- ✅ Line height: **1.8** or higher (vs. 1.6 on desktop)
- ✅ H1 heading: ~28px (scaled down from desktop 32px)
- ✅ H2 heading: ~24px (scaled down from desktop 28px)

**Failure Symptoms**:
- ❌ Font size still 16px (desktop value not overridden)
- ❌ Text feels cramped (line-height < 1.6)
- ❌ Headings too large (consume excessive vertical space)

**Pass/Fail**: [ ]

---

#### TC-M06: Compact AI Controls ✓
**Priority**: P3 (Medium)
**User Story**: US4 (Responsive AI Controls)

**Steps**:
1. Locate AI intervention controls (Mode Selector + Provoke button)
2. Observe layout (stacked vertically or compact dropdown)

**Expected Result**:
- ✅ Mode selector appears as compact dropdown (not full-width tabs)
- ✅ "Provoke Muse" button below or beside dropdown (doesn't overflow)
- ✅ Controls don't overlap with editor content
- ✅ All controls accessible without scrolling

**Failure Symptoms**:
- ❌ Mode selector uses desktop tab layout (wastes horizontal space)
- ❌ Controls overflow horizontally
- ❌ Provoke button hidden below fold (requires scrolling)

**Pass/Fail**: [ ]

---

## Phase 2: Tablet Testing (768px - 1023px)

### Setup: iPad Portrait Viewport (768px × 1024px)

1. **Switch DevTools Viewport**:
   - Dimensions dropdown → Select "iPad" (768×1024)
   - Orientation: Portrait

2. **Reload Page** (to trigger breakpoint transition):
   - Press `Cmd+R` (Mac) / `Ctrl+R` (Windows)

### Test Cases

#### TC-T01: Floating Toolbar (≥ 768px) ✓
**Priority**: P2 (High)
**User Story**: US2 (Responsive Toolbar)

**Steps**:
1. Type text: "This is **bold** text"
2. Select the word "bold"

**Expected Result**:
- ✅ Toolbar **floats above** selection (not bottom-docked)
- ✅ Toolbar positioned via Floating UI middleware (absolute positioning)
- ✅ Toolbar doesn't overflow viewport (shift middleware prevents cutoff)

**Failure Symptoms**:
- ❌ Toolbar still bottom-docked (mobile behavior on tablet)
- ❌ Toolbar positioned incorrectly (overlaps selection or cuts off)

**Pass/Fail**: [ ]

---

#### TC-T02: Intermediate Typography Scaling ✓
**Priority**: P3 (Medium)
**User Story**: US3 (Readable Typography)

**Steps**:
1. Inspect editor paragraph text
2. Check Computed font-size

**Expected Result**:
- ✅ Font size: **17px** (between mobile 18px and desktop 16px)
- ✅ Line height: **1.7** (between mobile 1.8 and desktop 1.6)

**Alternative** (if not implemented):
- ⚠️ Font size may be 18px or 16px (intermediate sizing is P3 optional)

**Pass/Fail**: [ ]

---

## Phase 3: Desktop Testing (≥ 1024px)

### Setup: Desktop Viewport (1440px × 900px)

1. **Switch DevTools Viewport**:
   - Dimensions dropdown → Select "Desktop 1440×900" (or "Responsive" and manually set 1440×900)

2. **Reload Page**

### Test Cases

#### TC-D01: No Regression - Original Layout ✓
**Priority**: P1 (Critical)
**User Story**: US1 (Adaptive Layout)

**Steps**:
1. Compare current page layout to previous desktop version (before responsive changes)
2. Verify no visual regressions

**Expected Result**:
- ✅ Layout identical to pre-responsive design
- ✅ Floating toolbar floats above selection (original behavior)
- ✅ Typography: 16px base font, 1.6 line-height (original values)
- ✅ All P1-P4 features work (locked content, AI intervention, sensory feedback, markdown toolbar)

**Failure Symptoms**:
- ❌ Layout changed unexpectedly (e.g., wider margins, different spacing)
- ❌ Toolbar behaves differently (position, size, button order)
- ❌ Locked content enforcement broken

**Pass/Fail**: [ ]

---

## Phase 4: Edge Cases & Device Rotation

### TC-E01: Device Rotation (Portrait ↔ Landscape) ✓
**Priority**: P2 (High)
**User Story**: US1 (Adaptive Layout)

**Steps** (DevTools):
1. Set viewport to iPhone SE (375×667 portrait)
2. Type some text with locked content block
3. Click "Rotate" button in DevTools toolbar (or manually swap dimensions to 667×375)
4. Observe layout transition

**Expected Result**:
- ✅ Layout transitions smoothly (no visual glitches or flash)
- ✅ Breakpoint changes if crossing 768px threshold (e.g., portrait 375px → landscape 667px stays in mobile breakpoint)
- ✅ No content loss (typed text and locked blocks persist)
- ✅ Toolbar mode may change (portrait bottom-docked → landscape bottom-docked, unless width ≥ 768px)

**Failure Symptoms**:
- ❌ Layout "jumps" or flashes during rotation
- ❌ Content disappears or shifts unexpectedly
- ❌ Horizontal scrollbar appears in landscape mode

**Pass/Fail**: [ ]

---

### TC-E02: Minimum Viewport (320px - iPhone 5/SE) ✓
**Priority**: P2 (High)
**User Story**: US1 (Adaptive Layout)

**Steps**:
1. Set DevTools viewport to 320px × 568px (iPhone SE, smallest supported)
2. Load application

**Expected Result**:
- ✅ No horizontal scrolling
- ✅ All interactive elements accessible (not cut off)
- ✅ Font size ≥ 16px (prevents iOS zoom-lock)
- ✅ Toolbar buttons visible (may stack or shrink, but ≥44px touch target)

**Failure Symptoms**:
- ❌ Horizontal scrollbar at 320px width
- ❌ Buttons or toolbar overflow (hidden off-screen)
- ❌ Font size < 16px (triggers iOS auto-zoom on input focus)

**Pass/Fail**: [ ]

---

### TC-E03: Long Unbreakable Content ✓
**Priority**: P3 (Medium)
**User Story**: US1 (Adaptive Layout) - Edge Case

**Steps**:
1. Type a very long URL in editor: `https://example.com/this-is-a-very-long-url-path-that-should-break-properly-without-causing-horizontal-scroll`
2. Observe text wrapping

**Expected Result**:
- ✅ URL wraps to next line (CSS `word-break: break-word` or `overflow-wrap: break-word` applied)
- ✅ No horizontal scrolling

**Failure Symptoms**:
- ❌ URL extends beyond viewport, causing horizontal scroll
- ❌ Locked content with long URLs doesn't wrap

**Pass/Fail**: [ ]

---

## Phase 5: Real Device Testing (Optional but Recommended)

### Mobile Device (iPhone or Android)

**Setup**:
1. Connect mobile device to same network as dev machine
2. Find dev machine's local IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
3. On mobile browser, navigate to `http://<DEV_IP>:5173` (e.g., `http://192.168.1.100:5173`)

**Test Cases**:
- **TC-RD01: Virtual Keyboard Appearance**
  1. Tap into editor to trigger keyboard
  2. Verify toolbar remains visible (not hidden by keyboard)
  3. Verify locked content remains accessible (scroll works)

  **Expected**:
  - ✅ Toolbar fixed to bottom (not pushed down by keyboard)
  - ✅ Viewport resizes (using `dvh` units, not `vh`)
  - ✅ Content scrollable while keyboard visible

- **TC-RD02: Touch Target Accuracy**
  1. Attempt to tap each toolbar button with thumb
  2. Verify all buttons respond on first tap (no mis-taps)

  **Expected**:
  - ✅ All buttons tappable with 100% accuracy
  - ✅ No need to zoom in to tap small buttons

---

## Phase 6: Automated E2E Testing (Playwright)

### Run E2E Tests

```bash
cd client
npm run test:e2e -- responsive.spec.ts
```

**Expected Output**:
```
✓ [mobile] No horizontal scrolling at 375px width
✓ [mobile] Toolbar docked to bottom at < 768px
✓ [tablet] Toolbar floats above selection at 768px
✓ [desktop] Original layout preserved at 1024px+
✓ [edge] No horizontal scrolling at 320px width
✓ [edge] Long URLs wrap without overflow
```

**Test Coverage**:
- Viewport sizes: 320px, 375px, 768px, 1024px, 1440px
- Toolbar positioning (bottom-docked vs. floating)
- Typography scaling (font-size, line-height)
- Touch target sizes (button dimensions)
- Content wrapping (long text, URLs)

**Failure Handling**:
- If any test fails, check DevTools Console for errors
- Review failing test screenshot in `client/test-results/` directory
- Re-run specific test: `npm run test:e2e -- responsive.spec.ts -g "specific test name"`

---

## Phase 7: Lighthouse Mobile Audit

### Run Lighthouse

1. **Open Chrome DevTools**:
   - Navigate to `http://localhost:5173`
   - DevTools > "Lighthouse" tab

2. **Configure Audit**:
   - Mode: "Navigation"
   - Categories: ✓ Performance, ✓ Accessibility
   - Device: **Mobile** (emulated Moto G4)

3. **Generate Report**:
   - Click "Analyze page load"
   - Wait ~30 seconds

### Success Criteria

**Performance** (Target: ≥85):
- ✅ Score ≥ 85
- ✅ Largest Contentful Paint (LCP) < 2.5s
- ✅ Cumulative Layout Shift (CLS) < 0.1
- ✅ Total Blocking Time (TBT) < 300ms

**Accessibility** (Target: ≥90):
- ✅ Score ≥ 90
- ✅ Touch targets ≥ 44×44px (no errors)
- ✅ Color contrast ≥ 4.5:1 (WCAG AA)
- ✅ Viewport meta tag present

**Failure Symptoms**:
- ❌ Performance < 85: Check for unoptimized images, large JS bundles
- ❌ Accessibility < 90: Check for touch target violations (< 44px), missing ARIA labels

---

## Quick Reference: Breakpoint Values

| Breakpoint | CSS Media Query | Viewport Width | Layout Mode |
|------------|-----------------|----------------|-------------|
| Mobile | `@media (max-width: 767px)` | < 768px | Bottom-docked toolbar, 18px font, stacked layout |
| Tablet | `@media (min-width: 768px) and (max-width: 1023px)` | 768px - 1023px | Floating toolbar, 17px font, intermediate layout |
| Desktop | `@media (min-width: 1024px)` | ≥ 1024px | Original layout (floating toolbar, 16px font) |

---

## Troubleshooting

### Issue: Horizontal scrollbar appears at 375px
**Possible Causes**:
- Fixed-width elements (e.g., `.editor { width: 800px; }`)
- Milkdown editor not using `max-width: 100%`
- Padding/margin causing overflow

**Debug**:
1. DevTools > Elements > Inspect element causing overflow
2. Check Computed tab for `width` and `margin` values
3. Disable CSS rules one-by-one to isolate culprit

**Fix**:
- Change fixed widths to `max-width: 100%`
- Add `box-sizing: border-box;` to prevent padding overflow

---

### Issue: Toolbar doesn't switch to bottom-docked mode on mobile
**Possible Causes**:
- `useMediaQuery` hook not triggering at 768px breakpoint
- Conditional rendering logic incorrect

**Debug**:
1. Add console.log in FloatingToolbar:
   ```tsx
   const isMobile = useMediaQuery("(max-width: 767px)");
   console.log("isMobile:", isMobile, "innerWidth:", window.innerWidth);
   ```
2. Verify hook returns `true` at < 768px width

**Fix**:
- Check media query string in `useMediaQuery` call
- Ensure breakpoint matches CSS (767px vs 768px off-by-one error)

---

### Issue: Virtual keyboard hides toolbar on real device
**Possible Causes**:
- Using `vh` units instead of `dvh` (Dynamic Viewport Height)
- Toolbar not using `position: fixed; bottom: 0;`

**Debug**:
1. Inspect toolbar element on real device (use Remote Debugging)
2. Check if `position: fixed` is applied
3. Verify viewport units: `height: 100dvh` not `height: 100vh`

**Fix**:
- Change `index.html` viewport meta tag to include `interactive-widget=resizes-content`
- Change App.tsx container height from `100vh` to `100dvh`

---

## Summary Checklist

Before marking feature as complete, verify:

- [ ] All 15 test cases pass (TC-M01 through TC-E03)
- [ ] Playwright E2E tests pass (6/6 tests green)
- [ ] Lighthouse mobile scores: Performance ≥85, Accessibility ≥90
- [ ] Manual testing on ≥1 real mobile device (iPhone or Android)
- [ ] No horizontal scrolling at 320px, 375px, 768px, 1024px, 1440px widths
- [ ] All touch targets ≥44x44px (WCAG 2.1 AA compliant)
- [ ] No visual regressions on desktop (≥1024px)
- [ ] Code reviewed and approved
- [ ] PR created with demo video/screenshots

**Estimated Testing Time**: 15 minutes (manual) + 5 minutes (automated) = **20 minutes total**

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Maintainer**: Impetus Lock Team
