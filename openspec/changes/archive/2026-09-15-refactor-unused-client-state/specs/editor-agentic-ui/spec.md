## ADDED Requirements

### Requirement: Unused Hook Retirement Preserves Active Editor Behavior
The client SHALL retire `useTaskSyncCloud` and `useLockEnforcement` public entry points only after confirming that they have no production consumers, while retaining the active editor persistence and lock-enforcement paths.

#### Scenario: Consumer audit confirms safe removal
- **WHEN** imports, exports and dynamic references confirm that both hooks are unused in production
- **THEN** their implementations and obsolete exports, examples and hook-only tests SHALL be removed without introducing a replacement state layer
- **AND** no production call path SHALL be changed to use the retired cloud synchronization behavior.

#### Scenario: Active editor behavior survives removal
- **WHEN** the existing editor loads, saves, encounters a version conflict or rejects deletion/undo of locked content after the unused hooks are removed
- **THEN** it SHALL retain the existing useTaskSync and manager/context/transaction-filter behavior and current API version handling.

#### Scenario: A consumer is found before deletion
- **WHEN** a fresh caller audit finds a production consumer of either hook
- **THEN** that hook's deletion SHALL be deferred for a scoped consumer migration decision
- **AND** production behavior SHALL remain unchanged until that change is approved.
