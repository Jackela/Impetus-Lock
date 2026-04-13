# Feature Specification: Vibe Enhancements

**Feature Branch**: `002-vibe-enhancements`  
**Created**: 2025-11-06  
**Status**: Draft  
**Input**: User description: "P2.ImpetusLock.VibeEnhancements - Manual trigger button and sensory feedback for AI actions"

## Clarifications

### Session 2025-11-06

- Q: What is the audio asset sourcing strategy for sound effects (Clank, Whoosh, Bonk)? → A: Use existing royalty-free sound library (e.g., Freesound.org, Zapsplat)
- Q: How should the system handle animation interruptions when a new AI action triggers while a previous animation is still playing? → A: Allow interruption, restart new animation (cancel-and-replace)
- Q: What are the browser compatibility requirements for animations and audio? → A: Chrome/Chromium-based browsers only (Chrome, Edge, Opera)

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  CONSTITUTIONAL REQUIREMENT (Article II: Vibe-First Imperative):
  - P1 priority is RESERVED FOR un-deletable constraint implementation ONLY
  - All other features (UI polish, auxiliary functions) must be P2 or lower
  - P1 tasks must represent ≥60% of story points and be scheduled for wave 1
  
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently (with TDD per Article III)
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Manual Trigger Button (Priority: P2)

"小王" is a creative enthusiast writing in Muse mode. When experiencing writer's block or feeling stuck, 小王 wants to manually request AI assistance without waiting for the automatic 60-second STUCK state detection.

**Why this priority**: While the core un-deletable constraint (P1) is already implemented, this feature reduces friction in the Muse mode experience. It's a usability enhancement that empowers users to control when they receive AI prompts, but it's not essential to the core "lock" functionality.

**Independent Test**: Can be fully tested by enabling Muse mode, clicking the manual trigger button, and verifying that AI intervention (Provoke action) is immediately triggered. Delivers value by reducing wait time from 60 seconds to instant.

**Acceptance Scenarios**:

1. **Given** user is in Muse mode and writing, **When** user clicks the "I'm stuck!" button, **Then** AI immediately triggers a Provoke action (injects provocative content) without waiting for automatic STUCK detection
2. **Given** user is in Loki mode, **When** user views the interface, **Then** the "I'm stuck!" button is disabled and cannot be clicked
3. **Given** user is in Off mode, **When** user views the interface, **Then** the "I'm stuck!" button is disabled and cannot be clicked
4. **Given** user is in Muse mode and clicks the manual trigger, **When** the AI Provoke action is triggered, **Then** the same visual and audio feedback (Glitch animation + Clank sound) as automatic intervention is displayed

---

### User Story 2 - Sensory Feedback for AI Actions (Priority: P2)

"小王" wants stronger sensory feedback when the AI takes actions (Provoke or Delete) to reinforce the "gamification" vibe and make the system feel more responsive and engaging.

**Why this priority**: This enhances the overall user experience and emotional engagement with the system, but is not critical to the core functionality. It's a polish feature that makes the interaction more satisfying and memorable.

**Independent Test**: Can be fully tested by triggering AI actions (Provoke in Muse mode, Delete in Loki mode) and verifying that appropriate animations and sound effects play. Delivers value by making AI interventions more noticeable and engaging.

**Acceptance Scenarios**:

1. **Given** AI executes a Provoke action (inject provocative content), **When** the action completes, **Then** user sees a "Glitch" (visual glitch/flash) animation AND hears a "Clank" (locking sound) audio effect
2. **Given** AI executes a Delete action (Loki mode), **When** the action completes, **Then** user sees text "Fade-out" animation AND hears a "Whoosh" (wind/disappearing sound) audio effect
3. **Given** AI executes a rejection action (user tries to delete locked content), **When** the action completes, **Then** user sees "Shake" animation AND hears "Bonk" sound (already implemented in P1, included here for completeness)
4. **Given** user has sound disabled in browser/OS, **When** AI action occurs, **Then** visual feedback still plays but audio is muted without causing errors

---

### Edge Cases

- What happens when manual trigger button is clicked multiple times rapidly (e.g., user double-clicks)?
  - System should debounce clicks to prevent multiple simultaneous AI requests
  - Button should be temporarily disabled during AI action execution
  
- What happens when AI action fails (API error, network timeout)?
  - Visual feedback should include error state (e.g., red flash instead of glitch)
  - Audio feedback should play error sound (e.g., buzz instead of clank)
  - User should see clear error message
  
- What happens when user switches modes while AI action is in progress?
  - Action should complete but button state should update to reflect new mode
  - If switching away from Muse mode, manual trigger button should become disabled
  
- What happens when user has animations disabled (accessibility preference)?
  - System should respect prefers-reduced-motion media query
  - Provide alternative non-animated visual indicators (e.g., color change, icon change)
  - Audio feedback should still play unless explicitly disabled

