# Feature Specification: P3 Vibe Completion

**Feature Branch**: `003-vibe-completion`  
**Created**: 2025-11-07  
**Status**: Draft  
**Input**: User description: "P3 规范用于补全 P1/P2 中已定义但未实现的 Vibe，并增加关键的错误处理 Vibe。此规范的目标是实现 P2 E2E 测试中被故意跳过的 4 个功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Loki Delete Visual & Audio Feedback (Priority: P2)

When "Xiao Wang" is in Loki mode and the AI agent executes a Delete action, he sees the deleted text fade out smoothly with a "whoosh" sound effect, providing clear sensory confirmation that content was removed by the system.

**Why this priority**: This completes P2-US5's sensory feedback system, enhancing the "Creative Sparring Partner" experience. While not core to the un-deletable constraint (P1), it significantly improves the gamification aspect that motivates Xiao Wang. Priority P2 reflects its value in user engagement without being critical to core functionality.

**Independent Test**: Can be tested by enabling Loki mode, triggering an AI Delete action, and verifying both the fade-out animation and whoosh sound play correctly. Delivers complete sensory feedback for AI-initiated deletions.

**Acceptance Scenarios**:

1. **Given** Loki mode is active and editor contains unlocked text, **When** AI agent triggers a Delete action, **Then** the deleted text visually fades out over 300-500ms
2. **Given** Loki mode is active with audio enabled, **When** AI agent triggers a Delete action, **Then** a "whoosh" sound effect plays simultaneously with the fade-out animation
3. **Given** Loki mode is active with audio disabled, **When** AI agent triggers a Delete action, **Then** only the fade-out animation plays without sound
4. **Given** user is viewing the deletion animation, **When** the fade-out completes, **Then** the deleted text is removed from the document

---

### User Story 2 - Lock Rejection Sensory Feedback (Priority: P2)

