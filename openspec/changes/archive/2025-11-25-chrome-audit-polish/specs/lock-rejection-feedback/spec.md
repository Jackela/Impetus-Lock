# lock-rejection-feedback Specification

## Purpose
Validate existing lock rejection sensory feedback (shake animation + bonk sound) via comprehensive E2E tests.

## ADDED Requirements

### Requirement: Lock Rejection Feedback E2E Test

The application SHALL provide E2E test coverage for lock rejection sensory feedback (shake animation + bonk sound).

**Rationale**: Lock rejection feedback already implemented in P3 Sensory Feedback (specs/003-vibe-completion, US2). This requirement adds missing E2E test validation to ensure feature works end-to-end.

**Note**: ✅ Implementation exists in `EditorCore.tsx` - shake animation (`@keyframes lockRejectionShake`) and bonk sound (`lock-bonk.mp3`). This is testing-only work.

#### Scenario: Shake Animation Triggers on Lock Rejection

**Given** the editor contains locked content with ID `lock123`
**And** the user selects the locked content
**When** the user presses the Delete or Backspace key
**Then** the editor SHALL display a shake animation (2-3 rapid horizontal movements)
**And** the animation SHALL complete within 300ms

**Acceptance Criteria**:
- [ ] E2E test simulates Delete key press on locked content
- [ ] Test validates CSS animation class applied (`.lock-rejection-shake`)
- [ ] Animation duration matches spec (300ms)
- [ ] Test uses `page.waitForSelector()` to detect animation class
- [ ] Test removes animation class after completion (prevents stuck state)

---

### Requirement: Bonk Sound Plays on Lock Rejection

The lock rejection SHALL trigger an audio cue (bonk sound effect) to reinforce visual feedback.

**Rationale**: Audio feedback provides multi-sensory confirmation for users who may miss visual animation (e.g., accessibility, distracted users).

#### Scenario: Bonk Sound Effect Plays

**Given** the user attempts to delete locked content
**When** the lock rejection occurs
**Then** a bonk sound effect SHALL play (duration: ~200ms)
**And** the sound SHALL be audible at system volume level

**Acceptance Criteria**:
- [ ] E2E test validates audio element created (HTMLAudioElement)
- [ ] Sound file loaded: `public/sounds/lock-bonk.mp3`
- [ ] Audio plays once per rejection (no looping)
- [ ] Test uses Playwright's `waitForEvent('console')` or audio API inspection
- [ ] Sound does not block UI interaction (async playback)

---

### Requirement: Lock Rejection Does Not Modify Content

Attempting to delete locked content SHALL NOT modify the editor document state.

**Rationale**: Lock enforcement prevents deletion. E2E test validates content remains unchanged after rejection.

#### Scenario: Locked Content Unchanged After Rejection

**Given** the editor contains locked content: "AI-added text"
**And** the user selects the locked text
**When** the user presses Delete
**Then** the editor content SHALL remain "AI-added text" (unchanged)
**And** the editor state SHALL be identical to pre-deletion state

**Acceptance Criteria**:
- [ ] E2E test captures editor content before deletion attempt
- [ ] Test captures editor content after deletion attempt
- [ ] Test asserts content equality (no change)
- [ ] Test validates lock ID still present in document

---
