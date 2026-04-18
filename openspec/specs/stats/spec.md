# stats Specification

## Purpose
TBD - created by archiving change sprint-3-gamification. Update Purpose after archive.
## Requirements
### Requirement: User Statistics

The system SHALL provide user statistics for writing analytics.

#### Scenario: Get user stats

- **WHEN** authenticated user requests their statistics
- **THEN** return total_tasks, total_interventions, writing_minutes, locks_created

#### Scenario: Get stats by period

- **WHEN** user requests statistics for a time period (day/week/month)
- **THEN** return aggregated statistics for that period

#### Scenario: Get intervention breakdown

- **WHEN** user requests intervention type breakdown
- **THEN** return count of muse vs loki interventions

### Requirement: Statistics Tracked

The system SHALL track user writing statistics.

#### Scenario: Statistics are collected

- **WHEN** user performs writing activities
- **THEN** the system MUST record total tasks, interventions, writing time, locks created, and average tasks per day

