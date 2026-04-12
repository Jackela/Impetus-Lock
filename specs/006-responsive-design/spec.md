# Feature Specification: Responsive Design (响应式设计)

**Feature Branch**: `006-responsive-design`
**Created**: 2025-11-09
**Status**: Draft
**Input**: User description: "项目：P5.ImpetusLock.ResponsiveDesign - 此 P5 规范用于实现"响应式设计" (Responsive Design)。P1-P4 构建了一个功能完备、Vibe 强烈的桌面应用。此 P5 任务的目标是"抛光" (Polish) UI/UX，确保 P1-P4 的核心 Vibe 在移动设备（手机）和平板电脑上也能被完美体验，而不是一个"损坏"或"溢出"的界面。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adaptive Layout for Mobile Devices (Priority: P2)

As "Xiao Wang" (小王), a creative enthusiast who wants to capture ideas on-the-go, I need the Impetus Lock editor to gracefully adapt to my mobile phone's small screen without horizontal scrolling or content overflow, so that I can maintain the same Zen-mode writing experience whether I'm at my desk or on the bus.

**Why this priority**: P2 (not P1) because Article II reserves P1 for un-deletable constraint implementation only. This is a foundational UX enhancement that ensures the core P1-P4 functionality is accessible on mobile devices. Without this, the entire application becomes unusable on smartphones, destroying all the "vibe" built in previous phases.

**Independent Test**: Can be fully tested by opening the application on a 375px-wide mobile viewport (iPhone SE size) and verifying: (1) no horizontal scrollbar appears, (2) all interactive elements remain visible and accessible, (3) editor content reflows properly. Delivers immediate value by making the app mobile-accessible.

**Acceptance Scenarios**:

1. **Given** a user opens Impetus Lock on a mobile phone (375px width), **When** the application loads, **Then** all UI elements (editor, toolbar, buttons) fit within the viewport width without horizontal scrolling
2. **Given** a user types a long line of text on mobile, **When** the text exceeds the viewport width, **Then** the text wraps to the next line instead of causing horizontal overflow
3. **Given** a user interacts with the editor on mobile, **When** they tap on any interactive element (buttons, toolbar items), **Then** the touch targets are at least 44x44px (WCAG 2.1 AA compliance)
4. **Given** a user on mobile device with viewport width < 768px, **When** they view the application, **Then** the layout switches to a single-column stack layout with editor taking full width

---

### User Story 2 - Responsive Floating Toolbar Positioning (Priority: P3)

As "Xiao Wang" using Impetus Lock on my tablet or phone, I need the P4 markdown toolbar to automatically adjust its position and size for smaller screens (such as docking to the bottom instead of floating), so that it remains usable without obscuring my writing or wasting precious screen real estate.

**Why this priority**: P3 because this enhances the P4 toolbar feature (which itself is P4 foundational). While important for mobile UX polish, the application remains functional without optimal toolbar positioning. This is a refinement that elevates the mobile experience from "functional" to "delightful."

**Independent Test**: Can be tested by opening the application on a 768px-wide tablet viewport and verifying: (1) the floating toolbar automatically switches to bottom-docked mode when screen width < 768px, (2) toolbar buttons remain accessible and properly sized (44x44px minimum), (3) toolbar doesn't overlap with editor content. Delivers value by optimizing toolbar UX for mobile form factors.

**Acceptance Scenarios**:

