# timer-visibility Specification

## Purpose
Provide ambient awareness of Muse mode STUCK timer progress to reduce user anxiety without distracting from Zen writing experience.

## ADDED Requirements

### Requirement: Muse Timer Progress Indicator

The application SHALL display a non-intrusive visual progress indicator showing STUCK timer state when Muse mode is active.

**Rationale**: New user audit revealed anxiety: "How do I know when Muse is 'watching' me (the 60s timer)? I don't see a countdown!" Ambient timer visibility improves confidence without adding cognitive load.

#### Scenario: Timer Indicator Appears in Muse Mode

**Given** the user switches to Muse mode via the mode selector
**And** the editor is in focus
**When** the STUCK timer begins counting (60 seconds to AI intervention)
**Then** a subtle progress indicator SHALL appear above the editor
**And** the indicator SHALL show timer progress as a percentage (0% → 100% over 60 seconds)

**Acceptance Criteria**:
- [ ] Progress indicator only visible when Muse mode active (hidden in Off/Loki modes)
- [ ] Indicator appears at top edge of editor area (not header, to avoid distraction)
- [ ] Visual style: 2px height, purple (#7c3aed), opacity 0.6
- [ ] Smooth animation (linear progress, no jumps)
- [ ] Accessible to screen readers (aria-label: "STUCK timer: X seconds remaining")

---

### Requirement: Timer Reset on User Activity

The progress indicator SHALL reset to 0% when the user types in the editor, matching STUCK timer reset behavior.

**Rationale**: Ensures visual indicator accurately reflects internal timer state. Timer resets on typing to detect "stuck" state (inactivity).

#### Scenario: Progress Resets When User Types

**Given** Muse mode is active
**And** the STUCK timer is at 50% progress (30 seconds elapsed)
**When** the user types any character in the editor
**Then** the progress indicator SHALL immediately reset to 0%
**And** the timer SHALL restart counting from 0 seconds

**Acceptance Criteria**:
- [ ] Progress resets on any keyboard input (typing, paste, delete)
- [ ] Progress resets on any editor content change (via EditorCore state)
- [ ] Reset animation is instant (no fade/transition)
- [ ] E2E test validates reset behavior (simulate typing at 30s mark)

---

### Requirement: Timer Indicator Disappears Outside Muse Mode

The progress indicator SHALL hide immediately when the user switches to Off or Loki mode.

**Rationale**: Timer is only relevant in Muse mode (STUCK detection). Showing it in other modes creates confusion.

#### Scenario: Indicator Hidden When Switching Modes

**Given** Muse mode is active
**And** the STUCK timer progress indicator is visible
**When** the user switches to "Off" or "Loki" mode
**Then** the progress indicator SHALL disappear immediately
**And** the indicator SHALL NOT occupy any layout space (no empty gap)

**Acceptance Criteria**:
- [ ] Indicator hidden in Off mode
- [ ] Indicator hidden in Loki mode
- [ ] Transition is immediate (no fade-out delay)
- [ ] Layout does not shift when indicator appears/disappears
- [ ] E2E test validates visibility in all 3 modes (Off, Muse, Loki)

---

### Requirement: Non-Intrusive Visual Design

The timer indicator SHALL maintain Zen writing aesthetic through subtle, non-distracting visual design.

**Rationale**: Impetus Lock emphasizes distraction-free writing. Timer must provide ambient awareness without demanding attention.

#### Scenario: Indicator Styling Maintains Zen Aesthetic

**Given** the timer indicator is visible in Muse mode
**When** the user views the editor
**Then** the indicator SHALL use subtle styling:
- **Height**: 2px (minimal vertical space)
- **Color**: Purple (#7c3aed) matching brand
- **Opacity**: 0.6 (semi-transparent, ambient)
- **Position**: Top edge of editor (outside writing area)
- **Animation**: Linear progress (no pulsing/flashing)

**Acceptance Criteria**:
- [ ] Indicator does not obstruct editor content (positioned above, not overlaid)
- [ ] Color contrast meets WCAG 2.1 AA for decorative elements
- [ ] No distracting animations (no pulse, glow, or flash effects)
- [ ] Visual regression test confirms styling matches design spec
- [ ] User testing feedback: "I noticed it but wasn't distracted by it"

---