When "Xiao Wang" attempts to delete a locked content block (created under P1's un-deletable constraint), he immediately receives a "shake" animation on the locked block and a "bonk" invalid-action sound, making it clear that the deletion was rejected and why.

**Why this priority**: This completes the sensory feedback loop for P1's core lock enforcement feature. While P1 ensures locks work functionally, this P2 enhancement provides the essential user feedback that prevents confusion and aligns with the "gamified discipline" experience. Priority P2 because lock enforcement works without it, but user experience is significantly degraded.

**Independent Test**: Can be tested by creating a locked block, attempting to delete it, and verifying both the shake animation and bonk sound play. Delivers immediate feedback for rejected deletion attempts.

**Acceptance Scenarios**:

1. **Given** editor contains a locked content block, **When** user attempts to delete the locked content, **Then** the locked block visually shakes (horizontal oscillation, 200-300ms)
2. **Given** audio is enabled, **When** user attempts to delete locked content, **Then** a "bonk" invalid-action sound plays simultaneously with the shake animation
3. **Given** audio is disabled, **When** user attempts to delete locked content, **Then** only the shake animation plays without sound
4. **Given** user attempts to delete locked content, **When** the rejection feedback completes, **Then** the locked content remains unchanged in the editor
5. **Given** user attempts to delete multiple locked blocks rapidly, **When** each deletion is rejected, **Then** each rejection triggers independent feedback without interference

---

### User Story 3 - API Failure Error Feedback (Priority: P1)

When "Xiao Wang" triggers an AI action (e.g., manual provoke button) and it fails due to network or API errors, he receives clear visual feedback (red flash on the affected UI element) and an error sound (buzz), rather than silent failure, so he understands the system encountered a problem and can retry or adjust.

**Why this priority**: This is critical error handling that prevents user confusion and silent failures. Without this, Xiao Wang might think the AI is ignoring him or that the application is broken, leading to abandonment. Priority P1 because error feedback is a fundamental UX requirement for any interactive system - the application must communicate failures clearly.

**Independent Test**: Can be tested by simulating network failures or API errors, triggering AI actions, and verifying error feedback appears. Delivers essential error communication that prevents user frustration.

**Acceptance Scenarios**:

1. **Given** network connection is unavailable, **When** user clicks the manual provoke button, **Then** the button flashes red for 300-500ms
2. **Given** API returns an error response, **When** user triggers any AI action, **Then** the affected UI element (button/editor area) flashes red
3. **Given** audio is enabled and an API error occurs, **When** error feedback displays, **Then** a "buzz" error sound plays simultaneously with the red flash
4. **Given** audio is disabled and an API error occurs, **When** error feedback displays, **Then** only the red flash plays without sound
5. **Given** an API error occurred, **When** error feedback completes, **Then** user can retry the action immediately
6. **Given** consecutive API failures occur, **When** each error triggers feedback, **Then** each error displays independent feedback without queuing

---

### User Story 4 - Animation Queue Management (Priority: P2)

When "Xiao Wang" experiences multiple rapid AI actions (e.g., a Provoke immediately followed by a Delete), he sees only the most recent action's feedback animation cleanly replacing the previous one, avoiding visual clutter and audio cacophony that would confuse the narrative of what the AI is doing.

**Why this priority**: This ensures the sensory feedback system scales gracefully under rapid AI interactions, preventing the "gamified discipline" experience from becoming chaotic noise. Priority P2 because individual feedback works without this, but user experience degrades significantly when multiple actions occur rapidly. This is especially important for Loki mode's random timing.

**Independent Test**: Can be tested by triggering multiple AI actions in rapid succession (within 500ms) and verifying only the latest action's feedback displays completely. Delivers clean, non-overlapping feedback for rapid interactions.

**Acceptance Scenarios**:

1. **Given** a Provoke animation is playing, **When** a Delete action triggers before the Provoke animation completes, **Then** the Provoke animation immediately cancels and the Delete animation starts
2. **Given** a visual animation is playing, **When** a new action triggers, **Then** the previous animation stops at its current state without completing
3. **Given** an audio effect is playing, **When** a new action triggers, **Then** the previous audio stops immediately and the new audio plays
4. **Given** multiple actions trigger within 100ms, **When** the animation queue processes them, **Then** only the final action's feedback displays
5. **Given** rapid consecutive Reject actions occur, **When** each triggers feedback, **Then** each shake animation plays fully without accumulating shake effects

---

### Edge Cases

- What happens when a locked block deletion attempt occurs while a Loki Delete animation is already playing?
- How does the system handle audio playback when the browser/device denies audio permissions?
- What happens when an API error occurs during an active animation (e.g., user triggers action mid-Delete)?
- How does the animation queue handle actions triggered faster than the minimum animation duration (e.g., 10 actions within 100ms)?
- What happens when user switches modes (Off/Muse/Loki) while an animation is playing?
- How does the system handle simultaneous Reject feedback from multiple locked blocks in a multi-cursor selection?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a fade-out animation (0.75s / 750ms duration) on text content when Loki mode triggers a Delete action
- **FR-002**: System MUST play a "whoosh" sound effect synchronized with the fade-out animation when audio is enabled
- **FR-003**: System MUST display a horizontal shake animation (200-300ms duration) on locked content blocks when deletion is attempted
- **FR-004**: System MUST play a "bonk" invalid-action sound synchronized with the shake animation when audio is enabled
- **FR-005**: System MUST display a red flash animation (300-500ms duration) on the relevant UI element when an API error occurs
- **FR-006**: System MUST play a "buzz" error sound synchronized with the red flash when audio is enabled
- **FR-007**: System MUST respect user audio preferences (enabled/disabled) for all sound effects
- **FR-008**: System MUST cancel any currently playing animation when a new action triggers feedback
- **FR-009**: System MUST stop any currently playing audio when a new action triggers audio feedback
- **FR-010**: System MUST handle rapid consecutive actions (≥10 actions within 1 second) without queuing animations
- **FR-011**: System MUST display error feedback regardless of which component triggered the API call (button, editor, background process)
- **FR-012**: System MUST complete Delete fade-out animation before removing content from the document
- **FR-013**: System MUST maintain locked content integrity during and after Reject feedback animations
- **FR-014**: System MUST trigger Reject feedback for all user-initiated deletion attempts on locked content, regardless of input method (keyboard, mouse, touch)
- **FR-015**: System MUST provide visual-only feedback when audio permissions are denied by browser/device

### Key Entities *(include if feature involves data)*

- **Vibe Action**: Represents a single sensory feedback event with associated animation and audio, triggered by user actions or AI agent actions (Provoke, Delete, Reject, Error)
- **Animation State**: Tracks the currently playing animation (if any), including type, progress, and target element, to support cancellation and replacement
- **Audio State**: Tracks the currently playing audio effect (if any), including type and playback progress, to support interruption and replacement
- **Error Context**: Captures the source and nature of API failures (network timeout, server error, authentication failure) to determine appropriate error feedback

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users see visual feedback within 50ms of triggering any action (Delete, Reject, Error)
- **SC-002**: Audio feedback plays within 100ms of visual feedback appearing (when audio enabled)
- **SC-003**: 95% of users can identify which action occurred based solely on the sensory feedback (verified through user testing)
- **SC-004**: Animation replacements occur within 16ms (1 frame at 60fps) when new actions trigger
- **SC-005**: System handles 10 consecutive actions within 1 second without visual glitches or audio overlaps
- **SC-006**: Users report understanding why actions failed 90% of the time when error feedback displays (verified through user testing or support tickets)
- **SC-007**: Locked content remains visually stable (no layout shift) during and after Reject feedback animations
- **SC-008**: Delete animations complete content removal within 600ms from action trigger to content disappearance
- **SC-009**: System operates correctly with both audio enabled and disabled, maintaining 100% functionality in audio-disabled mode
- **SC-010**: Error feedback displays for all API failure scenarios (network timeout, 4xx errors, 5xx errors) with 100% coverage

## Assumptions

1. **Audio Asset Availability**: Assumes "whoosh", "bonk", and "buzz" sound effects are pre-loaded and available in the application assets (likely from P2 implementation)
2. **Browser Support**: Assumes modern browser support for CSS animations, Web Audio API, and requestAnimationFrame (99%+ of target users based on CanIUse.com)
3. **Animation Performance**: Assumes target devices can handle CSS transforms and opacity animations at 60fps (standard for web applications since 2015)
4. **Audio Permissions**: Assumes users may deny audio permissions (mobile browsers, corporate policies), so visual feedback alone must be sufficient
5. **API Error Types**: Assumes API can fail with network timeouts (no response), 4xx client errors, or 5xx server errors, all requiring identical error feedback
6. **Rapid Action Frequency**: Assumes 10 actions per second is the upper bound for realistic user/AI interaction speed (based on human reaction time limits)
7. **Lock Enforcement**: Assumes P1 lock enforcement system is functional and correctly identifies locked content blocks
8. **Existing Feedback Components**: Assumes P2 implemented foundational components for animation and audio playback that can be extended for these scenarios

## Dependencies

- **P1 Lock Enforcement System**: Reject feedback requires the existing lock identification and enforcement logic to determine when deletion attempts should trigger rejection
- **P2 Sensory Feedback System**: Extends the foundational animation and audio infrastructure built in P2 (manual trigger, Provoke feedback)
- **P2 AI Agent System**: Delete feedback and error feedback depend on AI agent actions and API integration points

## Out of Scope

- **Custom Sound Effect Creation**: Will use existing or placeholder sound effects; professional audio production is deferred
- **Haptic Feedback**: Vibration or haptic responses on mobile devices
- **Animation Customization**: User preferences for animation speed, style, or intensity
- **Error Recovery Suggestions**: Detailed error messages or troubleshooting guidance (only provides immediate sensory feedback)
- **Animation Accessibility Options**: Reduced motion support or alternative feedback modes for users with vestibular disorders (deferred to future accessibility pass)
- **Network Status Monitoring**: Proactive feedback about network connectivity before errors occur
- **Retry Logic**: Automatic retry mechanisms for failed API calls (only provides feedback, retry is manual)
