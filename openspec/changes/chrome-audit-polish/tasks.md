# Tasks: Chrome Audit Polish

**Total Estimate**: 12-15 hours across 3 weeks
**Validation**: Each task includes acceptance test (E2E or unit test)

---

## Phase 1: Production Readiness (P0) - Week 1
**Estimate**: 30 minutes
**Goal**: Fix page title for brand visibility

### T001: Update Page Title in index.html
**Effort**: 5 minutes
**Dependencies**: None
**Parallelizable**: Yes

**Steps**:
1. Open `client/index.html`
2. Change line 10 from `<title>client</title>` to `<title>Impetus Lock - AI-Powered Writing Pressure System</title>`
3. Save file

**Validation**:
- [ ] Manual test: Open app in browser, verify tab title shows "Impetus Lock - AI-Powered Writing Pressure System"
- [ ] Verify title length is <70 characters (SEO best practice): ✅ 52 characters

**Acceptance Test**:
```typescript
// Add to existing e2e test or create new file
test('Page title is branded', async ({ page }) => {
  await page.goto('/');
  expect(await page.title()).toBe('Impetus Lock - AI-Powered Writing Pressure System');
});
```

---

### T002: E2E Test for Production Build Dev Button Hiding
**Effort**: 20 minutes
**Dependencies**: None
**Parallelizable**: Yes (with T001)

**Note**: Test Delete button already hidden via `import.meta.env.DEV` in ManualTriggerButton.tsx:99. This task validates existing behavior.

**Steps**:
1. Create `client/e2e/production-build.spec.ts`
2. Test in development mode: Button visible
3. Test in production build: Button hidden

**Validation**:
- [ ] E2E test passes in both dev and production modes

**Acceptance Test**:
```typescript
// client/e2e/production-build.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Production Build', () => {
  test('Test Delete button hidden in production', async ({ page }) => {
    // This test runs against production build (npm run build + preview)
    await page.goto('/');
    await expect(page.locator('[data-testid="manual-delete-trigger"]')).not.toBeVisible();
  });

  test('Test Delete button visible in development', async ({ page }) => {
    // This test runs against dev server (npm run dev)
    await page.goto('/');
    await expect(page.locator('[data-testid="manual-delete-trigger"]')).toBeVisible();
  });
});
```

**Run Command**:
```bash
# Dev mode
npm run dev & npx playwright test production-build.spec.ts

# Production mode
npm run build && npm run preview & npx playwright test production-build.spec.ts
```

---

## Phase 2: User Confidence (P2) - Week 2
**Estimate**: 8-10 hours
**Goal**: Muse timer indicator, locked content styling, lock rejection feedback validation

### T003: Create TimerIndicator Component
**Effort**: 1.5 hours
**Dependencies**: None
**Parallelizable**: Yes

**Steps**:
1. Create `client/src/components/TimerIndicator.tsx`
2. Component props: `progress: number` (0-100), `visible: boolean`, `remainingTime: number`
3. Render 2px progress bar with purple color, opacity 0.6
4. Add ARIA label: `"STUCK timer: ${remainingTime} seconds remaining"`
5. Apply CSS styling (see design.md)

**Validation**:
- [ ] Component renders progress bar when `visible=true`
- [ ] Component hidden when `visible=false`
- [ ] Progress bar width matches `progress` prop (0-100%)
- [ ] ARIA label updates with `remainingTime`

**Acceptance Test**:
```typescript
// client/src/components/TimerIndicator.test.tsx
import { render, screen } from '@testing-library/react';
import { TimerIndicator } from './TimerIndicator';

test('renders progress bar when visible', () => {
  render(<TimerIndicator progress={50} visible={true} remainingTime={30} />);
  const bar = screen.getByRole('progressbar');
  expect(bar).toHaveStyle({ width: '50%' });
  expect(bar).toHaveAttribute('aria-label', 'STUCK timer: 30 seconds remaining');
});

test('hidden when visible=false', () => {
  const { container } = render(<TimerIndicator progress={50} visible={false} remainingTime={30} />);
  expect(container.firstChild).toBeNull();
});
```

---

### T004: Lift Timer State from EditorCore to App
**Effort**: 1 hour
**Dependencies**: T003
**Parallelizable**: No (depends on T003)

