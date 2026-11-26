## ADDED Requirements

### Requirement: Task-Associated Intervention Retries Share a Committed Result

The Web intervention API SHALL apply the existing 15-second idempotency window across API processes for authenticated requests associated with an owned, persisted PostgreSQL task. Retries accepted by the API SHALL keep the existing response, headers, account and task scope, and first-result behavior regardless of changes to repeated payload or provider headers.

#### Scenario: A retry reaches another API process

- **GIVEN** a task-associated intervention has successfully committed for an authenticated writer
- **WHEN** a request with the same account, task and idempotency key reaches any API process within the 15-second window
- **THEN** it SHALL verify current authorization and return the original intervention response and applicable cooldown header
- **AND** the retry SHALL leave the provider, task action history, statistics and achievements without additional effects.

#### Scenario: Overlapping requests use the same key

- **GIVEN** the first generation and commit succeed
- **WHEN** two accepted requests for the same account, task and key overlap across API processes
- **THEN** only one SHALL generate and commit the intervention
- **AND** the other SHALL recheck for a committed receipt after waiting and return the original successful result within the replay window.

#### Scenario: The first attempt fails before commit

- **WHEN** the provider fails or PostgreSQL cannot commit a task-associated intervention
- **THEN** the API SHALL preserve the existing failure outcome and SHALL NOT publish a successful receipt
- **AND** a subsequent accepted retry SHALL remain eligible for a successful write.

#### Scenario: Isolation and expiry are preserved

- **WHEN** the same key is used for a different account or task, or is reused after the 15-second window
- **THEN** the API SHALL treat the authorized request as a new intervention
- **AND** a missing or foreign task SHALL retain its existing HTTP 404 behavior.

#### Scenario: Replay metadata excludes request secrets

- **WHEN** the API writes a replay receipt
- **THEN** it SHALL reference the action and the scoped request identity without storing the raw key, draft payload, authentication values or provider credentials.

#### Scenario: Generation without repository persistence

- **WHEN** generation is allowed without a persisted task
- **THEN** the request SHALL retain the existing process-local replay and response contract.
