## ADDED Requirements

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

The system SHALL track:

- Total tasks created
- Total interventions received (Muse + Loki separately)
- Total writing time (estimated from task edits)
- Total locks created
- Average tasks per day