**Steps**:
1. Modify `EditorCore.tsx` to expose timer state via callback prop: `onTimerUpdate(remainingTime: number)`
2. In `App.tsx`, add state: `const [timerRemaining, setTimerRemaining] = useState(60)`
3. Pass `onTimerUpdate={setTimerRemaining}` to EditorCore
4. Calculate progress: `const progress = ((60 - timerRemaining) / 60) * 100`

**Validation**:
- [ ] EditorCore calls `onTimerUpdate` every second when Muse mode active
- [ ] App.tsx receives updated timer state
- [ ] Timer resets to 60 when user types

**Acceptance Test**:
```typescript
// Add to client/src/App.test.tsx
test('receives timer updates from EditorCore', async () => {
  const onTimerUpdate = vi.fn();
  render(<EditorCore mode="muse" onTimerUpdate={onTimerUpdate} />);

  // Simulate 1 second passing
  await vi.advanceTimersByTimeAsync(1000);

  expect(onTimerUpdate).toHaveBeenCalledWith(59); // 60 - 1
});
```

---

### T005: Integrate TimerIndicator into App
**Effort**: 30 minutes
**Dependencies**: T003, T004
**Parallelizable**: No (depends on T004)

**Steps**:
1. Import `TimerIndicator` in `App.tsx`
2. Add before `<header>`: `<TimerIndicator progress={progress} visible={mode === 'muse'} remainingTime={timerRemaining} />`
3. Verify timer appears in Muse mode, hidden in Off/Loki modes

**Validation**:
- [ ] Timer indicator visible in Muse mode
- [ ] Timer hidden in Off/Loki modes
- [ ] Progress animates from 0% to 100% over 60 seconds

**Acceptance Test**: See T006 (E2E)

---

### T006: E2E Test for Timer Visibility
**Effort**: 1 hour
**Dependencies**: T005
**Parallelizable**: No (depends on T005)

**Steps**:
1. Create `client/e2e/timer-visibility.spec.ts`
2. Test timer appears in Muse mode
3. Test timer resets on typing
4. Test timer hidden in Off/Loki modes

**Acceptance Test**:
```typescript
// client/e2e/timer-visibility.spec.ts
test('Timer indicator appears in Muse mode', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#mode-selector', 'muse');

  const timer = page.locator('.timer-indicator');
  await expect(timer).toBeVisible();

  // Check ARIA label
  await expect(timer).toHaveAttribute('aria-label', /STUCK timer: \d+ seconds remaining/);
});

test('Timer resets when user types', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#mode-selector', 'muse');

  // Wait for timer to progress
  await page.waitForTimeout(5000); // 5 seconds

  // Type in editor (timer should reset)
  await page.locator('.milkdown .ProseMirror').click();
  await page.keyboard.type('test');

  // Timer should reset to ~60s (check ARIA label)
  const timer = page.locator('.timer-indicator');
  await expect(timer).toHaveAttribute('aria-label', /STUCK timer: (59|60) seconds remaining/);
});

test('Timer hidden in Off and Loki modes', async ({ page }) => {
  await page.goto('/');

  // Off mode
  await page.selectOption('#mode-selector', 'off');
  await expect(page.locator('.timer-indicator')).not.toBeVisible();

  // Loki mode
  await page.selectOption('#mode-selector', 'loki');
  await expect(page.locator('.timer-indicator')).not.toBeVisible();
});
```

---

### T007: Create Lock ID Extraction Utility
**Effort**: 1 hour
**Dependencies**: None
**Parallelizable**: Yes

**Steps**:
1. Add to `client/src/utils/prosemirror-helpers.ts`:
   - `extractLockId(node: ProseMirrorNode): string | null` - Parse `<!-- lock:uuid -->` from node content
   - `findLockedRanges(doc: ProseMirrorNode): { from: number, to: number, lockId: string }[]` - Find all locked content ranges

**Validation**:
- [ ] `extractLockId` returns lock ID from valid Markdown comment
- [ ] `extractLockId` returns null for non-locked nodes
- [ ] `findLockedRanges` returns array of all locked ranges with positions

