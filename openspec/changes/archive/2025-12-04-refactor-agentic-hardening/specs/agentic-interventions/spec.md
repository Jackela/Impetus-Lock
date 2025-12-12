## ADDED Requirements
### Requirement: Contract Version Is Mandatory and Exact
The intervention API SHALL require `X-Contract-Version: 2.0.0` on every request and reject mismatches or missing headers.

#### Scenario: Missing header is rejected
- **GIVEN** a client calls `POST /impetus/generate-intervention` without `X-Contract-Version`
- **WHEN** the request is validated
- **THEN** the server SHALL respond 422 with error `ContractVersionMismatch`
- **AND** include `server_version: "2.0.0"` in the error payload.

#### Scenario: Mismatched version is rejected
- **GIVEN** the client sends `X-Contract-Version: 1.0.1`
- **WHEN** the request is validated
- **THEN** the server SHALL respond 422 with error `ContractVersionMismatch`
- **AND** include `server_version: "2.0.0"` in the error payload.

### Requirement: Intervention Persistence Is Optional but Supported
The API SHALL persist intervention actions to the repository when available, while remaining fully functional without a repository.

#### Scenario: Repository available persists action history
- **GIVEN** a TaskRepository is configured and a `task_id` is provided
- **WHEN** `generate-intervention` returns provoke/delete/rewrite
- **THEN** the service SHALL write an InterventionAction record with `task_id`, `action`, `anchor`, `lock_id`/`content` (when applicable), and `issued_at`.

#### Scenario: Repository unavailable still serves responses
- **GIVEN** no repository is configured (e.g., in TESTING or no DATABASE_URL)
- **WHEN** the client calls `generate-intervention`
- **THEN** the API SHALL still return a valid InterventionResponse without 5xx
- **AND** log that persistence was skipped.
