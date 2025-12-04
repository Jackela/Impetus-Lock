## ADDED Requirements
### Requirement: Contract Version Negotiation Is Backward-Compatible
The intervention API SHALL accept missing or older minor `X-Contract-Version` headers (same major) and echo the server contract version so clients can align without failing hard.

#### Scenario: Missing version header defaults to server version
- **GIVEN** a client calls `POST /api/v1/impetus/generate-intervention` without `X-Contract-Version`
- **WHEN** the request is validated
- **THEN** the server SHALL process the request using its current contract version
- **AND** include `X-Contract-Version: <server-version>` in the response headers.

#### Scenario: Older minor version is accepted
- **GIVEN** the client sends `X-Contract-Version: 1.0.0` while the server is at `1.0.1`
- **WHEN** the request is validated
- **THEN** the server SHALL accept the request and process normally
- **AND** echo the server version in the response header.

#### Scenario: Major mismatch rejected with clear error
- **GIVEN** the client sends `X-Contract-Version: 2.0.0`
- **WHEN** the request is validated
- **THEN** the server SHALL respond with 422 and error code `ContractVersionMismatch`
- **AND** include the supported server version in the error payload.

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