**Acceptance Test**:
```typescript
// client/src/utils/prosemirror-helpers.test.ts
import { extractLockId, findLockedRanges } from './prosemirror-helpers';

test('extractLockId parses lock ID from Markdown comment', () => {
  const node = { textContent: '<!-- lock:abc123 -->Some locked text' };
  expect(extractLockId(node)).toBe('abc123');
});

test('extractLockId returns null for unlocked content', () => {
  const node = { textContent: 'Regular text' };
  expect(extractLockId(node)).toBeNull();
});

test('findLockedRanges finds all locked content ranges', () => {
  const doc = createDoc('<!-- lock:abc -->Locked 1<!-- /lock --> User text <!-- lock:def -->Locked 2<!-- /lock -->');
  const ranges = findLockedRanges(doc);

  expect(ranges).toHaveLength(2);
  expect(ranges[0]).toMatchObject({ lockId: 'abc', from: 0, to: 20 });
  expect(ranges[1]).toMatchObject({ lockId: 'def', from: 50, to: 70 });
});
```

---

### T008: Create Lock Content Decorations
**Effort**: 2 hours
**Dependencies**: T007
**Parallelizable**: No (depends on T007)

**Steps**:
1. Add `createLockDecorations(doc: ProseMirrorNode): DecorationSet` to `prosemirror-helpers.ts`
2. Use `findLockedRanges` to get lock positions
3. Create `Decoration.inline()` for each range with class `'locked-content'` and `data-lock-id` attribute
4. Integrate into EditorCore's `decorations` plugin

**Validation**:
- [ ] Decorations applied to all locked content ranges
- [ ] Decorations include CSS class `'locked-content'`
- [ ] Decorations include `data-lock-id` attribute
- [ ] Decorations update when document changes

**Acceptance Test**:
```typescript
// client/src/utils/prosemirror-helpers.test.ts
test('createLockDecorations creates decorations for locked content', () => {
  const doc = createDoc('<!-- lock:abc -->Locked text<!-- /lock -->');
  const decorations = createLockDecorations(doc);

  expect(decorations.find()).toHaveLength(1);

  const [decoration] = decorations.find();
  expect(decoration.spec.class).toBe('locked-content');
  expect(decoration.spec['data-lock-id']).toBe('abc');
});
```

---

### T009: Add Lock Content CSS Styling
**Effort**: 30 minutes
**Dependencies**: T008
**Parallelizable**: Yes (can be done in parallel with T008)

**Steps**:
1. Create `client/src/styles/locked-content.css`
2. Add styles for `.locked-content` (border, background, hover icon)
3. Import in `App.tsx` or `EditorCore.tsx`

**CSS**:
```css
.locked-content {
  border-left: 3px solid #7c3aed; /* Purple */
  background: rgba(124, 58, 237, 0.05); /* 5% purple tint */
  padding-left: 8px;
  position: relative;
}

.locked-content:hover::after {
  content: '🔒';
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.6;
  pointer-events: none; /* Don't block text selection */
}
```

**Validation**:
- [ ] Locked content has left border and background tint
- [ ] Lock icon appears on hover
- [ ] Styling does not break editor layout

**Acceptance Test**: See T010 (E2E visual test)

---

### T010: E2E Test for Locked Content Styling
**Effort**: 1 hour
**Dependencies**: T008, T009
**Parallelizable**: No (depends on T008, T009)

**Steps**:
1. Create `client/e2e/locked-content-styling.spec.ts`
2. Insert locked content via editor API
3. Validate CSS classes applied
4. Screenshot comparison for visual validation

**Acceptance Test**:
```typescript
// client/e2e/locked-content-styling.spec.ts
test('Locked content has visual styling', async ({ page }) => {
  await page.goto('/');

  // Insert locked content (simulate AI response)
  await page.evaluate(() => {
    // Inject locked content into editor
    const editor = document.querySelector('.milkdown .ProseMirror');
    editor.innerHTML = '<!-- lock:abc123 --><p>AI-added locked text</p><!-- /lock -->';
  });

  const lockedContent = page.locator('.locked-content');
  await expect(lockedContent).toBeVisible();

  // Validate styling
  await expect(lockedContent).toHaveCSS('border-left', '3px solid rgb(124, 58, 237)');
  await expect(lockedContent).toHaveCSS('background-color', 'rgba(124, 58, 237, 0.05)');

  // Validate data attribute
  await expect(lockedContent).toHaveAttribute('data-lock-id', 'abc123');

  // Screenshot for visual regression
  await page.screenshot({ path: 'test-results/locked-content-styling.png' });
});

test('Lock icon appears on hover', async ({ page }) => {
  // Insert locked content
  await page.goto('/');
  await insertLockedContent(page, 'AI-added text');

  const lockedContent = page.locator('.locked-content');

  // Hover over locked content
  await lockedContent.hover();

  // Validate ::after pseudo-element (check computed style)
  const hasIconOnHover = await page.evaluate(() => {
    const element = document.querySelector('.locked-content');
    const styles = window.getComputedStyle(element, ':after');
    return styles.content === '"🔒"';
  });

  expect(hasIconOnHover).toBe(true);
});
```

