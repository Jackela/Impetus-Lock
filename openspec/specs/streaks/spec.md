# streaks Specification

## Purpose
TBD - created by archiving change sprint-3-gamification. Update Purpose after archive.
## Requirements
### Requirement: Writing Streaks

The system SHALL track consecutive writing days (streaks).

#### Scenario: Get current streak

- **WHEN** authenticated user requests their streak info
- **THEN** return current_streak_days, longest_streak, streak_start_date

#### Scenario: Update streak on activity

- **WHEN** user creates or edits a task
- **THEN** update streak if activity is on a new day

#### Scenario: Streak recovery

- **WHEN** user misses a day but returns within grace period (1 day)
- **THEN** allow streak continuation with warning

### Requirement: Streak Rules

The system SHALL enforce writing streak rules consistently.

#### Scenario: Streak day is counted

- **WHEN** user creates or edits at least one task in a day
- **THEN** the system MUST count that day toward the streak

### Requirement: Streak Route Extraction Preserves Existing Endpoint Behavior
Streak endpoints SHALL delegate to injected user-scoped services while preserving current response fields, HTTP statuses, persistence outcomes and observed date calculation during this refactor. The extraction SHALL NOT implement or redefine the separate existing grace/recovery requirements.

#### Scenario: Streak data remains isolated
- **WHEN** an authenticated user gets or updates their streak
- **THEN** only that user's row SHALL be read or changed
- **AND** a missing row on GET SHALL retain the zero-valued response, and a missing database session SHALL retain HTTP 500.

#### Scenario: Date calculation remains unchanged during extraction
- **WHEN** activity is submitted on the same UTC day or on a later date
- **THEN** the extracted service SHALL retain same-day no-increment and the current later-date increment behavior
- **AND** initialization, longest_streak_days, timestamps, commit/refresh and response serialization SHALL remain unchanged.

