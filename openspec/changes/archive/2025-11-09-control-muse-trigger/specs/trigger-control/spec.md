# Trigger Control

## Capability Description
Control when AI intervention triggers in Muse mode to prevent unwanted interruptions from editor focus/click events.

## MODIFIED Requirements

### Requirement: Muse mode MUST only trigger AI intervention on explicit user actions or STUCK state

The system SHALL restrict Muse mode AI intervention to two specific trigger mechanisms: manual button activation and STUCK state detection. Focus and click events on the editor SHALL NOT trigger AI intervention.

#### Scenario: Clicking editor in Muse mode does not trigger AI
**Given** the user has selected Muse mode
**When** the user clicks anywhere in the editor to position the cursor
**Then** the AI intervention does NOT trigger
**And** the cursor is positioned at the clicked location
**And** the user can continue editing without interruption

#### Scenario: Typing in editor does not trigger AI
**Given** the user has selected Muse mode
**And** the editor has focus
**When** the user types characters into the editor
**Then** the AI intervention does NOT trigger
**And** the typed text appears in the editor normally

#### Scenario: 30-second idle timeout triggers AI in Muse mode
**Given** the user has selected Muse mode
**And** the user has stopped typing for 30 seconds
**When** the STUCK state timeout is reached
**Then** the AI intervention triggers automatically
**And** AI-generated content is injected into the editor
**And** sensory feedback (Glitch animation) plays

#### Scenario: Manual button click triggers AI immediately
**Given** the user has selected Muse mode
**When** the user clicks the "I'm stuck!" button
**Then** the AI intervention triggers immediately
**And** AI-generated content is injected into the editor
**And** sensory feedback (Glitch animation) plays

#### Scenario: Off mode has no triggers at all
**Given** the user has selected Off mode
**When** the user clicks the editor OR stops typing for 30+ seconds OR clicks any button
**Then** the AI intervention does NOT trigger under any circumstance

### Requirement: Trigger logic MUST preserve existing functionality

Removing focus/click-based triggers SHALL NOT break STUCK detection timer, manual trigger button, or mode switching behavior.

#### Scenario: STUCK detection timer remains functional
**Given** the user has selected Muse mode
**And** focus/click triggers have been removed
**When** the user stops typing for 30 seconds
**Then** the STUCK detection timer still triggers AI intervention
**And** the timer resets when the user resumes typing

#### Scenario: Manual trigger button remains functional
**Given** the user has selected Muse mode
**And** focus/click triggers have been removed
**When** the user clicks "I'm stuck!" button
**Then** the button immediately triggers AI intervention
**And** button visual feedback works correctly

#### Scenario: Mode switching works correctly
**Given** focus/click triggers have been removed
**When** the user switches from Off → Muse → Loki → Off
**Then** each mode activates correctly
**And** Muse mode does NOT auto-trigger on activation
**And** Loki mode still has its random chaos timer

## REMOVED Requirements

### Requirement: Editor focus SHALL trigger AI intervention in Muse mode (REMOVED)

**Rationale**: This requirement caused unwanted AI interruptions when users simply clicked to position the cursor. User testing revealed this behavior prevents users from having control over when AI assists them, violating the core product principle that AI should help, not interrupt.

#### Scenario: Focus triggers AI (REMOVED)
~~**Given** the user has selected Muse mode~~
~~**When** the editor gains focus~~
~~**Then** the AI intervention triggers automatically~~

**Why Removed**: During user testing, naive users clicked the editor to position the cursor and experienced unexpected AI intervention. This created a frustrating experience where users couldn't interact with the editor without triggering AI. The STUCK detection timer (30s) and manual button provide sufficient trigger mechanisms without this over-aggressive behavior.

## Related Capabilities
- **mode-selection**: Muse mode must exist for triggers to apply
- **stuck-detection**: 30-second timer mechanism must remain functional
- **manual-intervention**: "I'm stuck!" button must remain functional
- **lock-enforcement**: AI-generated content still uses lock mechanism
