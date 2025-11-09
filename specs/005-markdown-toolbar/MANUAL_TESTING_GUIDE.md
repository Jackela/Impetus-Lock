# Manual Testing Guide - Markdown Toolbar (T088)

**Feature**: 005-markdown-toolbar  
**Purpose**: Cross-browser manual testing checklist  
**Browsers**: Chrome, Firefox, Safari (Desktop + Mobile viewports)

---

## Testing Environment Setup

### Desktop Testing

**Required Browsers**:
- Google Chrome (latest stable)
- Mozilla Firefox (latest stable)
- Safari (latest stable - macOS only)

**Viewport Sizes**:
- Desktop: 1920x1080 (full screen)
- Tablet: 768x1024 (iPad)
- Mobile: 375x667 (iPhone 8)

### Mobile Testing (Optional but Recommended)

**Real Devices** (if available):
- iOS: iPhone (Safari)
- Android: Chrome for Android

**Emulation** (Chrome DevTools):
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device: iPhone 12 Pro, Pixel 5, iPad

---

## Test Scenarios

### Scenario 1: Toolbar Visibility

**Steps**:
1. Load app at http://localhost:5173
2. Click in editor area
3. Type "Hello World"
4. Select all text (Ctrl+A / Cmd+A)

**Expected**:
- ✅ Toolbar appears above or below selected text
- ✅ Toolbar contains 5 buttons: Bold (B), Italic (I), H1, H2, Bullet (•)
- ✅ Toolbar positioned 8px away from selection

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop  
- [ ] Safari Desktop
- [ ] Chrome Mobile (375x667)
- [ ] Chrome Tablet (768x1024)

---

### Scenario 2: Bold Formatting

**Steps**:
1. Type "Test bold formatting"
2. Select text
3. Click Bold button (B)

**Expected**:
- ✅ Text becomes bold visually
- ✅ Bold button background changes to blue (active state)
- ✅ Bold button shows aria-pressed="true" (inspect in DevTools)
- ✅ Toolbar remains visible after click
- ✅ Selection is preserved

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop
- [ ] Chrome Mobile

**Additional Check**: Click Bold button again
- ✅ Bold formatting is removed (toggle behavior)
- ✅ Button returns to inactive state (no blue background)

---

### Scenario 3: Italic Formatting

**Steps**:
1. Type "Test italic formatting"
2. Select text
3. Click Italic button (I)

**Expected**:
- ✅ Text becomes italic visually
- ✅ Italic button background changes to blue (active state)
- ✅ Toolbar remains visible

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop
- [ ] Chrome Mobile

---

### Scenario 4: H1 Header

**Steps**:
1. Type "Test heading"
2. Place cursor in line (no need to select)
3. Click H1 button

**Expected**:
- ✅ Text becomes large heading (H1 style)
- ✅ H1 button shows active state (blue background)
- ✅ Cursor remains in heading line

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop
- [ ] Chrome Mobile

**Additional Check**: Click H2 button while in H1
- ✅ Heading changes from H1 to H2 (replacement behavior)
- ✅ H1 button becomes inactive, H2 button becomes active

---

### Scenario 5: H2 Header

**Steps**:
1. Type "Test subheading"
2. Place cursor in line
3. Click H2 button

**Expected**:
- ✅ Text becomes medium heading (H2 style)
- ✅ H2 button shows active state
- ✅ Cursor remains in heading

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop
- [ ] Chrome Mobile

---

### Scenario 6: Bullet List

**Steps**:
1. Type "List item 1"
2. Select text
3. Click Bullet List button (•)

**Expected**:
- ✅ Text becomes bullet list item
- ✅ Bullet point appears before text
- ✅ Bullet List button shows active state
- ✅ Pressing Enter creates new list item (Milkdown built-in behavior)

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop
- [ ] Chrome Mobile

**Additional Check**: Press Enter on empty list item
- ✅ List exits (cursor returns to normal paragraph)

---

### Scenario 7: Toolbar Positioning (Viewport Overflow)

**Steps**:
1. Scroll to top of page
2. Type text near top edge of viewport
3. Select text

**Expected**:
- ✅ Toolbar appears below selection (flip behavior)
- ✅ Toolbar does not overflow viewport top edge

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

**Steps** (horizontal overflow):
1. Type long text near left edge
2. Select text at left edge

**Expected**:
- ✅ Toolbar shifts right to stay in viewport (shift behavior)

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

---

### Scenario 8: Mobile Touch Targets

**Steps**:
1. Open app in mobile viewport (375x667)
2. Type "Test mobile"
3. Select text with touch gesture
4. Tap each button (Bold, Italic, H1, H2, Bullet)