---

### T011: E2E Test for Lock Rejection Feedback
**Effort**: 1.5 hours
**Dependencies**: None (validates existing feature)
**Parallelizable**: Yes

**Steps**:
1. Create `client/e2e/lock-rejection-feedback.spec.ts`
2. Test shake animation triggers on delete attempt
3. Test bonk sound plays (audio element created)
4. Test content unchanged after rejection

**Acceptance Test**:
```typescript
// client/e2e/lock-rejection-feedback.spec.ts
test('Lock rejection triggers shake animation and bonk sound', async ({ page }) => {
  await page.goto('/');

  // Insert locked content
  await insertLockedContent(page, 'AI-added locked text');

  // Select locked content
  await page.locator('.locked-content').click();
  await page.keyboard.press('Control+A'); // Select all

  // Attempt to delete
  await page.keyboard.press('Backspace');

  // Assert: Shake animation applied (check for CSS class)
  const editor = page.locator('.milkdown');
  await expect(editor).toHaveClass(/lock-rejection-shake/);

  // Assert: Animation class removed after 300ms
  await page.waitForTimeout(400);
  await expect(editor).not.toHaveClass(/lock-rejection-shake/);

  // Assert: Bonk sound played (audio element created)
  const audioPlayed = await page.evaluate(() => {
    const audioElements = Array.from(document.querySelectorAll('audio'));
    return audioElements.some(audio => audio.src.includes('lock-bonk'));
  });
  expect(audioPlayed).toBe(true);

  // Assert: Content unchanged
  await expect(page.locator('.locked-content')).toContainText('AI-added locked text');
});

test('Lock rejection does not modify content', async ({ page }) => {
  await page.goto('/');
  await insertLockedContent(page, 'AI-added text');

  // Capture content before deletion
  const contentBefore = await page.locator('.milkdown .ProseMirror').textContent();

  // Attempt to delete
  await page.keyboard.press('Backspace');

  // Capture content after deletion
  const contentAfter = await page.locator('.milkdown .ProseMirror').textContent();

  // Assert: Content unchanged
  expect(contentBefore).toBe(contentAfter);
});
```

---

## Phase 3: Quality of Life (P3) - Week 3
**Estimate**: 2-3 hours
**Goal**: Welcome modal hierarchy, keyboard hint footer

### T012: Add "RECOMMENDED" Badge to Muse Mode
**Effort**: 30 minutes
**Dependencies**: None
**Parallelizable**: Yes

**Steps**:
1. Open `client/src/components/WelcomeModal.tsx`
2. Find Muse Mode section (around line 40)
3. Add `<span className="recommended-badge">RECOMMENDED</span>` after "Muse Mode" heading
4. Add CSS for `.recommended-badge` (see design.md)

**Validation**:
- [ ] Badge appears next to "Muse Mode" heading
- [ ] Badge styled with purple background, white text
- [ ] Badge does not appear on other mode sections

**Acceptance Test**:
```typescript
// Add to client/e2e/welcome-modal.spec.ts
test('Muse Mode has RECOMMENDED badge', async ({ page }) => {
  await page.goto('/');

  const badge = page.locator('.welcome-mode.muse-mode .recommended-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('RECOMMENDED');

  // Badge styled correctly
  await expect(badge).toHaveCSS('background-color', 'rgb(124, 58, 237)'); // Purple
  await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)'); // White
});
```

---

### T013: Add Font Size Hierarchy to Modal Headings
**Effort**: 20 minutes
**Dependencies**: None
**Parallelizable**: Yes (with T012)

