## ADDED Requirements

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
