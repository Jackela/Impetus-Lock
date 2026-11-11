## ADDED Requirements

### Requirement: Style History and Comparison Surfaces Are Wired or Retired

The client and server SHALL NOT retain a style-history or style-comparison surface that no running UI can reach. Before implementation, one of two end states SHALL be approved and recorded in the change: the `StyleLearningPanel` exposes the authenticated account's style history and a two-vector comparison, or the `/style/history` and `/style/compare` routes are removed together with their client transport, persisted data access and route-only tests.

#### Scenario: History and comparison are wired into the panel

- **WHEN** the approved decision is to surface style history and comparison
- **THEN** `StyleLearningPanel` SHALL render the history returned by `GET /style/history/user/{user_id}` for the authenticated account only
- **AND** it SHALL allow selecting two saved style vectors and render `POST /style/compare` metrics and insights
- **AND** the existing analyze and apply flow (`POST /style/analyze`, `POST /style/apply`) SHALL remain available and unchanged when history or comparison fails.

#### Scenario: History and comparison are retired

- **WHEN** the approved decision is retirement
- **THEN** the `/style/history` and `/style/compare` routers, their application registration, the client services and hooks, the generated types, and the style-history model, repository and migration SHALL be removed in the same change
- **AND** tests that only cover the removed paths, including the corresponding auth-required route matrix entries, SHALL be removed with them
- **AND** no dangling import, export or barrel re-export for the removed identifiers SHALL remain.

#### Scenario: No decision is approved yet

- **WHEN** neither end state has been approved
- **THEN** production code, routes, schema and generated types SHALL remain unchanged
- **AND** the change SHALL remain an unarchived proposal that claims no working style-history UI.
