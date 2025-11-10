# Dropdown Interaction

## Capability Description
Replace native select with accessible custom dropdown for reliable mouse click interaction.

## MODIFIED Requirements

### Requirement: AI Mode selector MUST respond to mouse clicks

The AI Mode selector SHALL reliably respond to mouse click interactions without timeouts.

#### Scenario: User clicks dropdown to open menu
**Given** the AI Mode selector is visible in the header
**When** the user clicks on the dropdown trigger
**Then** the dropdown menu opens immediately
**And** all 3 mode options are visible (Off, Muse, Loki)

#### Scenario: User selects mode via mouse click
**Given** the dropdown menu is open
**When** the user clicks on "Muse" option
**Then** the mode changes to Muse
**And** the dropdown menu closes
**And** no timeout occurs

#### Scenario: User navigates dropdown with keyboard
**Given** the dropdown trigger has focus
**When** the user presses ArrowDown
**Then** the dropdown menu opens
**And** first option receives focus
**When** the user presses Enter
**Then** the focused mode is selected

## ADDED Requirements

### Requirement: Dropdown MUST be accessible

Custom dropdown implementation SHALL meet WCAG 2.1 AA standards.

#### Scenario: Screen reader announces dropdown state
**Given** a screen reader user focuses the dropdown trigger
**When** the trigger receives focus
**Then** screen reader announces "AI Mode, button, collapsed"
**When** the menu opens
**Then** screen reader announces "expanded"

#### Scenario: Keyboard-only navigation works
**Given** the dropdown menu is open
**When** the user presses ArrowUp/ArrowDown
**Then** focus moves between options
**When** the user presses Escape
**Then** the menu closes and focus returns to trigger

## Related Capabilities
- **mode-selection**: Mode state management (unchanged)
- **ui-theme**: Purple theme styling applied to custom dropdown
