# keyboard-hint-discoverability Specification

## Purpose
TBD - created by archiving change chrome-audit-polish. Update Purpose after archive.
## Requirements
### Requirement: Keyboard Shortcut Footer Hint

The application SHALL display a persistent footer hint advertising the "?" keyboard shortcut for help.

**Rationale**: New user audit found keyboard shortcut works reliably but is not advertised upfront. Users may never discover they can press "?" to reopen the welcome modal for help.

#### Scenario: Footer Displays Keyboard Hint

**Given** the application is loaded (post-onboarding)
**And** the welcome modal is dismissed
**When** the user views the main interface
**Then** a footer SHALL be visible at the bottom of the screen
**And** the footer SHALL display: "Press <kbd>?</kbd> for help"

**Acceptance Criteria**:
- [ ] Footer always visible (fixed position at bottom)
- [ ] Footer contains `<kbd>?</kbd>` element for semantic key representation
- [ ] Footer text: "Press ? for help" or "Press <kbd>?</kbd> for help"
- [ ] E2E test validates footer presence via `page.locator('.app-footer')`
- [ ] Footer does not obscure editor content (below main content area)

---

### Requirement: Footer Styling is Subtle

The footer SHALL use subtle styling to provide information without demanding attention or cluttering the interface.

**Rationale**: Footer is informational, not actionable. Must be visible but not distracting from Zen writing experience.

#### Scenario: Footer Has Subtle Styling

**Given** the footer is visible
**When** the user views the main interface
**Then** the footer SHALL have:
- **Opacity**: 0.5 (semi-transparent)
- **Font size**: 0.875rem (14px, smaller than body text)
- **Color**: #9ca3af (gray-400, low contrast)
- **Background**: Transparent or #1a1a1a (dark, matches app theme)
- **Position**: Fixed bottom, center-aligned

**Acceptance Criteria**:
- [ ] Footer opacity: 0.5 (validated via computed style)
- [ ] Footer does not have border or prominent background
- [ ] E2E test validates footer does not overlap editor content
- [ ] Visual regression test confirms subtle appearance

---

### Requirement: Footer Persists Across Mode Changes

The footer SHALL remain visible when the user switches between Off/Muse/Loki modes.

**Rationale**: Footer is mode-independent (keyboard shortcut works in all modes).

#### Scenario: Footer Visible in All Modes

**Given** the footer is displayed
**When** the user switches to Muse mode
**Then** the footer SHALL remain visible
**When** the user switches to Loki mode
**Then** the footer SHALL remain visible
**When** the user switches to Off mode
**Then** the footer SHALL remain visible

**Acceptance Criteria**:
- [ ] E2E test validates footer visibility in all 3 modes (Off, Muse, Loki)
- [ ] Footer does not hide/show during mode transitions
- [ ] Footer persists across page interactions (typing, clicking)

---

### Requirement: Footer Keyboard Shortcut Works

Clicking the footer hint SHALL NOT trigger the keyboard shortcut (footer is informational only).

**Rationale**: Footer is a hint, not a button. Clicking it should not trigger help modal (prevents accidental triggers).

#### Scenario: Clicking Footer Does Nothing

**Given** the footer is displayed
**When** the user clicks the footer text or `<kbd>?</kbd>` element
**Then** the welcome modal SHALL NOT open
**And** no action SHALL be triggered

**Acceptance Criteria**:
- [ ] Footer has no click handler (not a button)
- [ ] E2E test validates clicking footer does not open modal
- [ ] Keyboard shortcut still works (independent of footer)

---

