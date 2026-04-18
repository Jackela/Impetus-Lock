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