**Steps**:
1. Open `client/src/components/WelcomeModal.css` (or create if not exists)
2. Add CSS rules for heading font sizes:
   - `.welcome-mode.muse-mode h3 { font-size: 1.0em; }`
   - `.welcome-mode.loki-mode h3 { font-size: 1.0em; }`
   - `.lock-concept h3 { font-size: 0.9em; }`

**Validation**:
- [ ] Muse Mode heading: 1.0em
- [ ] Loki Mode heading: 1.0em
- [ ] Lock Concept heading: 0.9em

**Acceptance Test**:
```typescript
// Add to client/e2e/welcome-modal.spec.ts
test('Modal headings have font size hierarchy', async ({ page }) => {
  await page.goto('/');

  const museHeading = page.locator('.welcome-mode.muse-mode h3');
  const lokiHeading = page.locator('.welcome-mode.loki-mode h3');
  const lockHeading = page.locator('.lock-concept h3');

  // Get computed font sizes
  const museFontSize = await museHeading.evaluate(el => window.getComputedStyle(el).fontSize);
  const lokiFontSize = await lokiHeading.evaluate(el => window.getComputedStyle(el).fontSize);
  const lockFontSize = await lockHeading.evaluate(el => window.getComputedStyle(el).fontSize);

  expect(museFontSize).toBe(lokiFontSize); // Muse = Loki
  expect(parseFloat(lockFontSize)).toBeLessThan(parseFloat(museFontSize)); // Lock < Muse
});
```

---

### T014: Add Keyboard Shortcut Footer
**Effort**: 30 minutes
**Dependencies**: None
**Parallelizable**: Yes

**Steps**:
1. Open `client/src/App.tsx`
2. Add footer after `<main>`:
   ```tsx
   <footer className="app-footer">
     Press <kbd>?</kbd> for help
   </footer>
   ```
3. Add CSS for `.app-footer` (see design.md)

**Validation**:
- [ ] Footer visible at bottom of screen
- [ ] Footer contains `<kbd>?</kbd>` element
- [ ] Footer styled with opacity 0.5, gray color

**Acceptance Test**: See T015

---

### T015: E2E Test for Footer Visibility
**Effort**: 30 minutes
**Dependencies**: T014
**Parallelizable**: No (depends on T014)

**Steps**:
1. Create `client/e2e/keyboard-hint-footer.spec.ts`
2. Test footer visible in all modes
3. Test footer does not trigger modal on click
4. Test keyboard shortcut still works independently

**Acceptance Test**:
```typescript
// client/e2e/keyboard-hint-footer.spec.ts
test('Footer displays keyboard hint', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('.app-footer');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('Press ? for help');

  // Validate <kbd> element
  await expect(footer.locator('kbd')).toHaveText('?');
});

test('Footer visible in all modes', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('.app-footer');

  // Off mode
  await page.selectOption('#mode-selector', 'off');
  await expect(footer).toBeVisible();

  // Muse mode
  await page.selectOption('#mode-selector', 'muse');
  await expect(footer).toBeVisible();

  // Loki mode
  await page.selectOption('#mode-selector', 'loki');
  await expect(footer).toBeVisible();
});

test('Clicking footer does not trigger modal', async ({ page }) => {
  await page.goto('/');

  // Dismiss welcome modal if visible
  const welcomeButton = page.locator('.welcome-button');
  if (await welcomeButton.isVisible()) {
    await welcomeButton.click();
  }

  // Click footer
  await page.locator('.app-footer').click();

  // Modal should NOT reappear
  await expect(page.locator('.welcome-modal')).not.toBeVisible();
});

test('Keyboard shortcut still works independently', async ({ page }) => {
  await page.goto('/');

  // Dismiss welcome modal
  await page.locator('.welcome-button').click();

  // Press ? key
  await page.keyboard.press('?');

  // Modal should reappear
  await expect(page.locator('.welcome-modal')).toBeVisible();
});
```

---

### T016: E2E Test for Footer Styling
**Effort**: 20 minutes
**Dependencies**: T014
**Parallelizable**: Yes (with T015)

**Steps**:
1. Add test to `client/e2e/keyboard-hint-footer.spec.ts`
2. Validate footer opacity, font size, color
3. Screenshot for visual regression

