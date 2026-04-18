## ADDED Requirements

### Requirement: Achievement System

The system SHALL provide an achievement system to reward users for writing milestones.

#### Scenario: List user achievements

- **WHEN** authenticated user requests their achievements
- **THEN** return all achievements with earned status and timestamps

#### Scenario: Award achievement

- **WHEN** user reaches a milestone (e.g., 100 tasks created)
- **THEN** create achievement record with earned_at timestamp

#### Scenario: Get achievement definitions

- **WHEN** user requests available achievements
- **THEN** return list of all achievement definitions with descriptions

### Requirement: Achievement Types

The system SHALL support multiple achievement categories.

#### Scenario: Achievement categories exist

- **WHEN** the system initializes achievement definitions
- **THEN** it MUST include Task Milestones, Writing Streaks, Intervention Types, and Special categories
