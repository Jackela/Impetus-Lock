# Trigger Control

## Capability Description
Control when Muse mode AI intervention triggers to prevent unwanted interruptions.

## MODIFIED Requirements

### Requirement: Muse mode MUST only trigger on explicit user actions or STUCK state

Muse mode SHALL only trigger AI intervention via manual button click or 30-second idle timeout, never on simple editor focus.

#### Scenario: User clicks editor in Muse mode
**Given** Muse mode is active
**And** the editor is visible
**When** the user clicks inside the editor to position cursor
**Then** no AI intervention is triggered
**And** cursor moves to clicked position normally

#### Scenario: User starts typing after click
**Given** Muse mode is active
**And** user clicked editor to focus
**When** the user types text immediately after click
**Then** no AI intervention is triggered
**And** text is inserted normally

#### Scenario: User stops typing for 30 seconds (STUCK state)
**Given** Muse mode is active
**And** user has written some text
**When** 30 seconds pass with no input
**Then** STUCK state is detected
**And** AI intervention triggers automatically

#### Scenario: User clicks "I'm stuck!" button
**Given** Muse mode is active
**And** the "I'm stuck!" button is visible
**When** the user clicks the button
**Then** AI intervention triggers immediately
**And** locked content is added

## REMOVED Requirements

### Requirement: ~~Auto-trigger on editor focus~~

**Rationale**: Causes unwanted AI interventions when user simply wants to position cursor or continue writing.

#### Scenario: ~~Focus triggers intervention~~ (DELETED)
**Status**: This behavior is removed entirely.

## Related Capabilities
- **stuck-detection**: 30-second idle timer (unchanged)
- **manual-trigger**: Button-based intervention (unchanged)
- **muse-mode**: AI mode selection (unchanged)