**Acceptance Test**:
```typescript
test('Footer has subtle styling', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('.app-footer');

  // Validate styling
  await expect(footer).toHaveCSS('opacity', '0.5');
  await expect(footer).toHaveCSS('font-size', '14px'); // 0.875rem
  await expect(footer).toHaveCSS('position', 'fixed');

  // Screenshot for visual regression
  await page.screenshot({ path: 'test-results/footer-styling.png' });
});
```

---

## Phase 4: Final Validation
**Estimate**: 1 hour
**Goal**: Run full test suite, validate all features

### T017: Run Full E2E Test Suite
**Effort**: 30 minutes
**Dependencies**: All E2E tasks (T002, T006, T010, T011, T015, T016)
**Parallelizable**: No

**Steps**:
1. Run `npm run test:e2e` (all Playwright tests)
2. Verify all new tests pass
3. Verify no regressions in existing tests

**Validation**:
- [ ] All E2E tests pass (0 failures)
- [ ] Test coverage includes all 6 capabilities
- [ ] No console errors during test execution

---

### T018: Production Build Validation
**Effort**: 20 minutes
**Dependencies**: All implementation tasks
**Parallelizable**: No

**Steps**:
1. Run `npm run build`
2. Run `npm run preview`
3. Open browser, manually verify:
   - Page title: "Impetus Lock - AI-Powered Writing Pressure System"
   - Test Delete button: Hidden
   - Timer indicator: Works in Muse mode
   - Locked content: Styled with border + background
   - Welcome modal: Muse badge present
   - Footer: Keyboard hint visible

**Validation**:
- [ ] Production build compiles without errors
- [ ] All 6 features visible/functional in production build
- [ ] No console warnings or errors

---

### T019: Re-run New User Audit
**Effort**: 10 minutes
**Dependencies**: All implementation tasks
**Parallelizable**: No

**Steps**:
1. Run `npx playwright test new-user-audit.spec.ts`
2. Review console logs for user feedback
3. Compare before/after screenshots

**Validation**:
- [ ] Audit test passes
- [ ] Screenshot comparison shows visual improvements
- [ ] Audit rating improves from 8.5/10 → ≥9.0/10

**Expected Output**:
```
✅ WHAT I LIKED:
   1. Branded page title (easy to find tab!)
   2. Timer indicator shows when Muse is active
   3. Locked content is clearly marked with purple border
   4. Welcome modal guides me to Muse mode (RECOMMENDED badge)
   5. Footer reminds me I can press ? for help

💡 MY UNDERSTANDING:
   - I now understand locked content is AI-added and can't be deleted
   - I can see the 60s timer progress in Muse mode
   - Muse mode is the recommended starting point

📊 Overall Rating: 9.5/10 (up from 8.5/10)
```

---

## Dependency Graph

```
Phase 1 (P0):
  T001 (Page Title) → Independent
  T002 (Dev Button Test) → Independent

Phase 2 (P2):
  T003 (TimerIndicator Component) → Independent
  T004 (Lift Timer State) → T003
  T005 (Integrate Timer) → T003, T004
  T006 (Timer E2E Test) → T005

  T007 (Lock ID Extraction) → Independent
  T008 (Lock Decorations) → T007
  T009 (Lock CSS) → Independent (can parallel with T008)
  T010 (Lock E2E Test) → T008, T009

  T011 (Lock Rejection E2E) → Independent (validates existing feature)

Phase 3 (P3):
  T012 (Muse Badge) → Independent
  T013 (Font Hierarchy) → Independent (can parallel with T012)
  T014 (Footer) → Independent
  T015 (Footer E2E) → T014
  T016 (Footer Styling E2E) → T014

Phase 4 (Validation):
  T017 (Full E2E Suite) → All E2E tasks
  T018 (Production Build) → All implementation tasks
  T019 (New User Audit) → All implementation tasks
```

**Parallelization Opportunities**:
- Week 1: T001, T002 (both independent)
- Week 2: T003, T007, T009, T011 (4 parallel tasks)
- Week 3: T012, T013, T014 (3 parallel tasks)

**Total Tasks**: 19
**Critical Path**: T001 → T003 → T004 → T005 → T006 → T017 → T018 → T019 (8 tasks, ~6 hours)
