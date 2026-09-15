## ADDED Requirements

### Requirement: Template Routes Delegate Without Changing Ownership Semantics
Template endpoints SHALL delegate persistence and business operations to injected user-scoped services while retaining the existing API contract.

#### Scenario: Template operations remain owner scoped
- **WHEN** an authenticated user lists, creates, fetches or deletes templates
- **THEN** the service SHALL scope every operation to that user's ID
- **AND** foreign or missing fetches SHALL return 404, while deleting a foreign or missing template SHALL retain 204 without deleting another user's template.

#### Scenario: Optional database behavior remains stable
- **WHEN** template endpoints execute without a database session
- **THEN** listing SHALL return the current empty paginated response
- **AND** create, fetch and delete SHALL retain the current 500 database-unavailable response.
