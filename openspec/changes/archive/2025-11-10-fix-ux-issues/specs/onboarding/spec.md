# Onboarding

## Capability Description
Welcome modal explaining Impetus Lock concept and AI modes to new users.

## ADDED Requirements

### Requirement: First-time users MUST see onboarding modal

The application SHALL display a welcome modal explaining Muse/Loki modes and lock concept on first visit.

#### Scenario: Fresh user sees welcome modal on load
**Given** the user has never visited the application before
**And** localStorage has no `hasSeenWelcome` flag
**When** the application loads
**Then** a welcome modal appears
**And** the editor is not interactive behind the modal

#### Scenario: Welcome modal explains product concept
**Given** the welcome modal is displayed
**When** the user reads the modal content
**Then** the modal explains "Impetus Lock" concept (AI additions can't be deleted)
**And** describes Muse mode (creative prompts when stuck)
**And** describes Loki mode (random chaos: deletes + rewrites)
**And** describes Off mode (no AI intervention)

#### Scenario: User dismisses modal permanently
**Given** the welcome modal is displayed
**And** the user checks "Don't show again" checkbox
**When** the user clicks "Get Started" button
**Then** the modal closes
**And** `hasSeenWelcome: true` is saved to localStorage
**And** the modal does not appear on next page load

#### Scenario: User can re-open onboarding
**Given** the user has dismissed the welcome modal
**And** the editor is visible
**When** the user presses `?` key
**Then** the welcome modal opens again
**And** content is the same as first-time display

### Requirement: Modal MUST be accessible

Onboarding modal SHALL follow WCAG 2.1 AA guidelines for keyboard navigation and screen reader support.

#### Scenario: Keyboard navigation works
**Given** the welcome modal is open
**When** the user presses Tab
**Then** focus moves to "Don't show again" checkbox
**When** the user presses Tab again
**Then** focus moves to "Get Started" button
**When** the user presses Enter
**Then** the modal closes

#### Scenario: Escape key closes modal
**Given** the welcome modal is open
**When** the user presses Escape
**Then** the modal closes
**And** focus returns to editor

#### Scenario: Screen reader announces modal
**Given** a screen reader user loads the application for the first time
**When** the welcome modal appears
**Then** screen reader announces "Welcome to Impetus Lock, dialog"
**And** reads the modal content

## Related Capabilities
- **mode-selection**: Modal explains Muse/Loki/Off modes
- **lock-enforcement**: Modal explains lock concept
- **ui-theme**: Modal styled with purple Zen aesthetic