1. **Given** a user on a mobile device (width < 768px), **When** they select text in the editor, **Then** the toolbar appears docked at the bottom of the screen (instead of floating above selection)
2. **Given** a user on a tablet (width >= 768px and < 1024px), **When** they select text, **Then** the toolbar floats above the selection but uses a compact layout with appropriately-sized buttons
3. **Given** a user on desktop (width >= 1024px), **When** they select text, **Then** the toolbar maintains the original P4 floating behavior above selection
4. **Given** a mobile user with the toolbar visible, **When** they scroll the editor, **Then** the bottom-docked toolbar remains fixed at the bottom (doesn't scroll with content)

---

### User Story 3 - Readable Typography on Small Screens (Priority: P3)

As "Xiao Wang" writing on my mobile phone, I need the editor's font size and line spacing to automatically adjust for optimal readability on small screens, so that I can maintain the Zen-mode reading experience without squinting or zooming.

**Why this priority**: P3 because this enhances readability polish rather than core functionality. The application is usable with default desktop typography on mobile, but this adjustment significantly improves the "Zen mode" aesthetic continuity across devices. This is a quality-of-life enhancement for mobile users.

**Independent Test**: Can be tested by loading the editor on mobile viewport and verifying: (1) base font size increases from desktop 16px to mobile 18px, (2) line height adjusts from desktop 1.6 to mobile 1.8 for comfortable reading, (3) headings scale proportionally. Delivers value by preserving readability and Zen aesthetic on small screens.

**Acceptance Scenarios**:

1. **Given** a user on mobile (width < 768px), **When** they view editor content, **Then** base font size is 18px (vs. 16px on desktop) for improved readability
2. **Given** a user on mobile, **When** they view paragraph text, **Then** line height is 1.8 (vs. 1.6 on desktop) to prevent text from feeling cramped
3. **Given** a user on mobile, **When** they view headings (H1/H2), **Then** heading sizes scale proportionally (e.g., H1 from 32px to 28px) to prevent excessive vertical space consumption
4. **Given** a user on tablet (768px-1024px), **When** they view content, **Then** typography uses intermediate sizing between mobile and desktop values

---

### User Story 4 - Responsive AI Intervention Controls (Priority: P3)

As "Xiao Wang" using Impetus Lock on mobile, I need the AI intervention mode selector and "Provoke Muse" button to adapt to mobile layouts (such as stacking vertically or using icons-only mode), so that these P2 "creative sparring partner" controls remain accessible without cluttering the limited screen space.

**Why this priority**: P3 because this adapts existing P2 controls for mobile. The AI intervention system (Muse/Loki modes) is a P2 feature; ensuring it works well on mobile is a polish enhancement. Users can still access these features on mobile even without perfect layout optimization.

**Independent Test**: Can be tested by opening the application on mobile and verifying: (1) mode selector (Off/Muse/Loki) switches to a compact dropdown or icon-based selector, (2) "Provoke Muse" button remains accessible with proper touch target size, (3) controls don't overlap with editor content. Delivers value by making AI intervention features mobile-friendly.

**Acceptance Scenarios**:

1. **Given** a user on mobile (width < 768px), **When** they view the AI intervention controls, **Then** the mode selector appears as a compact dropdown (instead of full-width tabs) to conserve horizontal space
2. **Given** a user on mobile, **When** they view the "Provoke Muse" button, **Then** it maintains 44x44px minimum touch target size and remains accessible without scrolling
3. **Given** a user on tablet (768px-1024px), **When** they view AI controls, **Then** controls use an intermediate layout (e.g., icon + label vs. desktop label-only)
4. **Given** a user on mobile with AI intervention active, **When** Glitch animation plays, **Then** animation scales appropriately to viewport size without causing overflow

---

### Edge Cases

- **What happens when user rotates device from portrait to landscape?** Layout must smoothly transition between breakpoints (e.g., portrait phone switches from mobile to tablet layout when rotated to landscape). No content should be lost or hidden during orientation change.
- **What happens on very small screens (< 320px width)?** Application must remain functional even on extremely narrow viewports (e.g., iPhone 5/SE in portrait at 320px). Minimum viable layout: single column, stacked elements, minimum font size of 16px to prevent zoom-lock on iOS.
- **How does system handle long unbreakable content (e.g., long URLs)?** Long words or URLs must use CSS word-break or overflow-wrap to prevent horizontal scrolling. Locked content blocks must also respect this constraint.
- **What happens when virtual keyboard appears on mobile?** Viewport height adjustment must not cause layout collapse or hide critical UI elements (e.g., toolbar, locked content). Consider using `window.visualViewport` API to handle keyboard appearance.
- **How does touch interaction work with locked content?** Touch target sizes for all interactive elements (including near locked content) must meet 44x44px minimum. Consider touch gestures (long-press, swipe) for mobile-specific interactions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST apply responsive breakpoints at 768px (mobile/tablet boundary) and 1024px (tablet/desktop boundary)
- **FR-002**: System MUST use fluid layouts (flexbox/grid with percentages or viewport units) that adapt to viewport width without fixed pixel widths
- **FR-003**: System MUST prevent horizontal scrolling on all viewport widths (minimum 320px)
- **FR-004**: System MUST maintain all P1-P4 functionality (un-deletable locks, AI intervention, sensory feedback, markdown toolbar) on mobile and tablet viewports
- **FR-005**: System MUST adjust floating toolbar to bottom-docked mode when viewport width < 768px
- **FR-006**: System MUST scale typography (font sizes, line heights, spacing) based on viewport breakpoints
- **FR-007**: System MUST ensure all touch targets (buttons, toolbar items, interactive elements) are minimum 44x44px on mobile viewports (< 768px)
- **FR-008**: System MUST use viewport meta tag to control initial zoom and prevent unwanted zooming on mobile browsers
- **FR-009**: System MUST gracefully handle device orientation changes (portrait/landscape) without losing content or breaking layout
- **FR-010**: System MUST handle long unbreakable content (URLs, code blocks) with appropriate word-breaking or overflow behavior
- **FR-011**: System MUST test responsive layouts on minimum viewport width of 320px (iPhone SE size)
- **FR-012**: System MUST preserve sensory feedback animations (Glitch, Shake, etc.) on mobile viewports with appropriate scaling

### Key Entities *(N/A - This feature involves layout and styling, not data)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can successfully load and interact with Impetus Lock on mobile devices (375px-767px width) without encountering horizontal scrollbars or content overflow (100% of tested mobile viewports)
- **SC-002**: All interactive elements (buttons, toolbar items, mode selectors) meet WCAG 2.1 AA touch target size requirement of 44x44px on mobile viewports (100% compliance)
- **SC-003**: Users can complete core workflows (create locked content, trigger AI intervention, use markdown formatting) on tablet devices (768px-1023px width) with same success rate as desktop (>95% task completion)
- **SC-004**: Typography remains readable on mobile devices without user needing to zoom, measured by: base font size ≥ 16px, line height ≥ 1.5, sufficient color contrast (WCAG AA compliant)
- **SC-005**: Layout transitions smoothly across breakpoints (768px and 1024px) with no visual glitches or content loss during viewport resize or device rotation (tested on Chrome DevTools responsive mode and real devices)
- **SC-006**: Application maintains "Zen mode" visual aesthetic (minimalist design, calm color palette, focused layout) across all viewport sizes, measured by: consistent color palette, proportional spacing, uncluttered interface
- **SC-007**: Page load performance on mobile devices remains acceptable (Lighthouse mobile score ≥ 85 for Performance, ≥ 90 for Accessibility)

## Assumptions

1. **Browser Support**: Assume modern mobile browsers with CSS Grid, Flexbox, and viewport units support (iOS Safari 12+, Chrome for Android 80+, Samsung Internet 10+). No IE11 mobile support required.
2. **Breakpoint Strategy**: Assume three-tier breakpoint system is sufficient: mobile (< 768px), tablet (768px-1023px), desktop (≥ 1024px). These breakpoints align with common device categories and CSS framework conventions (Bootstrap, Tailwind).
3. **Touch-First Design**: Assume mobile users interact primarily via touch (not mouse/keyboard). All interactive elements must be touch-optimized. Secondary input methods (e.g., external keyboard on tablet) are nice-to-have.
4. **Portrait-Primary on Mobile**: Assume mobile usage is primarily portrait orientation, though landscape must remain functional. Tablet orientation preference is landscape-primary.
5. **Virtual Keyboard Handling**: Assume standard browser behavior for virtual keyboard appearance (viewport resizing). Complex keyboard avoidance strategies (beyond CSS viewport units) are out of scope unless blocking issues arise.
6. **Existing P1-P4 Features**: Assume all P1-P4 features (locked content, AI intervention modes, sensory feedback, markdown toolbar) are fully functional on desktop. This feature only adapts their layout/sizing for mobile, not reimplementing their core logic.
7. **No Native App Features**: Assume web application only (no native iOS/Android app wrappers requiring platform-specific APIs). PWA features (service workers, home screen icons) are out of scope.
8. **Accessibility Baseline**: Assume WCAG 2.1 AA compliance for touch targets (44x44px), color contrast (4.5:1 for normal text), and semantic HTML. AAA compliance or advanced screen reader optimizations are stretch goals.

## Dependencies

- **P1-P4 Feature Completion**: This feature depends on the completion of P1 (un-deletable locks), P2 (AI intervention), P3 (sensory feedback), and P4 (markdown toolbar). Responsive design must adapt these existing features, not rebuild them.
- **CSS Framework/Tooling**: Assumes project uses modern CSS with CSS Grid/Flexbox support. May require CSS media queries, viewport units (vw, vh), and possibly CSS custom properties for theming. No specific CSS framework (Bootstrap, Tailwind) is mandated.
- **Milkdown Editor Responsiveness**: Assumes Milkdown editor component supports responsive layouts or can be styled via CSS to adapt to narrow viewports. If Milkdown has hardcoded widths, custom CSS overrides may be needed.
- **Floating UI Library**: P4's FloatingToolbar uses Floating UI library. Assumes this library supports responsive positioning strategies (e.g., conditional `flip` or `shift` middleware based on viewport size).

## Out of Scope

- **Native Mobile App**: Building iOS/Android native apps or hybrid apps (React Native, Flutter) is out of scope. This feature is web-only responsive design.
- **Offline/PWA Features**: Service workers, offline caching, Add to Home Screen prompts, push notifications, and other Progressive Web App features are out of scope.
- **Advanced Gesture Support**: Complex touch gestures (pinch-to-zoom, swipe navigation, long-press context menus) beyond standard tap/click interactions are out of scope unless required for core functionality.
- **Mobile-Specific Performance Optimizations**: Advanced techniques like code splitting for mobile, lazy loading images, or mobile-specific bundle optimizations are out of scope (beyond standard responsive image practices).
- **Cross-Browser Polyfills**: Polyfills for older mobile browsers (e.g., iOS Safari < 12, Android Browser < 5) are out of scope. Assume modern evergreen mobile browsers.
- **Landscape-Optimized Layouts**: While landscape orientation must remain functional, creating fully optimized landscape-specific layouts (distinct from portrait) is a stretch goal, not a requirement.
- **Tablet-Specific Features**: Features exclusive to tablets (e.g., split-screen editing, stylus input) are out of scope. Tablets are treated as "large mobile" devices with intermediate layouts.