- What happens when a new AI action triggers while a previous animation is still playing?
  - System should cancel the current animation immediately
  - New animation should start from the beginning (cancel-and-replace behavior)
  - Audio from previous action should be stopped before new audio plays

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
  
  CONSTITUTIONAL REQUIREMENTS:
  - Article I: Prefer framework-native features, simplest implementation path
  - Article III: All requirements must be testable (TDD enforced)
  - Article IV: Backend requirements must allow SOLID compliance (SRP, DIP)
  - Article V: All public interfaces must be documentable (JSDoc/Docstrings)
-->

### Functional Requirements

**Manual Trigger Button (US1)**:

- **FR-001**: System MUST display a clearly labeled manual trigger button (e.g., "I'm stuck!") when Muse mode is active
- **FR-002**: Manual trigger button MUST be disabled (non-clickable, visually grayed out) when in Loki mode or Off mode
- **FR-003**: System MUST immediately trigger AI Provoke action when manual trigger button is clicked in Muse mode
- **FR-004**: System MUST debounce manual trigger button clicks to prevent multiple simultaneous API requests (minimum 2-second cooldown between clicks)
- **FR-005**: Manual trigger button MUST show loading/disabled state while AI action is in progress

**Sensory Feedback for Provoke Action (US2.1)**:

- **FR-006**: System MUST display "Glitch" visual animation when AI Provoke action executes
- **FR-007**: Glitch animation MUST be visually distinctive (e.g., brief screen flash, text distortion, or color shift) and complete within 1-2 seconds
- **FR-008**: System MUST play "Clank" audio effect when AI Provoke action executes
- **FR-009**: Clank sound MUST be a short (0.5-1 second) metallic locking sound that reinforces the "lock" metaphor, sourced from royalty-free sound libraries (e.g., Freesound.org, Zapsplat)

**Sensory Feedback for Delete Action (US2.2)**:

- **FR-010**: System MUST display "Fade-out" visual animation when AI Delete action executes (Loki mode)
- **FR-011**: Fade-out animation MUST gradually reduce text opacity from 100% to 0% over 0.5-1 second
- **FR-012**: System MUST play "Whoosh" audio effect when AI Delete action executes
- **FR-013**: Whoosh sound MUST be a short (0.5-1 second) wind/swoosh sound that conveys removal or disappearance, sourced from royalty-free sound libraries (e.g., Freesound.org, Zapsplat)

**Accessibility & Error Handling**:

- **FR-014**: System MUST respect user's prefers-reduced-motion setting and provide alternative non-animated visual indicators when animations are disabled
- **FR-015**: System MUST continue to function if audio playback fails (browser restrictions, no audio support) without throwing errors
- **FR-016**: System MUST display error feedback (visual and audio) when AI action fails (API error, network timeout)
- **FR-017**: All visual and audio feedback MUST be consistent with existing P1 rejection feedback (Shake/Bonk) for cohesive user experience
- **FR-018**: System MUST cancel any in-progress animation when a new AI action triggers and immediately start the new animation (cancel-and-replace behavior)
- **FR-019**: System MUST stop any playing audio effect when a new AI action triggers before playing the new audio effect
- **FR-020**: System MUST be tested and validated only on Chrome/Chromium-based browsers (Chrome, Edge, Opera); other browsers are not supported for this feature

### Key Entities *(include if feature involves data)*

- **Manual Trigger Event**: User-initiated request for AI intervention in Muse mode
  - Attributes: timestamp, user_id, mode (always "muse"), action_type (always "provoke")
  - Relationships: Triggers AI Provoke action, logged for analytics

- **AI Action Feedback**: Sensory response to AI actions
  - Attributes: action_type (provoke/delete/reject), visual_animation_type, audio_effect_type, timestamp
  - Relationships: Associated with specific AI action (Provoke, Delete, or Reject)

- **Mode State**: Current operational mode of the system
  - Attributes: mode_name (muse/loki/off), is_manual_trigger_enabled (boolean)
  - Relationships: Determines button availability and AI behavior

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Users in Muse mode can trigger AI intervention in under 2 seconds (from clicking manual trigger button to receiving AI Provoke action)
- **SC-002**: Manual trigger button correctly displays enabled/disabled state based on current mode with 100% accuracy
- **SC-003**: Visual and audio feedback plays for 100% of AI actions (Provoke, Delete) without errors or glitches
- **SC-004**: System respects accessibility preferences (reduced motion, no audio) for 100% of users with such preferences enabled
- **SC-005**: Users report improved engagement and satisfaction with AI interactions due to enhanced sensory feedback (measured via user surveys, target: 70%+ positive feedback)
- **SC-006**: Manual trigger button usage reduces perceived "stuckness" duration for users (measured via analytics, target: 50% reduction in time spent stuck before AI intervention)
- **SC-007**: All animations complete within specified durations (Glitch: 1-2s, Fade-out: 0.5-1s) with 95%+ consistency
- **SC-008**: All audio effects play within 100ms of visual feedback start to ensure synchronized sensory experience
- **SC-009**: Feature functions correctly on Chrome/Chromium-based browsers (Chrome, Edge, Opera) with 100% pass rate for all acceptance scenarios