**Expected**:
- ✅ All buttons are easy to tap (44x44px minimum)
- ✅ No mis-taps (buttons don't overlap)
- ✅ Formatting applies correctly on touch
- ✅ Toolbar doesn't interfere with on-screen keyboard

**Test On**:
- [ ] Chrome Mobile (emulated)
- [ ] Real iOS device (if available)
- [ ] Real Android device (if available)

---

### Scenario 9: Keyboard Navigation

**Steps**:
1. Type and select text
2. Press Tab key repeatedly

**Expected**:
- ✅ Focus moves into toolbar (first button gets focus indicator)
- ✅ Focus indicator is clearly visible (blue outline)
- ✅ Tab moves focus from Bold → Italic → H1 → H2 → Bullet
- ✅ Shift+Tab moves focus backwards
- ✅ Enter/Space activates focused button

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

---

### Scenario 10: Active State Tracking

**Steps**:
1. Type "Bold and italic"
2. Select "Bold" word only
3. Click Bold button
4. Move selection to "italic" word
5. Click Italic button
6. Select entire text ("Bold and italic")

**Expected**:
- ✅ Bold button shows active state when "Bold" is selected
- ✅ Italic button shows active state when "italic" is selected
- ✅ Both buttons show active state when entire text selected (has both marks)

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

---

### Scenario 11: Lock Enforcement Integration

**Steps**:
1. Switch to Muse mode (mode selector)
2. Click "I'm stuck!" button to generate locked content
3. Wait for AI-generated locked block to appear
4. Select locked content
5. Try to click Bold button

**Expected**:
- ✅ Formatting is rejected (lock enforcement from P1-P3)
- ✅ Sensory feedback shown (shake animation + bonk sound)
- ✅ Locked content remains unchanged

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

---

### Scenario 12: Performance Check

**Steps**:
1. Type large document (1000+ words)
2. Scroll to middle of document
3. Select text
4. Click formatting buttons

**Expected**:
- ✅ Toolbar appears without lag (<100ms)
- ✅ Formatting applies instantly (<100ms)
- ✅ No editor slowdown or freezing
- ✅ Smooth scrolling maintained

**Test On**:
- [ ] Chrome Desktop
- [ ] Firefox Desktop
- [ ] Safari Desktop

---

## Browser-Specific Issues to Check

### Chrome
- [ ] Focus outline visible on toolbar buttons
- [ ] Floating UI positioning correct
- [ ] Touch targets work in mobile emulation

### Firefox
- [ ] ARIA labels announced by screen reader (if testing with NVDA)
- [ ] Button states (aria-pressed) update correctly
- [ ] Toolbar doesn't flicker on show/hide

### Safari (macOS)
- [ ] Toolbar positioning with webkit-specific rendering
- [ ] Button interactions work with trackpad gestures
- [ ] VoiceOver announces toolbar correctly (if testing)

### Mobile Safari (iOS)
- [ ] Toolbar doesn't interfere with iOS selection UI
- [ ] Touch targets are adequate (44x44px)
- [ ] Toolbar positions correctly above/below keyboard

---

## Accessibility Testing (Optional Manual Verification)

### Screen Reader Testing

**NVDA (Windows) / JAWS**:
1. Enable NVDA/JAWS
2. Tab to toolbar
3. Verify announcements: "Formatting toolbar, toolbar"
4. Arrow through buttons
5. Verify announcements: "Bold, toggle button, not pressed"

**VoiceOver (macOS)**:
1. Enable VoiceOver (Cmd+F5)
2. Tab to toolbar
3. Verify announcements: "Formatting toolbar, toolbar, 5 buttons"
4. Navigate buttons with VoiceOver

### Keyboard-Only Navigation

**Test**:
1. Unplug mouse
2. Navigate entire app using only keyboard
3. Type text, select with Shift+Arrow keys
4. Tab to toolbar
5. Use Enter/Space to activate buttons

**Expected**:
- ✅ All functionality accessible via keyboard
- ✅ Focus always visible
- ✅ No keyboard traps

---

## Issue Reporting Template

If you encounter issues during manual testing, use this template:

```markdown
### Issue: [Brief Description]

**Browser**: Chrome/Firefox/Safari
**Version**: [Browser version]
**Viewport**: Desktop (1920x1080) / Mobile (375x667) / Tablet (768x1024)
**Reproducible**: Yes / No

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Screenshot**:
[Attach screenshot if applicable]

**Console Errors**:
[Any browser console errors]
```

---

## Completion Checklist

Mark each browser/viewport combination as tested:

### Desktop Testing
- [ ] Chrome 131+ (1920x1080)
- [ ] Firefox 132+ (1920x1080)
- [ ] Safari 17+ (1920x1080) - macOS only

### Tablet Testing
- [ ] Chrome (768x1024)
- [ ] Firefox (768x1024)
- [ ] Safari (768x1024)

### Mobile Testing
- [ ] Chrome (375x667)
- [ ] Firefox (375x667)
- [ ] Safari (375x667)

### Optional Real Device Testing
- [ ] iPhone (Safari)
- [ ] Android Phone (Chrome)
- [ ] iPad (Safari)

---

## Sign-Off

**Tester Name**: ___________________  
**Date**: ___________________  
**Overall Status**: PASS / FAIL / PARTIAL  
**Notes**: _________________________________________

---

**Manual testing guide complete!** Use this checklist to verify toolbar functionality across all supported browsers and viewports.
