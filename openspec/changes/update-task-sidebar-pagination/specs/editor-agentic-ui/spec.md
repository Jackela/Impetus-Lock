## ADDED Requirements

### Requirement: Reach older tasks in the writing sidebar

The authenticated sidebar SHALL allow the writer to open an owned task beyond the first page using the existing ordered task list.

#### Scenario: Requesting the next page fails

- **WHEN** loading the next page fails
- **THEN** already loaded tasks and the current selection SHALL remain available
- **AND** the writer SHALL be able to retry the page request.
